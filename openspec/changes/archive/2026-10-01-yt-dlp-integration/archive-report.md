# Archive Report — yt-dlp-integration

## Change
yt-dlp-integration

## Scope
Add a YouTube downloader section to the Codex-Astartes sidebar that spawns yt-dlp from Rust with live progress, cancel, and single-flight enforcement.

## Verification outcome
`verify-report.md` status: **ok** — `cargo check` and `npm run build` both pass with zero new warnings. All 10 requirements and 7 scenarios satisfied. No CRITICAL findings; two non-blocking warnings (stderr not surfaced on error events; manual smoke checks unverified by runtime).

## Files promoted
- Source: `openspec/changes/yt-dlp-integration/specs/youtube/spec.md`
- Destination: `openspec/specs/youtube/spec.md` (new main spec — mechanical shell copy, `diff -r` empty)

## Change folder archived
Moved to `openspec/changes/archive/2026-10-01-yt-dlp-integration/` (mechanical move, `diff -r` against pre-move snapshot empty).

## Files created/modified during apply (per verify-report)
New: `src/sections/youtube.ts`, `src-tauri/src/youtube.rs`
Modified: `src/main.ts`, `src/sections/types.ts`, `src/icons.ts`, `src-tauri/Cargo.toml`, `src-tauri/capabilities/default.json`, `src-tauri/src/lib.rs` (+ other call sites). Net diff ~280 lines.

## Mechanical-copy evidence
- Spec promotion: `diff -r` source vs temp vs target — empty (byte-identical).
- Folder move: `diff -r` pre-move snapshot vs archive destination — empty (byte-identical).

## SDD cycle complete
Plan → spec → design → tasks → apply → verify → archive. Ready for next change.
