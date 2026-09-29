import type { Section } from "./types";
import { settingsIcon } from "../icons";
import { tauri, type Config } from "../lib/tauri";
import { applyTheme } from "../lib/theme";

// We avoid importing @tauri-apps/plugin-dialog at module level so this section
// can be loaded even if the plugin failed to register (defensive). The actual
// call to dialog happens inside an async click handler.
let dialogPlugin: typeof import("@tauri-apps/plugin-dialog").open | null = null;
async function getDialogOpen() {
  if (!dialogPlugin) {
    dialogPlugin = (await import("@tauri-apps/plugin-dialog")).open;
  }
  return dialogPlugin;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const settingsSection: Section = {
  id: "settings",
  label: "Settings",
  icon: settingsIcon,
  render(ctx): HTMLElement {
    const root = document.createElement("div");
    root.className = "panel";
    root.innerHTML = `
      <h2>Settings</h2>

      <label class="setting-label">Backend install directory</label>
      <div class="row">
        <input id="set-dir" type="text" value="${ctx.config.server.dir}" placeholder="C:\\path\\to\\LexiLocal" />
        <button id="btn-pick-dir" class="secondary">Browse…</button>
      </div>
      <p id="dir-status" class="muted"></p>

      <label class="setting-label">Backend base URL</label>
      <div class="row">
        <input id="set-url" type="text" value="${ctx.config.server.url}" placeholder="http://localhost:8000" />
        <button id="btn-save-url" class="secondary">Save</button>
      </div>
      <p id="url-status" class="muted"></p>

      <label class="setting-label">Theme</label>
      <div class="row">
        <select id="set-theme">
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </div>
    `;

    const dirInput = root.querySelector<HTMLInputElement>("#set-dir")!;
    const dirStatus = root.querySelector<HTMLParagraphElement>("#dir-status")!;
    const pickBtn = root.querySelector<HTMLButtonElement>("#btn-pick-dir")!;
    const urlInput = root.querySelector<HTMLInputElement>("#set-url")!;
    const urlStatus = root.querySelector<HTMLParagraphElement>("#url-status")!;
    const urlBtn = root.querySelector<HTMLButtonElement>("#btn-save-url")!;
    const themeSelect = root.querySelector<HTMLSelectElement>("#set-theme")!;

    themeSelect.value = ctx.config.ui.theme;

    const saveDir = async (path: string) => {
      try {
        const cfg: Config = await tauri.setServerDir(path);
        ctx.config = cfg;
        dirStatus.textContent = path
          ? `Saved: ${path}`
          : "Backend dir cleared. The app will show the setup screen again.";
        dirStatus.className = path ? "muted ok-text" : "muted warn-text";
      } catch (err) {
        dirStatus.textContent = `Error: ${err}`;
        dirStatus.className = "muted err-text";
      }
    };

    dirInput.addEventListener("change", () => void saveDir(dirInput.value));

    pickBtn.addEventListener("click", async () => {
      try {
        const open = await getDialogOpen();
        const selected = await open({
          directory: true,
          multiple: false,
          title: "Pick the LexiLocal backend install directory",
        });
        if (typeof selected === "string") {
          dirInput.value = selected;
          await saveDir(selected);
        }
      } catch (err) {
        dirStatus.textContent = `Picker error: ${err}`;
        dirStatus.className = "muted err-text";
      }
    });

    urlBtn.addEventListener("click", async () => {
      try {
        const cfg = await tauri.setServerUrl(urlInput.value.trim());
        ctx.config = cfg;
        urlStatus.textContent = `Saved: ${cfg.server.url}`;
        urlStatus.className = "muted ok-text";
      } catch (err) {
        urlStatus.textContent = `Error: ${err}`;
        urlStatus.className = "muted err-text";
      }
    });

    themeSelect.addEventListener("change", async () => {
      const theme = themeSelect.value as "dark" | "light";
      try {
        const cfg = await tauri.setTheme(theme);
        ctx.config = cfg;
        applyTheme(theme);
      } catch (err) {
        urlStatus.textContent = `Theme error: ${err}`;
      }
    });

    void copyToClipboard; // silence unused warning until reused

    return root;
  },
};
