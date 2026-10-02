import "./styles.css";
import { tauri, type Config, type ServerStatus } from "./lib/tauri";
import { applyTheme } from "./lib/theme";
import { sunIcon, moonIcon } from "./icons";
import type { Section, SectionContext, SectionController, SectionId } from "./sections/types";
import { chatSection } from "./sections/chat";
import { translateSection } from "./sections/translate";
import { toolsSection } from "./sections/tools";
import { youtubeSection } from "./sections/youtube";
import { restSection } from "./sections/rest";
import { activitySection } from "./sections/activity";
import { settingsSection } from "./sections/settings";

const SECTIONS: Record<SectionId, Section> = {
  chat: chatSection,
  translate: translateSection,
  tools: toolsSection,
  youtube: youtubeSection,
  rest: restSection,
  activity: activitySection,
  settings: settingsSection,
};

let appConfig: Config;
let activeController: SectionController | null = null;
let activeId: SectionId = "chat";
let healthTimer: number | null = null;
let statusDot: HTMLSpanElement | null = null;
let statusText: HTMLSpanElement | null = null;

async function boot() {
  appConfig = await tauri.getConfig();
  applyTheme(appConfig.ui.theme);

  if (!appConfig.server.dir.trim()) {
    renderSetupScreen();
    return;
  }
  renderShell();
}

function renderSetupScreen() {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `
    <div class="setup-overlay">
      <div class="setup-card">
        <h1>Welcome to Codex-Astartes</h1>
        <p>Tell us where the LexiLocal backend is installed. The directory must contain <code>run.sh</code>.</p>
        <label class="setting-label">Backend install directory</label>
        <div class="row">
          <input id="setup-dir" type="text" placeholder="C:\\path\\to\\LexiLocal" />
          <button id="btn-pick" class="secondary">Browse…</button>
        </div>
        <p id="setup-status" class="muted"></p>
        <button id="btn-save" disabled>Save & continue</button>
      </div>
    </div>
  `;

  const input = app.querySelector<HTMLInputElement>("#setup-dir")!;
  const saveBtn = app.querySelector<HTMLButtonElement>("#btn-save")!;
  const status = app.querySelector<HTMLParagraphElement>("#setup-status")!;
  const pickBtn = app.querySelector<HTMLButtonElement>("#btn-pick")!;

  const updateSaveState = () => {
    saveBtn.disabled = !input.value.trim();
  };
  input.addEventListener("input", updateSaveState);

  pickBtn.addEventListener("click", async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const sel = await open({ directory: true, multiple: false, title: "Pick the LexiLocal backend directory" });
      if (typeof sel === "string") {
        input.value = sel;
        updateSaveState();
      }
    } catch (err) {
      status.textContent = `Picker error: ${err}`;
    }
  });

  saveBtn.addEventListener("click", async () => {
    status.textContent = "";
    try {
      const cfg = await tauri.setServerDir(input.value.trim());
      appConfig = cfg;
      applyTheme(cfg.ui.theme);
      renderShell();
    } catch (err) {
      status.textContent = `Error: ${err}`;
      status.className = "err-text";
    }
  });
}

function renderShell() {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1 class="sidebar-title">Codex-Astartes</h1>
        <div class="status-line">
          <span id="status-dot" class="status-dot"></span>
          <span id="status-text">Checking…</span>
        </div>
      </div>
      <nav class="nav" id="nav"></nav>
      <div class="server-controls">
        <button id="btn-start" class="secondary">Start</button>
        <button id="btn-stop" class="secondary">Stop</button>
      </div>
      <div class="sidebar-footer">
        <button id="btn-theme-toggle" class="secondary" title="Toggle theme">
          <span id="theme-icon"></span>
        </button>
      </div>
    </aside>
    <main class="content" id="content"></main>
  `;

  const nav = app.querySelector<HTMLElement>("#nav")!;
  const navEntries: [SectionId, Section][] = (Object.entries(SECTIONS) as [SectionId, Section][]).map(
    ([id, sec]) => [id, sec],
  );

  for (const [id, sec] of navEntries) {
    const btn = document.createElement("button");
    btn.className = "nav-item";
    btn.dataset.section = id;
    btn.innerHTML = `${sec.icon({ size: 16 })}<span>${sec.label}</span>`;
    btn.addEventListener("click", () => activate(id));
    nav.appendChild(btn);
  }

  statusDot = app.querySelector<HTMLSpanElement>("#status-dot")!;
  statusText = app.querySelector<HTMLSpanElement>("#status-text")!;
  const themeBtn = app.querySelector<HTMLButtonElement>("#btn-theme-toggle")!;
  const themeIcon = app.querySelector<HTMLSpanElement>("#theme-icon")!;
  themeIcon.innerHTML = appConfig.ui.theme === "dark" ? sunIcon({ size: 14 }) : moonIcon({ size: 14 });
  themeBtn.addEventListener("click", async () => {
    const next: "dark" | "light" = appConfig.ui.theme === "dark" ? "light" : "dark";
    try {
      const cfg = await tauri.setTheme(next);
      appConfig = cfg;
      applyTheme(next);
      themeIcon.innerHTML = next === "dark" ? sunIcon({ size: 14 }) : moonIcon({ size: 14 });
    } catch (err) {
      console.error(err);
    }
  });

  const startBtn = app.querySelector<HTMLButtonElement>("#btn-start")!;
  const stopBtn = app.querySelector<HTMLButtonElement>("#btn-stop")!;
  startBtn.addEventListener("click", async () => {
    startBtn.disabled = true;
    try {
      const s = await tauri.startServer();
      updateStatusFromTauri(s);
    } catch (err) {
      if (statusText) statusText.textContent = `Start error: ${err}`;
    } finally {
      startBtn.disabled = false;
    }
  });
  stopBtn.addEventListener("click", async () => {
    stopBtn.disabled = true;
    try {
      const s = await tauri.stopServer();
      updateStatusFromTauri(s);
    } catch (err) {
      if (statusText) statusText.textContent = `Stop error: ${err}`;
    } finally {
      stopBtn.disabled = false;
    }
  });

  activate(activeId);
  void refreshHealth();
  if (healthTimer !== null) window.clearInterval(healthTimer);
  healthTimer = window.setInterval(refreshHealth, 5000);

  // Cross-section navigation: clipboard "→ Chat" / "→ Translate" buttons.
  window.addEventListener("codexastarte:switch-section", (e) => {
    const id = (e as CustomEvent<SectionId>).detail;
    if (SECTIONS[id]) activate(id);
  });
}

function updateStatusFromTauri(s: ServerStatus) {
  if (!statusDot || !statusText) return;
  statusDot.classList.toggle("online", s.running);
  statusText.textContent = s.running ? `Online${s.pid ? ` • PID ${s.pid}` : ""}` : "Offline";
}

async function refreshHealth() {
  if (!statusText || !statusDot) return;
  try {
    const res = await fetch(`${appConfig.server.url}/health`, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    const online = res.ok && data.status === "ok";
    statusDot.classList.toggle("online", online);
    statusText.textContent = online
      ? `Online • ${data.model}`
      : `Offline (${data.status || "unreachable"})`;
  } catch {
    statusDot.classList.toggle("online", false);
    statusText.textContent = "Offline";
  }
}

function wrapInWindow(label: string, body: HTMLElement): HTMLElement {
  const win = document.createElement("div");
  win.className = "window";
  win.style.marginBottom = "8px";
  const bar = document.createElement("div");
  bar.className = "title-bar";
  const text = document.createElement("div");
  text.className = "title-bar-text";
  text.textContent = label;
  const ctrls = document.createElement("div");
  ctrls.className = "title-bar-controls";
  ctrls.innerHTML =
    '<button aria-label="Minimize"></button>' +
    '<button aria-label="Maximize"></button>' +
    '<button aria-label="Close"></button>';
  bar.append(text, ctrls);
  const winBody = document.createElement("div");
  winBody.className = "window-body";
  winBody.appendChild(body);
  win.append(bar, winBody);
  return win;
}

function activate(id: SectionId) {
  activeController?.destroy();
  activeController = null;

  document.querySelectorAll<HTMLButtonElement>(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.section === id);
  });

  const section = SECTIONS[id];
  const ctx: SectionContext = {
    config: appConfig,
    switchTo: activate,
  };
  const root = section.render(ctx);
  const main = document.querySelector<HTMLDivElement>("#content")!;
  main.innerHTML = "";
  main.appendChild(wrapInWindow(section.label, root));

  activeId = id;
  const ctrl = (root as HTMLElement & { _controller?: SectionController })._controller;
  if (ctrl) activeController = ctrl;
}

boot();
