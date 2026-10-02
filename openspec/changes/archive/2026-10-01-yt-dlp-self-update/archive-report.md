# Archive Report — yt-dlp-self-update

## Change
yt-dlp-self-update — adds an "Update yt-dlp" button to the YouTube sidebar section.

## Scope
Single-PR feature: button + Rust command that runs `yt-dlp -U`, surfaces stdout/stderr to the user. 5 files modified, ~80 added lines.

## Files modified
- `src-tauri/src/youtube.rs` — added `update()` function (~30 lines)
- `src-tauri/src/commands.rs` — added `update_yt_dlp` command
- `src-tauri/src/main.rs` — added import + invoke_handler entry
- `src/lib/tauri.ts` — added `updateYtDlp` typed wrapper
- `src/sections/youtube.ts` — added button + click handler

## Verification outcome
PASS (per verify-report.md): all 9 REQs and 5 scenarios structurally satisfied; cargo check + npm run build both pass clean.

## Promote location
- Main spec promoted to: `openspec/specs/youtube/update-button.md` (extends the existing youtube spec; original `openspec/specs/youtube/spec.md` left intact)
- Change folder archived to: `openspec/changes/archive/2026-10-01-yt-dlp-self-update/`

## Risks
- WARNING: Manual smoke checks (T-7) are user-driven.
- NOTE: `yt-dlp -U` only works for pip-installed yt-dlp; standalone .exe users see an actionable error (intentional trade-off accepted by user).

## SDD cycle complete.
