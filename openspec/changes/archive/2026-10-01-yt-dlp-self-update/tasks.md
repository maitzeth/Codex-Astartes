# Tasks — yt-dlp-self-update

### T-1: Add `update()` function in `src-tauri/src/youtube.rs`
- [x] Add `pub async fn update() -> Result<String, String>` that spawns `yt-dlp -U` via `tokio::process::Command::output()`.
- [x] Set `stdin(Stdio::null())` to avoid blocking on interactive prompts.
- [x] On exit code 0, return `Ok(stdout.trim())`.
- [x] On non-zero, reuse existing `extract_last_error()` on stderr; fallback to `"yt-dlp -U exited with code <code>"`.
- **Verify**: `cargo check` passes ✓

### T-2: Add `update_yt_dlp` command in `src-tauri/src/commands.rs`
- [x] Add `#[tauri::command] pub async fn update_yt_dlp() -> Result<String, String>` that calls `youtube::update().await`.
- **Verify**: `cargo check` passes ✓

### T-3: Register command in `src-tauri/src/main.rs`
- [x] Add `update_yt_dlp` to the `invoke_handler!` macro list.
- [x] Add `update_yt_dlp` to the `use commands::{...}` import.
- **Verify**: `cargo check` passes ✓

### T-4: Add typed wrapper in `src/lib/tauri.ts`
- [x] Add `updateYtDlp: () => invoke<string>("update_yt_dlp")` under the `tauri` namespace.
- **Verify**: `tsc -b --noEmit` passes ✓

### T-5: Add button + handler in `src/sections/youtube.ts`
- [x] Insert a `<button id="yt-update" class="secondary">Update yt-dlp</button>` in the form, above the Download/Cancel row.
- [x] Wire `click` listener: disable button, set label to `"Updating…"`, call `tauri.updateYtDlp()`, show success or error alert, re-enable button and restore label.
- **Verify**: `tsc -b --noEmit` passes ✓

### T-6: Build checks
- [x] `cargo check` from `src-tauri/` — zero errors, zero new warnings.
- [x] `npm run build` — succeeds.

### T-7: Manual smoke test
- [ ] (User-driven) Click "Update yt-dlp". Button shows "Updating…", then either the success alert or error alert appears.
- [ ] (Optional, pip install only) Click again after success — should show "yt-dlp is up to date" message.
