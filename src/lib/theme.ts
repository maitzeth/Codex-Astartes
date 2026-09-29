import type { Theme } from "./tauri";

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}
