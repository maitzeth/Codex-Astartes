//! Backend (LexiLocal Python server) lifecycle management.
//!
//! Spawns and tracks `bash <backend_dir>/run.sh start` as a child process so the
//! UI can start/stop the backend from a single button.

use std::path::PathBuf;
use std::process::Stdio;
use serde::Serialize;
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

#[derive(Serialize, Clone, Debug)]
pub struct ServerStatus {
    pub running: bool,
    pub pid: Option<u32>,
}

pub struct ServerHandle {
    pub child: Mutex<Option<Child>>,
}

impl ServerHandle {
    pub fn new() -> Self {
        ServerHandle { child: Mutex::new(None) }
    }
}

pub async fn stop(handle: &ServerHandle) -> Result<ServerStatus, String> {
    let mut guard = handle.child.lock().await;
    if let Some(child) = guard.as_mut() {
        let _ = child.kill().await;
        let _ = child.wait().await;
    }
    *guard = None;
    Ok(ServerStatus {
        running: false,
        pid: None,
    })
}

pub async fn status(handle: &ServerHandle) -> Result<ServerStatus, String> {
    let guard = handle.child.lock().await;
    let running = guard.as_ref().and_then(|c| c.id()).is_some();
    let pid = guard.as_ref().and_then(|c| c.id());
    Ok(ServerStatus { running, pid })
}

/// Spawn `start` in the background, store the child handle, wait briefly, and
/// return the status. Used by the `start_server` command.
pub async fn start_and_track(
    handle: &ServerHandle,
    backend_dir: &str,
) -> Result<ServerStatus, String> {
    // Check if there's already a tracked child that's running.
    {
        let guard = handle.child.lock().await;
        if let Some(child) = guard.as_ref() {
            if child.id().is_some() {
                return Ok(ServerStatus {
                    running: true,
                    pid: child.id(),
                });
            }
        }
    }

    // Pre-flight validation.
    if backend_dir.trim().is_empty() {
        return Err("Backend directory not configured. Open Settings to set it.".into());
    }
    let dir = PathBuf::from(backend_dir);
    if !dir.join("run.sh").exists() {
        return Err(format!("run.sh not found in {}", dir.display()));
    }

    // Spawn the bash child.
    let child = Command::new("bash")
        .arg(dir.join("run.sh"))
        .arg("start")
        .current_dir(&dir)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| {
            format!(
                "Failed to start server: {}. Is Git Bash installed and on PATH?",
                e
            )
        })?;

    let pid = child.id();

    // Store the handle so we can kill it on stop_server.
    {
        let mut guard = handle.child.lock().await;
        *guard = Some(child);
    }

    Ok(ServerStatus { running: true, pid })
}
