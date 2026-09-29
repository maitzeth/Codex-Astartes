//! Background clipboard polling. Reads the Windows clipboard at the interval
//! configured in `config.clipboard.poll_ms`, dedupes against the last item,
//! prepends new entries, trims to `config.clipboard.max_items`, saves config,
//! and emits `clipboard://changed` to the frontend with the new history.

use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tokio::time::interval;

use crate::commands::AppState;
use crate::config;

const MAX_ITEM_BYTES: usize = 32 * 1024;

pub fn spawn_poller(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        // Read initial poll interval from config (do this once, not every tick).
        let initial_poll_ms = {
            let state = app.state::<AppState>();
            let cfg = state.config.lock().await;
            cfg.clipboard.poll_ms
        };

        let mut tick = interval(Duration::from_millis(initial_poll_ms));
        // Skip the first immediate tick so we don't read the clipboard the
        // instant the app starts.
        tick.tick().await;

        let mut last_text: Option<String> = None;

        loop {
            tick.tick().await;

            // Read current poll interval from config (allows live changes).
            let (poll_ms, max_items) = {
                let state = app.state::<AppState>();
                let cfg = state.config.lock().await;
                (cfg.clipboard.poll_ms, cfg.clipboard.max_items)
            };

            // Note: changing poll_ms won't retune the running interval
            // immediately. For this PR the change takes effect on app
            // restart. Acceptable trade-off for simplicity.
            let _ = poll_ms;

            let text = match app.clipboard().read_text() {
                Ok(s) => s,
                Err(_) => continue,
            };

            // Drop oversized pastes.
            if text.len() > MAX_ITEM_BYTES {
                continue;
            }

            // Skip unchanged.
            if Some(&text) == last_text.as_ref() {
                continue;
            }
            last_text = Some(text.clone());

            // Push and trim.
            let snapshot = {
                let state = app.state::<AppState>();
                let mut cfg = state.config.lock().await;
                cfg.clipboard.items.insert(
                    0,
                    config::ClipboardItem {
                        timestamp: chrono::Local::now().to_rfc3339(),
                        text,
                    },
                );
                cfg.clipboard.items.truncate(max_items);
                let snap = cfg.clipboard.items.clone();
                let _ = config::save(&cfg);
                snap
            };

            let _ = app.emit("clipboard://changed", &snapshot);
        }
    });
}
