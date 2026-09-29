//! Persistent configuration stored in `config.toml` next to the executable.
//!
//! The config file lives in the same directory as the `.exe` so that a portable
//! install (e.g. on a USB stick) carries its config with it.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Config {
    pub server: ServerConfig,
    pub ui: UiConfig,
    pub clipboard: ClipboardConfig,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ServerConfig {
    /// Absolute path to the LexiLocal backend install directory (must contain `run.sh`).
    pub dir: String,
    /// Base URL the frontend uses to reach the backend.
    pub url: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UiConfig {
    /// `"dark"` or `"light"`.
    pub theme: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ClipboardConfig {
    pub poll_ms: u64,
    pub max_items: usize,
    pub items: Vec<ClipboardItem>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ClipboardItem {
    pub timestamp: String,
    pub text: String,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            server: ServerConfig {
                dir: String::new(),
                url: "http://localhost:8000".to_string(),
            },
            ui: UiConfig {
                theme: "dark".to_string(),
            },
            clipboard: ClipboardConfig {
                poll_ms: 750,
                max_items: 10,
                items: Vec::new(),
            },
        }
    }
}

/// Path to the config file: `<exe_dir>/config.toml`.
pub fn config_path() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."))
        .join("config.toml")
}

/// Load the config from disk. Falls back to defaults if the file is missing
/// or corrupted. On corruption, the bad file is preserved as
/// `config.toml.broken-<unix-ts>` and defaults are written.
pub fn load() -> Config {
    let path = config_path();
    match std::fs::read_to_string(&path) {
        Ok(s) => match toml::from_str::<Config>(&s) {
            Ok(cfg) => cfg,
            Err(_) => {
                let ts = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or(0);
                let backup = path.with_file_name(format!(
                    "config.toml.broken-{}",
                    ts
                ));
                let _ = std::fs::rename(&path, &backup);
                let d = Config::default();
                let _ = save(&d);
                d
            }
        },
        Err(_) => Config::default(),
    }
}

/// Atomic save: write to `config.toml.tmp`, then rename.
pub fn save(cfg: &Config) -> Result<(), String> {
    let path = config_path();
    let tmp = path.with_extension("toml.tmp");
    let body = toml::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&tmp, body).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}
