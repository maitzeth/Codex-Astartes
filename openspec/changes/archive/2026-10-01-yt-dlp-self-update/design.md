# yt-dlp Self-Update Button — Design

## Architecture

Mirror the existing `check_available()` and `start()` patterns in `src-tauri/src/youtube.rs`. No new dependencies. No new Tauri plugin. No new capability.

```
┌─────────────────────────┐     invoke("update_yt_dlp")     ┌──────────────────────────────┐
│ src/sections/youtube.ts │ ───────────────────────────────► │ src-tauri/src/commands.rs    │
│  - "Update yt-dlp" btn  │                                  │  update_yt_dlp(cmd)          │
│  - disabled during call │ ◄─────── Ok(stdout) ──────────── │   └─► youtube::update()      │
│  - alert on completion  │ ◄─────── Err(stderr) ──────────── └─────────────┬────────────────┘
└─────────────────────────┘                                                  │ tokio::process::Command
                                                                              ▼
                                                                  ┌────────────────────────────┐
                                                                  │ yt-dlp -U                  │
                                                                  │ stdout + stderr captured   │
                                                                  └────────────────────────────┘
```

## Rust side

### New function in `src-tauri/src/youtube.rs`

```rust
pub async fn update() -> Result<String, String> {
    let output = tokio::process::Command::new("yt-dlp")
        .arg("-U")
        .stdin(Stdio::null())    // yt-dlp may prompt; don't block on stdin
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
        // Reuse the existing extract_last_error logic.
        Err(extract_last_error(&stderr)
            .unwrap_or_else(|| format!("yt-dlp -U exited with code {:?}", output.status.code())))
    }
}
```

Notes:
- `stdin(Stdio::null())` prevents yt-dlp from blocking on an interactive prompt (e.g., "Do you want to update?" — which newer pip-installed versions may show).
- `Command::output()` (not spawn) is fine here because update is short-lived (seconds, not minutes like a download).
- Reuses `extract_last_error()` from `youtube.rs` — same stderr-parsing logic as `start()`.

### Command wrapper in `src-tauri/src/commands.rs`

```rust
#[tauri::command]
pub async fn update_yt_dlp() -> Result<String, String> {
    youtube::update().await
}
```

### `main.rs` registration

Add `update_yt_dlp` to `invoke_handler!`.

## TypeScript side

### `src/lib/tauri.ts` — typed wrapper

```ts
updateYtDlp: () => invoke<string>("update_yt_dlp"),
```

### `src/sections/youtube.ts` — button + alert

Insert into the existing form, just above the Download/Cancel row:

```html
<button id="yt-update" class="secondary">Update yt-dlp</button>
```

Wire it up in `render()`:

```ts
const updateBtn = root.querySelector<HTMLButtonElement>("#yt-update")!;
updateBtn.addEventListener("click", async () => {
  updateBtn.disabled = true;
  const originalLabel = updateBtn.textContent;
  updateBtn.textContent = "Updating…";
  try {
    const msg = await tauri.updateYtDlp();
    showAlert(`yt-dlp updated: ${msg}`);
  } catch (err) {
    showAlert(`Update failed: ${err}`);
  } finally {
    updateBtn.textContent = originalLabel;
    updateBtn.disabled = false;
  }
});
```

The button is independent of the download state — clicking it while a download is running is allowed (REQ-9).

## Why these choices
- **`Command::output()` instead of `spawn()`**: update is short and synchronous — no need for progress streaming. Simpler than reusing the download machinery.
- **No new permission, no new plugin**: stays consistent with the existing `server.rs` + `start()` pattern.
- **Independent of download state**: simpler logic, no registry coupling. User can update yt-dlp while a download is queued (well, downloads block, but update isn't blocked by it).
- **Reuse `extract_last_error()`**: same error-extraction behavior as `start()` so the alert UX is consistent.

## What we explicitly skip
- Sidecar / standalone-binary download (YAGNI — error message is actionable enough).
- Auto-update scheduling (YAGNI — user-driven only).
- Restart-after-replace (not needed for pip installs).
- `pip install -U yt-dlp` direct invocation as a fallback (yt-dlp -U already wraps this).

## Known ceiling
- `yt-dlp -U` only works for pip-installed yt-dlp. Standalone .exe users will see an error. That's the documented trade-off the user accepted.
- yt-dlp's `-U` may print pip's progress to stderr mixed with its own output; the last-ERROR-line extraction should still surface the real error if one occurs.
