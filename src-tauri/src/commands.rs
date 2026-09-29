//! All `#[tauri::command]` entry points exposed to the TypeScript frontend.

use crate::config::{self, Config};
use crate::server::{self, ServerHandle, ServerStatus};
use std::sync::Arc;
use tauri::State;

/// Shared app state held by Tauri.
pub struct AppState {
    pub config: tokio::sync::Mutex<Config>,
    pub server: Arc<ServerHandle>,
}

impl AppState {
    pub fn new() -> Self {
        AppState {
            config: tokio::sync::Mutex::new(config::load()),
            server: Arc::new(ServerHandle::new()),
        }
    }
}

// ---------------------------------------------------------------------------
// Config commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_config(state: State<'_, AppState>) -> Result<Config, String> {
    let cfg = state.config.lock().await;
    Ok(cfg.clone())
}

#[tauri::command]
pub async fn set_server_dir(
    path: String,
    state: State<'_, AppState>,
) -> Result<Config, String> {
    if !path.trim().is_empty() {
        let p = std::path::PathBuf::from(&path);
        if !p.join("run.sh").exists() {
            return Err(format!("run.sh not found in {}", p.display()));
        }
    }
    let mut cfg = state.config.lock().await;
    cfg.server.dir = path;
    config::save(&cfg)?;
    Ok(cfg.clone())
}

#[tauri::command]
pub async fn set_server_url(
    url: String,
    state: State<'_, AppState>,
) -> Result<Config, String> {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("URL must start with http:// or https://".into());
    }
    let mut cfg = state.config.lock().await;
    cfg.server.url = url;
    config::save(&cfg)?;
    Ok(cfg.clone())
}

#[tauri::command]
pub async fn set_theme(
    theme: String,
    state: State<'_, AppState>,
) -> Result<Config, String> {
    if !["dark", "light"].contains(&theme.as_str()) {
        return Err("Theme must be 'dark' or 'light'".into());
    }
    let mut cfg = state.config.lock().await;
    cfg.ui.theme = theme;
    config::save(&cfg)?;
    Ok(cfg.clone())
}

// ---------------------------------------------------------------------------
// Server lifecycle commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn start_server(state: State<'_, AppState>) -> Result<ServerStatus, String> {
    let backend_dir = {
        let cfg = state.config.lock().await;
        cfg.server.dir.clone()
    };
    server::start_and_track(&state.server, &backend_dir).await
}

#[tauri::command]
pub async fn stop_server(state: State<'_, AppState>) -> Result<ServerStatus, String> {
    server::stop(&state.server).await
}

#[tauri::command]
pub async fn server_status(state: State<'_, AppState>) -> Result<ServerStatus, String> {
    server::status(&state.server).await
}
