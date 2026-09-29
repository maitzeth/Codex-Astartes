import type { SectionController } from "../sections/types";
import { tauri, type ClipboardItem } from "../lib/tauri";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

function preview(text: string, max = 80): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length <= max ? collapsed : collapsed.slice(0, max) + "…";
}

function formatTime(ts: string): string {
  // ISO timestamp -> HH:MM:SS
  const t = ts.split("T")[1];
  if (!t) return ts;
  return t.split(/[+-]/)[0].split(".")[0];
}

export interface ClipboardController extends SectionController {
  push(text: string): Promise<void>;
}

export function renderClipboard(root: HTMLElement): ClipboardController | HTMLElement {
  // We don't always have a switchTo callback (the setup screen calls us
  // without ctx). Fall back to a plain DOM mount in that case.
  root.innerHTML = `
    <h2>Tools</h2>
    <h3>Clipboard history</h3>
    <div class="log-controls">
      <button id="btn-clear-clip" class="secondary">Clear</button>
      <button id="btn-pause-clip" class="secondary">Pause</button>
      <label class="muted">
        Interval (ms):
        <input id="clip-interval" type="number" min="100" step="100" style="width:90px" />
      </label>
      <span id="clip-count" class="muted"></span>
    </div>
    <div id="clip-list" class="clip-list"></div>
  `;

  const listEl = root.querySelector<HTMLDivElement>("#clip-list")!;
  const countEl = root.querySelector<HTMLSpanElement>("#clip-count")!;
  const clearBtn = root.querySelector<HTMLButtonElement>("#btn-clear-clip")!;
  const pauseBtn = root.querySelector<HTMLButtonElement>("#btn-pause-clip")!;
  const intervalInput = root.querySelector<HTMLInputElement>("#clip-interval")!;
  let paused = false;

  const renderItems = (items: ClipboardItem[]) => {
    listEl.innerHTML = "";
    for (const item of items) {
      const row = document.createElement("div");
      row.className = "clip-row";
      row.innerHTML = `
        <div class="clip-meta">
          <span class="clip-time">${formatTime(item.timestamp)}</span>
          <span class="clip-preview" title="${escapeHtml(item.text)}">${escapeHtml(preview(item.text))}</span>
        </div>
        <div class="clip-actions">
          <button class="secondary clip-copy" title="Copy back to clipboard">Copy</button>
          <button class="secondary clip-chat" title="Send to Chat">→ Chat</button>
          <button class="secondary clip-translate" title="Send to Translate">→ Translate</button>
        </div>
      `;
      const copyBtn = row.querySelector<HTMLButtonElement>(".clip-copy")!;
      const chatBtn = row.querySelector<HTMLButtonElement>(".clip-chat")!;
      const translateBtn = row.querySelector<HTMLButtonElement>(".clip-translate")!;
      copyBtn.addEventListener("click", () => void tauri.copyToClipboard(item.text));
      chatBtn.addEventListener("click", () => {
        const textarea = document.querySelector<HTMLTextAreaElement>("#chat-prompt");
        if (textarea) {
          textarea.value = item.text;
          window.dispatchEvent(new CustomEvent("codexastarte:switch-section", { detail: "chat" }));
        }
      });
      translateBtn.addEventListener("click", () => {
        const textarea = document.querySelector<HTMLTextAreaElement>("#translate-text");
        if (textarea) {
          textarea.value = item.text;
          window.dispatchEvent(new CustomEvent("codexastarte:switch-section", { detail: "translate" }));
        }
      });
      listEl.appendChild(row);
    }
    countEl.textContent = `${items.length} item(s)`;
  };

  void (async () => {
    const items = await tauri.getClipboardHistory();
    renderItems(items);

    // Pull current poll interval from config for the input default.
    const cfg = await tauri.getConfig();
    intervalInput.value = String(cfg.clipboard.poll_ms);
  })();

  clearBtn.addEventListener("click", async () => {
    await tauri.clearClipboardHistory();
    renderItems([]);
  });

  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    pauseBtn.textContent = paused ? "Resume" : "Pause";
  });

  intervalInput.addEventListener("change", async () => {
    const v = parseInt(intervalInput.value, 10);
    if (!isNaN(v) && v >= 100) {
      await tauri.setClipboardPollMs(v);
    }
  });

  // Subscribe to clipboard events from the Rust poller.
  const unlistenPromise = tauri.onClipboardChanged((items) => {
    if (paused) return;
    renderItems(items);
  });

  const controller: ClipboardController = {
    async push(text: string) {
      await tauri.copyToClipboard(text);
    },
    destroy() {
      void unlistenPromise.then((un) => un());
    },
  };

  return controller;
}
