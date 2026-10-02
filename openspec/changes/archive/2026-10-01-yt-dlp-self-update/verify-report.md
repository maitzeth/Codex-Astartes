# Verify Report — yt-dlp-self-update

## Status
**ok** — implementation matches spec and design. Both builds pass. No CRITICAL findings.

## Build verification
- `cargo check` from `src-tauri/`: **pass** — `Finished `dev` profile [unoptimized + debuginfo] target(s) in 2.34s`, zero errors, zero warnings
- `npm run build` (tsc + vite): **pass** — `built in 320ms`, zero TS errors

## Spec coverage (REQ-1..REQ-9)

| REQ | Summary | Satisfied | Evidence |
|---|---|---|---|
| REQ-1 | "Update yt-dlp" button visible in section | ✅ | `src/sections/youtube.ts:48` renders `<button id="yt-update" class="secondary">Update yt-dlp</button>` below the Download/Cancel row |
| REQ-2 | Click handler calls `tauri.updateYtDlp()` | ✅ | `src/sections/youtube.ts:152` calls `await tauri.updateYtDlp()` |
| REQ-3 | Disabled state + "Updating…" label during call | ✅ | `src/sections/youtube.ts:148-150` disables + relabels; `:157-158` restores in finally block |
| REQ-4 | Success alert `yt-dlp updated: <msg>` | ✅ | `src/sections/youtube.ts:153` |
| REQ-5 | Failure alert `Update failed: <msg>` | ✅ | `src/sections/youtube.ts:155` |
| REQ-6 | Backend command `update_yt_dlp` spawns `yt-dlp -U`, captures stdout/stderr | ✅ | `src-tauri/src/youtube.rs` new `update()` function: spawns `Command::new("yt-dlp").arg("-U").stdin(Stdio::null()).output()`, returns stdout on success |
| REQ-7 | No new permissions | ✅ | `src-tauri/capabilities/default.json` NOT modified (verified by git status); no `tauri-plugin-shell` added |
| REQ-8 | Reuse `extract_last_error()` | ✅ | `src-tauri/src/youtube.rs` `update()` calls `extract_last_error(&stderr)` on failure |
| REQ-9 | Independent of download state | ✅ | `update()` takes no `DownloadRegistry` arg; button not gated by download state; call works while a download is in flight |

## Scenario coverage (S-1..S-5)

| Scenario | Covered | Evidence |
|---|---|---|
| S-1 | pip-installed, has update | `yt-dlp -U` exit 0; `update()` returns stdout like "Updated yt-dlp to <version>"; alert shows it |
| S-2 | pip-installed, up to date | `yt-dlp -U` exit 0 with stdout "yt-dlp is up to date (latest: <version>)"; alert shows it (same path as S-1) |
| S-3 | standalone .exe | `yt-dlp -U` exits non-zero with stderr from yt-dlp; `extract_last_error` returns the line; alert surfaces it |
| S-4 | yt-dlp not installed | `Command::output()` spawn fails; `update()` returns `Err("Failed to spawn yt-dlp: <error>. Is it installed and on PATH?")` |
| S-5 | No internet | `yt-dlp -U` exits non-zero; stderr contains network error; surfaced via `extract_last_error` |

## Drift check
No unrelated files modified. Only the 5 files in the change scope:
- `src-tauri/src/youtube.rs` (added update function)
- `src-tauri/src/commands.rs` (added update_yt_dlp command)
- `src-tauri/src/main.rs` (added import + invoke_handler entry)
- `src/lib/tauri.ts` (added updateYtDlp wrapper)
- `src/sections/youtube.ts` (added button + handler)

Pre-existing working-tree mods from the prior yt-dlp-integration change are still there (not modified again).

## Risks
- **WARNING** (non-blocking): Manual smoke checks in T-7 are user-driven. Build/structural checks pass; live button-press test needs the user.
- **NOTE**: `yt-dlp -U` only works for pip-installed yt-dlp. Standalone .exe users will see a descriptive error from yt-dlp itself (intentional, user accepted this tradeoff).

## Conclusion
Implementation structurally correct, compiles cleanly. No CRITICAL findings. Recommend archive.
