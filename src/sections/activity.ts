import type { Section, SectionController } from "./types";
import { activityIcon } from "../icons";

interface LogEntry {
  timestamp: string;
  client_ip: string;
  method: string;
  path: string;
  status: number;
  request_body?: string | null;
  response_body?: string | null;
}

const seenLogKeys = new Set<string>();

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

export const activitySection: Section = {
  id: "activity",
  label: "Activity",
  icon: activityIcon,
  render(ctx): HTMLElement {
    const root = document.createElement("div");
    root.className = "panel";
    root.innerHTML = `
      <h2>Activity Log</h2>
      <div class="log-controls">
        <button id="btn-clear-log" class="secondary">Clear</button>
        <label class="muted">
          <input type="checkbox" id="auto-scroll" checked /> Auto-scroll
        </label>
        <span id="log-count" class="muted"></span>
      </div>
      <div id="log-output" class="log-output"></div>
    `;

    const output = root.querySelector<HTMLDivElement>("#log-output")!;
    const autoScroll = root.querySelector<HTMLInputElement>("#auto-scroll")!;
    const count = root.querySelector<HTMLSpanElement>("#log-count")!;
    const clearBtn = root.querySelector<HTMLButtonElement>("#btn-clear-log")!;

    clearBtn.addEventListener("click", () => {
      output.innerHTML = "";
      count.textContent = "";
      seenLogKeys.clear();
    });

    let aborted = false;

    const fetchOnce = async () => {
      if (aborted) return;
      try {
        const res = await fetch(`${ctx.config.server.url}/logs?limit=50`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok || aborted) return;
        const entries = (await res.json()) as LogEntry[];

        for (const entry of entries) {
          const key = `${entry.timestamp}-${entry.client_ip}-${entry.method}-${entry.path}-${entry.status}-${entry.request_body ?? ""}-${entry.response_body ?? ""}`;
          if (seenLogKeys.has(key)) continue;
          seenLogKeys.add(key);

          const time = entry.timestamp.split("T")[1] || entry.timestamp;
          const statusClass =
            entry.status >= 500 ? "err" : entry.status >= 400 ? "warn" : "ok";

          const entry_el = document.createElement("div");
          entry_el.className = "log-entry";

          const header = document.createElement("div");
          header.className = "log-line";
          header.innerHTML = `
            <span class="log-time">${time}</span>
            <span class="log-ip">${entry.client_ip}</span>
            <span class="log-method ${entry.method}">${entry.method}</span>
            <span class="log-path">${entry.path}</span>
            <span class="log-status ${statusClass}">${entry.status}</span>
          `;
          entry_el.appendChild(header);

          if (entry.request_body) {
            const req = document.createElement("div");
            req.className = "log-body log-body-req";
            req.title = entry.request_body;
            req.innerHTML = `<span class="log-body-label">REQ</span> ${escapeHtml(entry.request_body)}`;
            entry_el.appendChild(req);
          }
          if (entry.response_body) {
            const res = document.createElement("div");
            res.className = "log-body log-body-res";
            res.title = entry.response_body;
            res.innerHTML = `<span class="log-body-label">RES</span> ${escapeHtml(entry.response_body)}`;
            entry_el.appendChild(res);
          }

          output.appendChild(entry_el);
        }

        while (output.children.length > 100) {
          output.removeChild(output.firstChild!);
        }
        count.textContent = `${entries.length} recent request(s)`;
        if (autoScroll.checked) output.scrollTop = output.scrollHeight;
      } catch {
        /* ignore */
      }
    };

    void fetchOnce();
    const interval = window.setInterval(fetchOnce, 2000);

    const controller: SectionController = {
      destroy() {
        aborted = true;
        window.clearInterval(interval);
      },
    };
    (root as HTMLElement & { _controller?: SectionController })._controller = controller;
    return root;
  },
};
