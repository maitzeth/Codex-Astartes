import type { Config } from "../lib/tauri";

export interface SectionContext {
  config: Config;
  switchTo: (id: SectionId) => void;
}

export interface SectionController {
  destroy(): void;
}

export type SectionId =
  | "chat"
  | "translate"
  | "tools"
  | "rest"
  | "activity"
  | "settings";

export interface Section {
  id: SectionId;
  label: string;
  icon: (opts?: { size?: number; class?: string }) => string;
  render(ctx: SectionContext): HTMLElement;
}
