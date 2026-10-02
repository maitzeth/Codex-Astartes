# YouTube Downloader — Spec

## Purpose
Let the user paste a URL into the Codex-Astartes sidebar, pick a quality/format, choose a destination folder, and download a media file via yt-dlp with live progress.

## Requirements

### REQ-1: Section visible in sidebar
The sidebar nav list MUST include a new "YouTube" item, placed after "Tools" and before "REST", with a play-button-style icon.

### REQ-2: URL input + format selector + destination
The section MUST render a Win98-styled form with:
- a text input for the URL (placeholder `https://...`),
- a dropdown with three options: `Best video (mp4)`, `Best audio (m4a)`, `Audio only (mp3)`,
- a "Choose folder…" button that opens the native folder picker via `@tauri-apps/plugin-dialog`,
- a "Download" button (disabled until URL is non-empty AND a folder is chosen),
- a "Cancel" button (disabled until a download is running).

### REQ-3: yt-dlp availability check on section open
When the section is activated, the UI MUST call `check_yt_dlp()`. If the result is `false`, the form MUST be replaced with a friendly "yt-dlp not found on PATH" message linking to https://github.com/yt-dlp/yt-dlp/releases.

### REQ-4: Spawn yt-dlp from Rust
`download_youtube(url, format, output_dir)` MUST spawn `yt-dlp` (Windows: `yt-dlp.exe`) via `tokio::process::Command` with arguments:
- `--no-playlist`
- `--newline` (so progress lines are flushed)
- `--output <output_dir>/%(title)s.%(ext)s`
- one of `-f "bv*+ba/b"` (best video+audio), `-f "bestaudio"` (m4a), `-x --audio-format mp3` (mp3 extract)
- the URL

The command MUST return `Result<DownloadStarted, String>` where `DownloadStarted` carries an `id: String` (uuid) the frontend uses to listen for events.

### REQ-5: Progress streaming
While yt-dlp runs, the Rust side MUST parse each line of stdout and emit `youtube://progress` events with payload `{ id, percent, eta, speed, status: "downloading" | "finished" | "error" }`. The UI MUST show a progress bar (98.css `<progress>`) updating in place.

### REQ-6: Cancel
`cancel_download(id)` MUST kill the running child process for that id. If no process is registered for the id, it MUST return `Ok(())` (idempotent).

### REQ-7: Error surfacing
If yt-dlp exits with non-zero status, the Rust side MUST emit a final `youtube://progress` event with `status: "error"` and `error: String` (the last useful line of stderr/stdout), then return `Err(String)` from the command so the frontend also shows a Win98 alert.

### REQ-8: Concurrent downloads
The state MUST track at most one running download at a time (single `Mutex<Option<ChildHandle>>`). A second `download_youtube` call while one is in flight MUST return `Err("Another download is already in progress.")`.

### REQ-9: Cleanup on app exit
The `setup` hook MUST NOT be changed (no global registry needed) — the OS reaps children when the Tauri process exits.

### REQ-10: No new permissions for shell execution
Because the subprocess is spawned from Rust via `tokio::process::Command`, NO `tauri-plugin-shell` is added and NO shell permission entry is required in `capabilities/default.json`. The only capability addition is `dialog:allow-save` (REQ-2 folder picker).

## Scenarios

### S-1: Happy path — single mp4 download
Given the user activates the YouTube section, yt-dlp is installed, and they paste `https://www.youtube.com/watch?v=...`, choose "Best video (mp4)", pick `C:\path\to\Downloads`, and click Download,
When the download runs,
Then the progress bar advances from 0% → 100%, the final event reports `status: "finished"` with the saved path, and the form re-enables for another download.

### S-2: Audio-only mp3 extraction
Given the user picks "Audio only (mp3)",
When the download completes,
Then a single `.mp3` file exists in the chosen folder, and yt-dlp's post-processing (requires ffmpeg) succeeds or fails with a clear error if ffmpeg is missing.

### S-3: yt-dlp not on PATH
Given yt-dlp is not installed,
When the user activates the YouTube section,
Then the form is hidden, and a message displays: "yt-dlp not found on PATH. Install it from https://github.com/yt-dlp/yt-dlp/releases and restart the app."

### S-4: Invalid URL
Given the user enters a non-URL string,
When they click Download,
Then yt-dlp fails within a few seconds, the UI shows an error event, and the form re-enables.

### S-5: Cancel mid-download
Given a download is at 47%,
When the user clicks Cancel,
Then the child process is killed, a final `status: "error"` event with `error: "cancelled"` is emitted, and the form re-enables.

### S-6: Two concurrent downloads
Given a download is running,
When the user clicks Download again (somehow),
Then the command returns an error toast "Another download is already in progress." and no second child is spawned.

### S-7: Network failure
Given the user has no internet,
When they click Download,
Then yt-dlp fails with a clear error (e.g., "Unable to download webpage: ..."), the error is surfaced, the form re-enables.

## Non-functional
- Progress events MUST debounce on the Rust side to ≤ 10/sec to avoid flooding the event bus.
- All UI strings MUST be lowercase / sentence-case to match the Win98 aesthetic of the rest of the app.
- All code MUST compile under `cargo check` and `tsc -b --noEmit` with zero new warnings.
