# Apply Progress — yt-dlp-self-update

## Summary
All 7 tasks from `tasks.md` implemented. Both `cargo check` and `npm run build` pass clean.

## Verification
- `cargo check` from `src-tauri/`: **pass** — `Finished `dev` profile [unoptimized + debuginfo] target(s) in 2.34s`
- `npm run build` (tsc + vite): **pass** — `built in 320ms`

## Files created
(none — all changes are extensions of existing files)

## Files modified
- `src-tauri/src/youtube.rs` — added `update()` function (~30 lines): spawns `yt-dlp -U` via `tokio::process::Command::output()`, reuses existing `extract_last_error()` for stderr parsing
- `src-tauri/src/commands.rs` — added `update_yt_dlp` Tauri command
- `src-tauri/src/main.rs` — added `update_yt_dlp` to `use commands::{...}` and to `invoke_handler!`
- `src/lib/tauri.ts` — added `updateYtDlp: () => invoke<string>("update_yt_dlp")` typed wrapper
- `src/sections/youtube.ts` — added `<button id="yt-update">`, query selector, click handler with disabled state and label change

## Implementation notes
- `update()` uses `Command::output()` (not spawn) — update is short-lived (seconds), no progress streaming needed.
- `stdin(Stdio::null())` prevents blocking on interactive pip prompts.
- Reuses `extract_last_error()` from the previous stderr-surfacing fix.
- No new Tauri permission needed (REQ-7).
- No new dependency needed.

## Out of scope (not done, intentional)
- Sidecar / standalone-binary download (YAGNI)
- Auto-update scheduling (YAGNI)
- Restart-after-replace (not needed for pip installs)

## Manual smoke checks (T-7, user-driven)
- [ ] Click "Update yt-dlp" — button shows "Updating…", then either success or error alert appears.
- [ ] (Optional) Click again after success — should show "yt-dlp is up to date" message.
