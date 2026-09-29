mod clipboard;
mod commands;
mod config;
mod server;

use commands::{get_config, server_status, set_server_dir, set_server_url, set_theme, start_server, stop_server, AppState};

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
