# yt-dlp Integration — Proposal

## What
Add a new sidebar section **"YouTube"** to Codex-Astartes that downloads audio/video from YouTube (and other yt-dlp-supported sites) into a user-chosen folder, using [yt-dlp](https://github.com/yt-dlp/yt-dlp) as an external binary.

## Why
The user wants to download YouTube files easily from inside the desktop UI, without opening a browser or terminal. yt-dlp is the de-facto tool for this and supports hundreds of sites, not just YouTube — so the same section also covers Twitter, Vimeo, etc. for free.

## Scope (in)
- New sidebar section registered alongside Chat, Translate, Tools, REST, Activity, Settings.
- Backend `#[tauri::command]` that spawns `yt-dlp.exe` via `tokio::process::Command`, streams progress to the UI via Tauri events, writes the file to a user-picked folder.
- Simple format choice (Best video / Audio only / Audio MP3) — not a format maze.
- Cancel button that kills the running yt-dlp child process.
- Error reporting back to the UI (network, invalid URL, missing ffmpeg, missing yt-dlp on PATH).

## Scope (out)
- Bundling `yt-dlp.exe` as a Tauri sidecar (v2 follow-up; v1 requires it on PATH).
- Playlist support — single video per download for v1.
- Subtitle download, metadata editing, sponsor-block.
- Authentication (cookies, login).
- macOS / Linux packaging polish — Windows-only validated, others untested but should work since the spawn is portable.

## Approach (one-line)
Spawn the system-installed `yt-dlp` (Windows: `yt-dlp.exe` on PATH) via Rust `tokio::process`, mirror the existing `server.rs` pattern, stream stdout progress lines as `youtube://progress` events, save the file into a folder the user picks via the existing `@tauri-apps/plugin-dialog` save flow.

## Alternatives considered
- **Bundle yt-dlp as Tauri sidecar (`externalBin`)** — friction-free for users, but adds ~50 MB to the installer, requires a release-channel sync script, and pulls in `tauri-plugin-shell` for nothing. Defer to v2 if the friction of "install yt-dlp once" turns out to be real.
- **Shell out to `python -m yt_dlp`** — requires Python + pip on the user's machine. Strictly worse than a standalone `yt-dlp.exe`.

## Risks
- **yt-dlp not installed**: user-facing error "yt-dlp not found on PATH. Install from https://github.com/yt-dlp/yt-dlp and try again." — surfaced via a `check_yt_dlp` command and a one-time check on section open.
- **ffmpeg missing**: most formats require ffmpeg for muxing; yt-dlp itself reports this clearly — we surface its stderr verbatim.
- **Long-running process blocks the command**: we use `tokio::process::Command::spawn()` (not `output()`), pipe stdout asynchronously, and keep a `Mutex<Option<Child>>` so cancel can `child.kill().await`.

## Files affected (estimate)
- `src/sections/youtube.ts` (new)
- `src/sections/types.ts` (add `"youtube"` to SectionId)
- `src/main.ts` (register section)
- `src/icons.ts` (new `youtubeIcon`)
- `src/lib/tauri.ts` (typed wrappers)
- `src-tauri/src/youtube.rs` (new)
- `src-tauri/src/commands.rs` (new commands)
- `src-tauri/src/main.rs` (register commands)
- `src-tauri/src/state.rs` or inline in commands.rs (download handle)
- `src-tauri/capabilities/default.json` (add `dialog:allow-save`)
- `src/styles.css` (minor — progress bar styling under 98.css)

≈ 10 files, ~250–350 changed lines. Comfortably under the 400-line single-PR budget.
