mod clipboard;
mod commands;
mod config;
mod server;

use commands::{
    clear_clipboard_history, copy_to_clipboard, get_clipboard_history, get_config, server_status,
    set_clipboard_poll_ms, set_server_dir, set_server_url, set_theme, start_server, stop_server,
    AppState,
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .setup(|app| {
            // Spawn the clipboard poller in the background.
            clipboard::spawn_poller(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            set_server_dir,
            set_server_url,
            set_theme,
            start_server,
            stop_server,
            server_status,
            get_clipboard_history,
            clear_clipboard_history,
            copy_to_clipboard,
            set_clipboard_poll_ms,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
