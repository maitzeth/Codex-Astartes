# YouTube Downloader — Tasks

Each task is a small reviewable unit. Total: ~9 tasks, ~280 changed lines, single-PR scope.

## Backend (Rust)

### T-1: New module `src-tauri/src/youtube.rs`
- [x] Create the module with `DownloadRegistry`, `ProgressEvent`, `ProgressStatus`, `DownloadStarted`, `Format`, `check_available()`, `start()`, `cancel()`.
- [x] Spawn the stdout-reader task with debouncing (≤ 10 events/sec).
- [x] Include `parse_progress()` and `build_args()` helpers.
- **Verify**: `cargo check` from `src-tauri/` passes.

### T-2: Wire commands in `src-tauri/src/commands.rs`
- [x] Add `check_yt_dlp`, `download_youtube`, `cancel_download` `#[tauri::command]` functions.
- [x] Pull `DownloadRegistry` from `State<AppState>`.
- **Verify**: `cargo check` passes.

### T-3: Update `AppState` in `src-tauri/src/commands.rs`
- [x] Add `pub youtube: Arc<DownloadRegistry>` and initialize in `AppState::new()`.
- **Verify**: `cargo check` passes.

### T-4: Register commands in `src-tauri/src/main.rs`
- [x] Add `mod youtube;`.
- [x] Add the three commands to `invoke_handler!`.
- **Verify**: `cargo check` passes.

## Capability

### T-5: Add `dialog:allow-save` to `src-tauri/capabilities/default.json`
- [x] Append `"dialog:allow-save"` to the `permissions` array.
- **Verify**: `cargo check` passes; capability schema is valid.

## Frontend (TypeScript)

### T-6: Add `youtubeIcon` in `src/icons.ts`
- [x] Lucide-style SVG factory matching existing patterns. Visual: rounded square with play triangle.
- **Verify**: `tsc -b --noEmit` passes.

### T-7: Add typed wrappers in `src/lib/tauri.ts`
- [x] `YoutubeFormat`, `YoutubeProgress`.
- [x] `checkYtDlp`, `downloadYoutube`, `cancelDownload`, `onYoutubeProgress` under `tauri` namespace.
- **Verify**: `tsc -b --noEmit` passes.

### T-8: New section `src/sections/youtube.ts`
- [x] Form: URL input, format dropdown, "Choose folder…" button, Download button, Cancel button.
- [x] On mount, call `checkYtDlp()`; show "yt-dlp not found" message if false.
- [x] Wire folder picker via `@tauri-apps/plugin-dialog`.
- [x] Listen to `youtube://progress` events; update a `<progress>` element.
- [x] Handle finished/error states; show alerts.
- [x] Return a `SectionController` whose `destroy()` unlistens.
- **Verify**: `tsc -b --noEmit` passes.

### T-9: Wire section into app
- [x] Add `"youtube"` to `SectionId` union in `src/sections/types.ts`.
- [x] Add `import { youtubeSection }` and `youtube: youtubeSection` in `src/main.ts`.
- **Verify**: `tsc -b --noEmit` passes; `npm run build` succeeds.

## Verification

### T-10: Manual smoke test
- [x] `cargo check` from `src-tauri/` — zero errors, zero new warnings.
- [x] `npm run build` — succeeds.
- [ ] (User-driven) Launch app, activate YouTube section, paste a real YouTube URL, pick a folder, click Download, observe progress bar reaches 100%, file appears in chosen folder.
- [ ] (User-driven) Click Cancel mid-download, observe process dies and UI re-enables.
- [ ] (If yt-dlp not installed) Confirm "not found" message displays instead of the form.

## Out of scope (intentional, do not do)
- Sidecar bundling of yt-dlp.exe
- Playlists, subtitles, cookies, auth
- Format dropdown beyond 3 options
- Auto-update of yt-dlp
