// Typed wrappers around `invoke()` so sections never call raw `@tauri-apps/api/core`.

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type Theme = "dark" | "light";

export interface Config {
  server: { dir: string; url: string };
  ui: { theme: Theme };
  clipboard: { poll_ms: number; max_items: number; items: ClipboardItem[] };
}

export interface ClipboardItem {
  timestamp: string;
  text: string;
}

export interface ServerStatus {
  running: boolean;
  pid: number | null;
}

export const tauri = {
  // Config
  getConfig: () => invoke<Config>("get_config"),
  setServerDir: (path: string) => invoke<Config>("set_server_dir", { path }),
  setServerUrl: (url: string) => invoke<Config>("set_server_url", { url }),
  setTheme: (theme: Theme) => invoke<Config>("set_theme", { theme }),

  // Server lifecycle
  startServer: () => invoke<ServerStatus>("start_server"),
  stopServer: () => invoke<ServerStatus>("stop_server"),
  serverStatus: () => invoke<ServerStatus>("server_status"),

  // Events
  onClipboardChanged: (fn: (items: ClipboardItem[]) => void): Promise<UnlistenFn> =>
    listen<ClipboardItem[]>("clipboard://changed", (e) => fn(e.payload)),
};
