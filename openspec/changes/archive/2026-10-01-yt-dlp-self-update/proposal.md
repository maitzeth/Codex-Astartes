# yt-dlp Self-Update Button — Proposal

## What
Add an "Update yt-dlp" button to the YouTube sidebar section that runs `yt-dlp -U` via the existing Rust subprocess pattern, surfaces the result to the user, and is intentionally minimal (works only when yt-dlp was installed via `pip install yt-dlp`; standalone `.exe` will get a clear error message).

## Why
User hit a stale yt-dlp (90+ days old) that couldn't extract YouTube formats. After the stderr-surfacing fix from the previous bug, the error is now visible — but the user still has to leave the app, open a browser, find the release page, download, and replace. A one-click "Update" via the built-in `yt-dlp -U` shortcut (when applicable) is the laziest help we can offer.

## Scope (in)
- New Rust command `update_yt_dlp` in `src-tauri/src/youtube.rs` that spawns `yt-dlp -U`, captures stdout+stderr, returns `Result<String, String>` (stdout on success, last useful error line on failure).
- Button in the YouTube section UI: "Update yt-dlp", with disabled state during the call and an alert on completion.
- Typed wrapper `updateYtDlp` in `src/lib/tauri.ts`.

## Scope (out)
- Auto-detect standalone `.exe` and redirect to GitHub releases page. (YAGNI — error message already tells the user; they can copy-paste the URL.)
- Restart-the-app-after-replace flow. (YAGNI — not needed for `-U` since pip-installed yt-dlp replaces itself in place.)
- Schedule auto-updates. (YAGNI — user-driven only.)

## Approach
Spawn `yt-dlp -U` via `tokio::process::Command`, capture stdout (which contains lines like "Updated yt-dlp to ..." or "yt-dlp is up to date") and stderr (which contains errors like "ERROR: Cannot update to the latest version. Try again later." or for standalone .exe "ERROR: You installed yt-dlp with a package manager or it was not installed at all; cannot update"). On exit code 0 → return stdout; else → return the last useful stderr line. Frontend shows success/error alert. Button disabled during the call to prevent double-clicks.

## Alternatives considered
- **Download-and-replace the .exe from GitHub**: ~100-150 lines, needs fs write scope, restart logic. Deferred — error message points to GitHub anyway.
- **Show only version + warning if old**: alternative path; user picked the button option.

## Risks
- `yt-dlp -U` itself runs `pip install -U yt-dlp` under the hood; it needs `pip` on PATH. If pip is missing or yt-dlp wasn't installed via pip, the command will fail and the user sees the error.
- This is a feature for the 50% of users who installed yt-dlp via pip. Standalone `.exe` users will see an error — but they have a clear URL to fix it.

## Files affected (estimate)
- `src-tauri/src/youtube.rs` — new `update()` function (~25 lines)
- `src-tauri/src/commands.rs` — new `update_yt_dlp` command
- `src-tauri/src/main.rs` — register command in invoke_handler!
- `src/lib/tauri.ts` — new typed wrapper
- `src/sections/youtube.ts` — new button + alert wiring

≈ 5 files, ~50-80 changed lines. Single-PR scope, well under budget.
