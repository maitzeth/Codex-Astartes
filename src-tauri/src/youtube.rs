//! yt-dlp subprocess management.
//!
//! Spawns the system-installed `yt-dlp` (Windows: `yt-dlp.exe` on PATH) via
//! `tokio::process`, streams progress lines as `youtube://progress` Tauri
//! events, and supports mid-flight cancellation.

use std::collections::HashMap;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use regex::Regex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use uuid::Uuid;

/// Shared handle to a running yt-dlp child. The spawned task owns the stdout
/// reader; `cancel` flips `cancelled` and takes the child out of the slot
/// to `kill()` it, which lets `kill_on_drop` reap the OS process.
#[derive(Clone)]
struct ChildSlot {
    child: Arc<Mutex<Option<Child>>>,
    cancelled: Arc<AtomicBool>,
}

impl ChildSlot {
    fn new(child: Child) -> Self {
        Self {
            child: Arc::new(Mutex::new(Some(child))),
            cancelled: Arc::new(AtomicBool::new(false)),
        }
    }
}

#[derive(Default)]
pub struct DownloadRegistry {
    inner: Arc<Mutex<HashMap<String, ChildSlot>>>,
}

impl DownloadRegistry {
    pub fn new() -> Self {
        Self::default()
    }
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub id: String,
    pub percent: Option<f64>,
    pub eta: Option<String>,
    pub speed: Option<String>,
    pub status: ProgressStatus,
    pub error: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "lowercase")]
pub enum ProgressStatus {
    Downloading,
    Finished,
    Error,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DownloadStarted {
    pub id: String,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub enum Format {
    BestVideo,
    BestAudio,
    Mp3,
}

pub async fn check_available() -> bool {
    Command::new("yt-dlp")
        .arg("--version")
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Run `yt-dlp -U` and capture the result. yt-dlp's `-U` self-updater only
/// works for pip-installed yt-dlp; standalone `.exe` users will see a
/// descriptive error from yt-dlp itself (which we forward to the UI).
pub async fn update() -> Result<String, String> {
    let output = tokio::process::Command::new("yt-dlp")
        .arg("-U")
        .stdin(Stdio::null()) // avoid blocking on interactive pip prompts
        .output()
        .await
        .map_err(|e| {
            format!("Failed to spawn yt-dlp: {e}. Is it installed and on PATH?")
        })?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if output.status.success() {
        if stdout.is_empty() {
            Ok("yt-dlp reported success (no output)".to_string())
        } else {
            Ok(stdout)
        }
    } else {
        Err(extract_last_error(&stderr)
            .unwrap_or_else(|| format!("yt-dlp -U exited with code {:?}", output.status.code())))
    }
}

fn build_args(url: &str, format: &Format, output_dir: &str) -> Vec<String> {
    let mut args = vec!["--no-playlist".to_string(), "--newline".to_string()];
    match format {
        Format::BestVideo => {
            args.push("-f".to_string());
            args.push("bv*+ba/b".to_string());
        }
        Format::BestAudio => {
            args.push("-f".to_string());
            args.push("bestaudio".to_string());
        }
        Format::Mp3 => {
            args.push("-x".to_string());
            args.push("--audio-format".to_string());
            args.push("mp3".to_string());
        }
    }
    args.push("-o".to_string());
    args.push(format!("{}/%(title)s.%(ext)s", output_dir));
    args.push(url.to_string());
    args
}

/// Pull the most useful single line out of yt-dlp's stderr.
/// yt-dlp prints WARNINGs and then an ERROR; we want the ERROR, and if there
/// isn't one, the last non-empty line.
fn extract_last_error(stderr: &str) -> Option<String> {
    let last_error = stderr
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .filter(|l| l.starts_with("ERROR") || l.contains("ERROR:"))
        .last();
    last_error
        .map(|s| s.trim_start_matches("ERROR:").trim().to_string())
        .or_else(|| {
            stderr
                .lines()
                .map(str::trim)
                .filter(|l| !l.is_empty())
                .last()
                .map(str::to_string)
        })
}

fn parse_progress(line: &str, id: &str) -> Option<ProgressEvent> {
    // Matches: [download]  47.3% of ~50.00MiB at 5.00MiB/s ETA 00:08
    let re = Regex::new(r"\[download\]\s+(\d+(?:\.\d+)?)%.*?at\s+(\S+).*?ETA\s+(\S+)").ok()?;
    let caps = re.captures(line)?;
    let percent: f64 = caps.get(1)?.as_str().parse().ok()?;
    let speed = caps.get(2)?.as_str().to_string();
    let eta = caps.get(3)?.as_str().to_string();
    Some(ProgressEvent {
        id: id.to_string(),
        percent: Some(percent),
        eta: Some(eta),
        speed: Some(speed),
        status: ProgressStatus::Downloading,
        error: None,
    })
}

pub async fn start(
    app: &AppHandle,
    registry: &DownloadRegistry,
    url: String,
    format: Format,
    output_dir: String,
) -> Result<DownloadStarted, String> {
    let mut guard = registry.inner.lock().await;
    if !guard.is_empty() {
        return Err("Another download is already in progress.".into());
    }

    let id = Uuid::new_v4().to_string();
    let args = build_args(&url, &format, &output_dir);

    let mut child = Command::new("yt-dlp")
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| {
            format!("Failed to spawn yt-dlp: {e}. Is it installed and on PATH?")
        })?;

    let stdout = child.stdout.take().ok_or("no stdout pipe")?;
    let stderr = child.stderr.take();
    let slot = ChildSlot::new(child);

    let slot_for_task = slot.clone();
    let app_for_task = app.clone();
    let id_for_task = id.clone();
    let registry_arc = registry.inner.clone();

    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        let mut last_emit = std::time::Instant::now();
        while let Ok(Some(line)) = reader.next_line().await {
            // Debounce: ≤ 10 events/sec to avoid flooding the bus.
            if last_emit.elapsed() < std::time::Duration::from_millis(100) {
                continue;
            }
            last_emit = std::time::Instant::now();
            if let Some(ev) = parse_progress(&line, &id_for_task) {
                let _ = app_for_task.emit("youtube://progress", ev);
            }
        }

        let status = {
            let mut g = slot_for_task.child.lock().await;
            match g.as_mut() {
                Some(c) => c.wait().await.ok(),
                None => None,
            }
        };
        let final_status = match status {
            Some(s) if s.success() => ProgressStatus::Finished,
            _ => ProgressStatus::Error,
        };
        // Drain stderr so the user sees yt-dlp's actual diagnostic instead of a
        // blank "unknown error" alert. Prefer the last ERROR: line; fall back
        // to the last non-empty line; nothing if yt-dlp wrote nothing.
        let stderr_text = if let Some(mut err) = stderr {
            let mut buf = String::new();
            let _ = err.read_to_string(&mut buf).await;
            buf
        } else {
            String::new()
        };
        let error = if slot_for_task.cancelled.load(Ordering::SeqCst) {
            Some("cancelled".to_string())
        } else {
            extract_last_error(&stderr_text)
        };
        let _ = app_for_task.emit(
            "youtube://progress",
            ProgressEvent {
                id: id_for_task.clone(),
                percent: None,
                eta: None,
                speed: None,
                status: final_status,
                error,
            },
        );
        registry_arc.lock().await.remove(&id_for_task);
    });

    guard.insert(id.clone(), slot);
    Ok(DownloadStarted { id })
}

pub async fn cancel(registry: &DownloadRegistry, id: String) -> Result<(), String> {
    let slot = {
        let mut g = registry.inner.lock().await;
        g.remove(&id)
    };
    if let Some(slot) = slot {
        slot.cancelled.store(true, Ordering::SeqCst);
        let mut g = slot.child.lock().await;
        if let Some(mut c) = g.take() {
            let _ = c.kill().await;
        }
    }
    Ok(())
}
