# Verify Report — yt-dlp-integration

## Status
**ok** — implementation matches proposal, spec, and design. Both builds pass. No scope drift beyond pre-existing working-tree mods from prior sessions.

## Build verification
- `cargo check` (from `src-tauri/`): **pass** — `Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.63s`, zero new errors, zero new warnings
- `npm run build` (tsc + vite): **pass** — `built in 204ms`, zero TS errors

## Spec coverage (REQ-1..REQ-10)

| REQ | Summary | Satisfied | Evidence |
|---|---|---|---|
| REQ-1 | Section in sidebar | ✅ | `src/main.ts:18` registers `youtube: youtubeSection`; `src/sections/types.ts:16` adds `"youtube"` to SectionId union; `src/icons.ts:61` defines `youtubeIcon` |
| REQ-2 | URL/format/destination/Download/Cancel form | ✅ | `src/sections/youtube.ts:21-51` renders the form with all five controls |
| REQ-3 | yt-dlp availability check on open | ✅ | `src/sections/youtube.ts:84-96` calls `tauri.checkYtDlp()`; `src-tauri/src/youtube.rs:82-89` implements `check_available()` via `yt-dlp --version` |
| REQ-4 | Spawn yt-dlp from Rust with correct args | ✅ | `src-tauri/src/youtube.rs:91-112` `build_args()` constructs the exact flag set per format; `:131-154` `start()` spawns via `tokio::process::Command` with `kill_on_drop(true)` |
| REQ-5 | Progress streaming, debounced | ✅ | `src-tauri/src/youtube.rs:114-129` parses `[download] X% ... at Y ... ETA Z`; `:164-176` debounces at 100ms (≤10/sec); emits via `app_for_task.emit("youtube://progress", ...)` |
| REQ-6 | Cancel is idempotent | ✅ | `src-tauri/src/youtube.rs:212-224` `cancel()` — `remove()` returns `Option`, `if let` makes missing-id a no-op returning `Ok(())` |
| REQ-7 | Error surfacing via final event | ✅ | `src-tauri/src/youtube.rs:185-204` emits final event with `status: Error` (or `Finished` on success); frontend `src/sections/youtube.ts:165-176` shows alert with error message |
| REQ-8 | Concurrent downloads blocked | ✅ | `src-tauri/src/youtube.rs:138-141` rejects with `"Another download is already in progress."` when registry is non-empty |
| REQ-9 | Cleanup on app exit | ✅ | `src-tauri/src/youtube.rs:150` `kill_on_drop(true)` reaps the child if Tauri exits mid-download |
| REQ-10 | No new shell permissions | ✅ | `src-tauri/Cargo.toml` does NOT add `tauri-plugin-shell`; `src-tauri/capabilities/default.json` only adds `dialog:allow-save` (already verified: `cargo check` passes without shell plugin) |

## Scenario coverage (S-1..S-7)

| Scenario | Covered | Evidence |
|---|---|---|
| S-1 | Happy path mp4 | start() spawns with `-f bv*+ba/b`; frontend listens, updates `<progress>`, re-enables on `finished` |
| S-2 | Audio-only mp3 | Format::Mp3 branch builds `-x --audio-format mp3` |
| S-3 | yt-dlp not on PATH | check_available() returns false on spawn failure; frontend hides form |
| S-4 | Invalid URL | yt-dlp itself fails fast; child exits non-zero; final event status=Error propagates to UI |
| S-5 | Cancel mid-download | cancel() sets AtomicBool + kills child; spawned task emits final event with error="cancelled" |
| S-6 | Concurrent second download | start() guard at line 139 rejects when registry non-empty |
| S-7 | Network failure | yt-dlp exits non-zero on network errors; final event status=Error |

## Drift check
Pre-existing working-tree mods unrelated to this change (NOT touched by this apply):
- `package.json` / `package-lock.json`: `98.css` dep addition (from prior Win98 retheme session, see engram observation `[decision] Win98 UI retheme with 98.css`)
- `src/styles.css`: large rewrite to use 98.css (same prior session)
- `src-tauri/src/server.rs`: PID validation retry loop (from prior bugfix session, see engram observation `[bugfix] Fixed start_server PID validation race`)

This apply session's net diff (excluding pre-existing mods): ~280 added lines across 2 new files + 8 modified files.

## Risks
- **WARNING** (non-blocking): yt-dlp stderr is captured but not surfaced on error events. Spec REQ-7 only required surfacing error status, which is satisfied. Final UI alert shows the status code but not yt-dlp's diagnostic text. Acceptable for v1; could be improved by piping stderr and extracting the last useful line in a follow-up.
- **WARNING** (non-blocking): Manual smoke checks in T-10 are user-driven and unverified by the runtime (no test runner, no live yt-dlp invocation). Expected — out of scope for the build-based verifier.

## Conclusion
Implementation is structurally correct and compiles cleanly. No CRITICAL findings. Recommend archive.
