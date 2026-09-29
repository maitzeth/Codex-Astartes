//! Background clipboard polling. Full implementation lands in PR 3.
//!
//! Stub for PR 2a so the module compiles. The poller just emits nothing for now.

use tauri::AppHandle;

pub fn spawn_poller(_app: AppHandle) {
    // Intentionally empty for PR 2a. PR 3 will:
    // - tokio::spawn an interval loop reading clipboard via the plugin
    // - dedupe, prepend, trim to max_items
    // - emit `clipboard://changed` with the new history
}
