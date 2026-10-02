# yt-dlp Self-Update Button — Spec

## Purpose
Let the user update yt-dlp from inside the YouTube sidebar section with one click, instead of leaving the app to find the release page and replace the binary manually.

## Requirements

### REQ-1: Button visible in the YouTube section
A small button labeled **"Update yt-dlp"** MUST appear in the YouTube section, below the "yt-dlp not found" message block OR adjacent to the form (above the Download/Cancel row). Visual style: secondary Win98 button (matches existing "Cancel" and "Choose folder…" buttons).

### REQ-2: Clicking the button calls `update_yt_dlp`
The button click handler MUST call `tauri.updateYtDlp()`. No URL or other arguments are required.

### REQ-3: Disabled state during update
While the `updateYtDlp()` promise is pending, the button MUST be disabled and its label MUST change to `"Updating…"`. After the promise resolves (success or failure), the button MUST be re-enabled with its original label.

### REQ-4: Success
If the Rust command returns `Ok(message)`, the UI MUST display a Win98-style alert: `yt-dlp updated: <message>`. The message is yt-dlp's stdout (typically `"Updated yt-dlp to <version>"` or `"yt-dlp is up to date (latest: <version>)"`).

### REQ-5: Failure
If the Rust command returns `Err(message)`, the UI MUST display a Win98-style alert: `Update failed: <message>`. The message is the last useful stderr line from yt-dlp (typically starts with `ERROR:` or contains the actionable hint).

### REQ-6: Backend command
`update_yt_dlp` MUST spawn `yt-dlp -U` via `tokio::process::Command` (no plugin-shell, matching the existing pattern). It MUST capture both stdout and stderr. On exit code 0, it MUST return `Ok(stdout_trimmed)`. On non-zero exit, it MUST return `Err(last_useful_stderr_line_or_fallback)`.

### REQ-7: No new permissions
Because the subprocess is spawned from Rust via `tokio::process::Command`, NO `tauri-plugin-shell` is added and NO new capability entry is required. The capability file (`src-tauri/capabilities/default.json`) MUST NOT be modified.

### REQ-8: Reuse existing extract pattern
The stderr extraction MUST reuse the same "prefer last `ERROR:` line, fallback to last non-empty line" logic from the existing `start()` path. If extracting fails, return `"yt-dlp -U exited with code <code>"`.

### REQ-9: Not blocked by download in progress
The update button MUST work whether or not a download is running. It is independent of `DownloadRegistry`.

## Scenarios

### S-1: pip-installed yt-dlp, has an update
Given yt-dlp is installed via pip and a newer version is available,
When the user clicks "Update yt-dlp",
Then the button shows "Updating…" and is disabled, then re-enables and an alert shows `yt-dlp updated: Updated yt-dlp to <new_version>`.

### S-2: pip-installed yt-dlp, already up to date
Given yt-dlp is the latest version,
When the user clicks "Update yt-dlp",
Then an alert shows `yt-dlp updated: yt-dlp is up to date (latest: <version>)`. (yt-dlp itself treats this as a successful exit code 0 with stdout saying "up to date".)

### S-3: standalone .exe installation
Given yt-dlp is the standalone .exe (no pip),
When the user clicks "Update yt-dlp",
Then `yt-dlp -U` exits non-zero, the alert shows `Update failed: ERROR: <whatever yt-dlp -U says for standalone>, e.g. "ERROR: You installed yt-dlp with a package manager or via a wheel directly; cannot update. To update, run `pip install -U yt-dlp` instead."`. The user knows what to do.

### S-4: yt-dlp not installed
Given yt-dlp is not on PATH,
When the user clicks "Update yt-dlp",
Then the Rust command fails with a spawn error (no yt-dlp to invoke), the alert shows `Update failed: Failed to spawn yt-dlp: <error>. Is it installed and on PATH?`. The user sees the existing "yt-dlp not found" UI hint.

### S-5: No internet
Given yt-dlp is installed but the network is down,
When the user clicks "Update yt-dlp",
Then `yt-dlp -U` exits non-zero with stderr mentioning the network, the alert shows the relevant line.

## Non-functional
- Button MUST NOT freeze the UI thread; the invoke is async (already true for `tauri.*` wrappers).
- All UI strings MUST match the Win98 sentence-case style of the rest of the app.
- Code MUST compile under `cargo check` and `tsc -b --noEmit` with zero new warnings.
