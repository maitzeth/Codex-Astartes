import type { Section, SectionController } from "./types";
import { youtubeIcon } from "../icons";
import { tauri, type YoutubeProgress } from "../lib/tauri";

type State = "idle" | "running" | "done";

function showAlert(message: string) {
  // Win98-style alert: the simplest thing that works in this app.
  // 98.css doesn't ship a JS alert shim, so we use the native browser dialog
  // — same as the rest of the v1 sections.
  window.alert(message);
}

export const youtubeSection: Section = {
  id: "youtube",
  label: "YouTube",
  icon: youtubeIcon,
  render(_ctx): HTMLElement {
    const root = document.createElement("div");
    root.className = "panel";
    root.innerHTML = `
      <h2>YouTube downloader</h2>
      <p class="muted">Downloads audio and video via yt-dlp. Pick a folder, paste a URL, click download.</p>
      <div id="yt-unavailable" class="muted" style="display:none;">
        yt-dlp not found on PATH. Install it from
        <a href="https://github.com/yt-dlp/yt-dlp/releases" target="_blank">github.com/yt-dlp/yt-dlp/releases</a>
        and restart the app.
      </div>
      <div id="yt-form">
        <label class="setting-label">URL</label>
        <input id="yt-url" type="text" placeholder="https://..." />
        <label class="setting-label">Format</label>
        <select id="yt-format">
          <option value="bestVideo">Best video (mp4)</option>
          <option value="bestAudio">Best audio (m4a)</option>
          <option value="mp3">Audio only (mp3)</option>
        </select>
        <label class="setting-label">Destination folder</label>
        <div class="row">
          <input id="yt-dir" type="text" placeholder="C:\\Users\\...\\Downloads" readonly />
          <button id="yt-pick" class="secondary">Choose folder…</button>
        </div>
        <div class="row" style="margin-top: 10px;">
          <button id="yt-download">Download</button>
          <button id="yt-cancel" class="secondary" disabled>Cancel</button>
        </div>
        <div class="row" style="margin-top: 6px;">
          <button id="yt-update" class="secondary">Update yt-dlp</button>
        </div>
        <div id="yt-progress-wrap" style="margin-top: 10px; display:none;">
          <progress id="yt-progress" max="100" value="0" style="width: 100%;"></progress>
          <p id="yt-status" class="muted"></p>
        </div>
      </div>
    `;

    const formEl = root.querySelector<HTMLDivElement>("#yt-form")!;
    const unavailableEl = root.querySelector<HTMLDivElement>("#yt-unavailable")!;
    const urlInput = root.querySelector<HTMLInputElement>("#yt-url")!;
    const formatSelect = root.querySelector<HTMLSelectElement>("#yt-format")!;
    const dirInput = root.querySelector<HTMLInputElement>("#yt-dir")!;
    const pickBtn = root.querySelector<HTMLButtonElement>("#yt-pick")!;
    const dlBtn = root.querySelector<HTMLButtonElement>("#yt-download")!;
    const cancelBtn = root.querySelector<HTMLButtonElement>("#yt-cancel")!;
    const updateBtn = root.querySelector<HTMLButtonElement>("#yt-update")!;
    const progressWrap = root.querySelector<HTMLDivElement>("#yt-progress-wrap")!;
    const progressEl = root.querySelector<HTMLProgressElement>("#yt-progress")!;
    const statusEl = root.querySelector<HTMLParagraphElement>("#yt-status")!;

    let dir = "";
    let activeId: string | null = null;
    let state: State = "idle";

    const updateButtons = () => {
      const canStart = state === "idle" && urlInput.value.trim().length > 0 && dir.length > 0;
      dlBtn.disabled = !canStart;
      cancelBtn.disabled = state !== "running";
      urlInput.disabled = state === "running";
      formatSelect.disabled = state === "running";
      pickBtn.disabled = state === "running";
    };

    const setStatus = (text: string) => {
      statusEl.textContent = text;
    };

    // Availability check on mount.
    void (async () => {
      try {
        const ok = await tauri.checkYtDlp();
        if (!ok) {
          formEl.style.display = "none";
          unavailableEl.style.display = "";
        }
      } catch (err) {
        // If the command itself fails (e.g. backend not built), still show form;
        // the user will see the actual error when they click download.
        console.error("check_yt_dlp failed:", err);
      }
    })();

    urlInput.addEventListener("input", updateButtons);

    pickBtn.addEventListener("click", async () => {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const sel = await open({ directory: true, multiple: false, title: "Choose destination folder" });
        if (typeof sel === "string") {
          dir = sel;
          dirInput.value = sel;
          updateButtons();
        }
      } catch (err) {
        showAlert(`Folder picker error: ${err}`);
      }
    });

    dlBtn.addEventListener("click", async () => {
      const url = urlInput.value.trim();
      if (!url || !dir) return;
      const format = formatSelect.value as "bestVideo" | "bestAudio" | "mp3";
      progressWrap.style.display = "";
      progressEl.value = 0;
      setStatus("starting…");
      state = "running";
      updateButtons();
      try {
        const { id } = await tauri.downloadYoutube(url, format, dir);
        activeId = id;
      } catch (err) {
        state = "idle";
        progressWrap.style.display = "none";
        updateButtons();
        showAlert(`Download failed to start: ${err}`);
      }
    });

    cancelBtn.addEventListener("click", async () => {
      if (!activeId) return;
      try {
        await tauri.cancelDownload(activeId);
      } catch (err) {
        showAlert(`Cancel error: ${err}`);
      }
    });

    updateBtn.addEventListener("click", async () => {
      updateBtn.disabled = true;
      const originalLabel = updateBtn.textContent ?? "Update yt-dlp";
      updateBtn.textContent = "Updating…";
      try {
        const msg = await tauri.updateYtDlp();
        showAlert(`yt-dlp updated: ${msg}`);
      } catch (err) {
        showAlert(`Update failed: ${err}`);
      } finally {
        updateBtn.textContent = originalLabel;
        updateBtn.disabled = false;
      }
    });

    const unlistenPromise = tauri.onYoutubeProgress((p: YoutubeProgress) => {
      // Only react to the current download id.
      if (activeId !== null && p.id !== activeId) return;
      if (p.status === "downloading" && typeof p.percent === "number") {
        progressEl.value = p.percent;
        const eta = p.eta ?? "?";
        const speed = p.speed ?? "?";
        setStatus(`${p.percent.toFixed(1)}% • ${speed} • ETA ${eta}`);
        return;
      }
      if (p.status === "finished") {
        progressEl.value = 100;
        setStatus("finished");
        state = "done";
        // Re-enable for another download, but keep the progress bar visible.
        setTimeout(() => {
          activeId = null;
          state = "idle";
          updateButtons();
        }, 1500);
        return;
      }
      if (p.status === "error") {
        const msg = p.error ?? "unknown error";
        setStatus(`error: ${msg}`);
        state = "done";
        showAlert(`yt-dlp error: ${msg}`);
        setTimeout(() => {
          activeId = null;
          state = "idle";
          updateButtons();
        }, 1500);
        return;
      }
    });

    const controller: SectionController = {
      destroy() {
        // Spec: must unlisten so the listener doesn't fire after the section is gone.
        void unlistenPromise.then((un) => un());
        // If a download is mid-flight, ask the backend to kill it too.
        if (activeId) {
          void tauri.cancelDownload(activeId).catch(() => {});
          activeId = null;
        }
      },
    };

    (root as HTMLElement & { _controller?: SectionController })._controller = controller;
    updateButtons();
    return root;
  },
};
