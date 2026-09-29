//! Backend (LexiLocal Python server) lifecycle management.
//!
//! `bash run.sh start` backgrounds the Python server with `nohup ... &` and
//! writes the PID to `server.pid`. We read that PID after invoking `run.sh`
//! and use it as the canonical process handle, so stopping works correctly
//! even though `run.sh`'s bash process exits immediately.

use std::path::PathBuf;
use std::process::Stdio;
use serde::Serialize;
use tokio::process::Command;

#[derive(Serialize, Clone, Debug)]
pub struct ServerStatus {
    pub running: bool,
    pub pid: Option<u32>,
}

/// In-memory handle for the most-recently-started backend process.
pub struct ServerHandle {
    pub pid: tokio::sync::Mutex<Option<u32>>,
}

impl ServerHandle {
    pub fn new() -> Self {
        ServerHandle { pid: tokio::sync::Mutex::new(None) }
    }
}

fn pid_file(backend_dir: &str) -> PathBuf {
    PathBuf::from(backend_dir).join("server.pid")
}

fn read_pid_file(backend_dir: &str) -> Option<u32> {
    let path = pid_file(backend_dir);
    let Ok(content) = std::fs::read_to_string(&path) else {
        return None;
    };
    content.trim().parse::<u32>().ok()
}

fn is_pid_alive(pid: u32) -> bool {
    // `tasklist /FI "PID eq <pid>" /NH` works on Windows. The first character
    // of the output is "INFO" (no match) or a process name (match).
    let output = std::process::Command::new("tasklist")
        .args(["/FI", &format!("PID eq {pid}"), "/NH", "/FO", "CSV"])
        .output();
    match output {
        Ok(out) => {
            let s = String::from_utf8_lossy(&out.stdout);
            // When the PID is not found, tasklist prints "INFO: No tasks..."
            // When found, the first line contains the process name.
            !s.contains("INFO:") && s.contains(",")
        }
        Err(_) => false,
    }
}

fn kill_pid(pid: u32) -> Result<(), String> {
    // /T = also kill child processes (defensive — covers the nohup case).
    let output = std::process::Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .output()
        .map_err(|e| format!("taskkill failed: {e}"))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        // "process not found" is fine; the PID was already gone.
        if err.to_lowercase().contains("not found") {
            return Ok(());
        }
        return Err(format!("taskkill exited with {:?}: {}", output.status.code(), err));
    }
    Ok(())
}

pub async fn start_and_track(
    handle: &ServerHandle,
    backend_dir: &str,
) -> Result<ServerStatus, String> {
    if backend_dir.trim().is_empty() {
        return Err("Backend directory not configured. Open Settings to set it.".into());
    }
    let dir = PathBuf::from(backend_dir);
    if !dir.join("run.sh").exists() {
        return Err(format!("run.sh not found in {}", dir.display()));
    }

    // If we already have a tracked PID that's still alive, reuse it.
    {
        let guard = handle.pid.lock().await;
        if let Some(pid) = *guard {
            if is_pid_alive(pid) {
                return Ok(ServerStatus {
                    running: true,
                    pid: Some(pid),
                });
            }
        }
    }

    // Invoke run.sh start. It backgrounds Python with nohup and writes PID.
    let _ = Command::new("bash")
        .arg(dir.join("run.sh"))
        .arg("start")
        .current_dir(&dir)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map_err(|e| {
            format!(
                "Failed to start server: {}. Is Git Bash installed and on PATH?",
                e
            )
        })?;

    // Read the PID that run.sh wrote.
    let pid = read_pid_file(backend_dir)
        .ok_or_else(|| "run.sh did not write server.pid; check run.sh start output".to_string())?;

    // Validate that the PID actually exists (defensive: in case of stale pid file).
    if !is_pid_alive(pid) {
        return Err(format!(
            "run.sh reported PID {} but no such process is running",
            pid
        ));
    }

    {
        let mut guard = handle.pid.lock().await;
        *guard = Some(pid);
    }

    Ok(ServerStatus {
        running: true,
        pid: Some(pid),
    })
}

pub async fn stop(handle: &ServerHandle, backend_dir: &str) -> Result<ServerStatus, String> {
    let pid_to_kill = {
        let guard = handle.pid.lock().await;
        *guard
    };

    if let Some(pid) = pid_to_kill {
        kill_pid(pid)?;
    } else {
        // Fallback: maybe a server is running but we never tracked it.
        // Try the pid file just in case.
        if let Some(pid) = read_pid_file(backend_dir) {
            if is_pid_alive(pid) {
                kill_pid(pid)?;
            }
        }
    }

    // Best-effort: clear pid file.
    if !backend_dir.trim().is_empty() {
        let _ = std::fs::remove_file(pid_file(backend_dir));
    }

    {
        let mut guard = handle.pid.lock().await;
        *guard = None;
    }

    Ok(ServerStatus {
        running: false,
        pid: None,
    })
}

pub async fn status(handle: &ServerHandle) -> Result<ServerStatus, String> {
    let guard = handle.pid.lock().await;
    let pid = *guard;
    let running = pid.map(is_pid_alive).unwrap_or(false);
    Ok(ServerStatus {
        running,
        pid: if running { pid } else { None },
    })
}
