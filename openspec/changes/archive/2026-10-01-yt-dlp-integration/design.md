# YouTube Downloader — Design

## Architecture (mirrors existing `server.rs`)

```
┌─────────────────────────┐      invoke("download_youtube", ...)      ┌──────────────────────────────┐
│ src/sections/youtube.ts │ ─────────────────────────────────────────► │ src-tauri/src/commands.rs    │
│  - URL/format/folder UI │                                             │  download_youtube(cmd)       │
│  - progress bar listener│ ◄──── listen("youtube://progress", ...) ── │   └─► youtube::spawn(...)    │
└─────────────────────────┘                                             └─────────────┬────────────────┘
                                                                                    │ tokio::process::Command
                                                                                    ▼
                                                                        ┌──────────────────────────────┐
                                                                        │ yt-dlp.exe on PATH           │
                                                                        │ stdout → parse → emit events │
                                                                        └──────────────────────────────┘
```

The frontend never spawns processes. It only invokes commands and listens to events. This is identical to how `start_server` / `stop_server` work today — no new Tauri plugins, no new permissions beyond `dialog:allow-save`.

## Rust side

### New module: `src-tauri/src/youtube.rs`

```rust
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Clone)]
pub struct DownloadRegistry {
    inner: Arc<Mutex<HashMap<String, Child>>>,
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
pub enum ProgressStatus { Downloading, Finished, Error }

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DownloadStarted { pub id: String }

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub enum Format { BestVideo, BestAudio, Mp3 }

pub async fn check_available() -> bool {
    Command::new("yt-dlp").arg("--version").output().await
        .map(|o| o.status.success()).unwrap_or(false)
}

pub async fn start(
    app: &AppHandle,
    registry: &DownloadRegistry,
    url: String,
    format: Format,
    output_dir: String,
) -> Result<DownloadStarted, String> {
    // ponytail: one lock; reject concurrent downloads (REQ-8).
    let mut guard = registry.inner.lock().await;
    if !guard.is_empty() {
        return Err("Another download is already in progress.".into());
    }

    let id = Uuid::new_v4().to_string();
    let args = build_args(&url, &format, &output_dir)?;
    let mut child = Command::new("yt-dlp")
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp: {e}. Is it installed and on PATH?"))?;

    let stdout = child.stdout.take().ok_or("no stdout pipe")?;
    let app_for_task = app.clone();
    let id_for_task = id.clone();
    let registry_arc = registry.inner.clone();

    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        let mut last_emit = std::time::Instant::now();
        while let Ok(Some(line)) = reader.next_line().await {
            // Debounce: ≤ 10 events/sec.
            if last_emit.elapsed() < std::time::Duration::from_millis(100) { continue; }
            last_emit = std::time::Instant::now();
            if let Some(ev) = parse_progress(&line, &id_for_task) {
                let _ = app_for_task.emit("youtube://progress", ev);
            }
        }
        let status = child.wait().await.ok();
        let final_ev = ProgressEvent {
            id: id_for_task.clone(),
            percent: None,
            eta: None,
            speed: None,
            status: match status {
                Some(s) if s.success() => ProgressStatus::Finished,
                _ => ProgressStatus::Error,
            },
            error: None,
        };
        let _ = app_for_task.emit("youtube://progress", final_ev);
        registry_arc.lock().await.remove(&id_for_task);
    });

    guard.insert(id.clone(), child);
    Ok(DownloadStarted { id })
}
```

`parse_progress()` reads the yt-dlp `[download]  47.3% of ~50MiB at 5MiB/s ETA 00:08` line format with a single small regex. Falls through to `None` for non-progress lines.

`build_args()` maps `Format` enum → yt-dlp flags (REQ-4).

### `cancel(registry, id)`
Lock, remove, call `child.kill().await`. Idempotent.

### `commands.rs` additions
- `check_yt_dlp() -> bool`
- `download_youtube(url, format, output_dir, app, registry) -> Result<DownloadStarted, String>`
- `cancel_download(id, registry) -> Result<(), String>`

### `main.rs` additions
Register the three commands in `invoke_handler!` and add `DownloadRegistry::default()` to `AppState`.

### State
Add `pub youtube: Arc<DownloadRegistry>` to `AppState`.

## TypeScript side

### `src/icons.ts` — add `youtubeIcon`
A play-triangle in a rounded square. Follows existing `Lucide`-style SVG factories.

### `src/lib/tauri.ts` — typed wrappers
```ts
export type YoutubeFormat = "bestVideo" | "bestAudio" | "mp3";

export interface YoutubeProgress {
  id: string;
  percent?: number;
  eta?: string;
  speed?: string;
  status: "downloading" | "finished" | "error";
  error?: string;
}

// under tauri namespace:
checkYtDlp: () => invoke<boolean>("check_yt_dlp"),
downloadYoutube: (url: string, format: YoutubeFormat, outputDir: string) =>
  invoke<{ id: string }>("download_youtube", { url, format, outputDir }),
cancelDownload: (id: string) => invoke<void>("cancel_download"),
onYoutubeProgress: (fn: (p: YoutubeProgress) => void): Promise<UnlistenFn> =>
  listen<YoutubeProgress>("youtube://progress", e => fn(e.payload)),
```

### `src/sections/youtube.ts`
Renders the form (REQ-2), wires the folder picker via `@tauri-apps/plugin-dialog`, calls `check_yt_dlp` on mount, toggles UI based on availability, manages button disabled state, listens to progress events, updates the `<progress>` element, on `finished`/`error` re-enables the form and pops a Win98-style alert via the existing notification path (or a simple `alert()` for v1).

Returns a `SectionController` whose `destroy()` unregisters the progress listener.

### `src/sections/types.ts`
Add `"youtube"` to `SectionId` union.

### `src/main.ts`
Add `youtube: youtubeSection` to `SECTIONS`.

### `src-tauri/capabilities/default.json`
Add `"dialog:allow-save"` to `permissions`.

## Why these choices
- **tokio::process + Rust state**, not `tauri-plugin-shell`: matches the existing `server.rs` exactly, no new dependencies, no new permissions surface.
- **System PATH yt-dlp**: matches the existing "install LexiLocal backend" onboarding model; if it bites, sidecar is a follow-up.
- **Single concurrent download**: keeps state simple, matches v1 scope, user can re-trigger after the first finishes.
- **Debounced events at 10/sec**: yt-dlp can print thousands of lines; flooding the event bus freezes the UI thread.
- **`<progress>` element under 98.css**: no new component, Win98 renders it as a striped bar out of the box.

## What we explicitly skip
- Sidecar bundling (Ponytail: defer until a real user complains).
- Playlists (REQ-4: `--no-playlist`).
- Format dropdown beyond 3 options (Ponytail: YAGNI).
- File rename / open-after-download buttons (YAGNI).
- Tests — no test runner on either side, and the surface is mostly thin UI + one shell-out. A manual smoke check (download one video) is the verification (see tasks).

## Known ceiling
- yt-dlp auto-updates ~weekly. v1 will fall behind unless the user runs `yt-dlp -U`. Document this in the section's "?" tooltip in a follow-up if it bites.
- Windows-only validated; macOS/Linux should work but are not exercised here.
