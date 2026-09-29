import type { Section, SectionController } from "./types";
import { chatIcon } from "../icons";

const MODELS_CACHE: { url: string; models: string[] } = { url: "", models: [] };

async function fetchModels(baseUrl: string): Promise<string[]> {
  if (MODELS_CACHE.url === baseUrl && MODELS_CACHE.models.length) {
    return MODELS_CACHE.models;
  }
  try {
    const res = await fetch(`${baseUrl}/v1/models`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    const models = (data.data || []).map((m: { id: string }) => m.id);
    MODELS_CACHE.url = baseUrl;
    MODELS_CACHE.models = models;
    return models;
  } catch {
    return [];
  }
}

async function streamCompletion(
  baseUrl: string,
  body: { model: string; messages: { role: string; content: string }[] },
  output: HTMLDivElement,
  signal: AbortSignal,
) {
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });
  if (!res.ok || !res.body) {
    output.textContent = `Error: HTTP ${res.status}`;
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  output.textContent = "";
  let gotAny = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      for (const line of event.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta;
          const content = delta?.content;
          if (content) {
            if (!gotAny) {
              output.textContent = "";
              gotAny = true;
            }
            output.textContent += content;
          }
        } catch {
          /* ignore malformed chunks */
        }
      }
    }
  }
  if (!gotAny) output.textContent = "(empty response)";
}

export const chatSection: Section = {
  id: "chat",
  label: "Chat",
  icon: chatIcon,
  render(ctx): HTMLElement {
    const root = document.createElement("div");
    root.className = "panel";
    root.innerHTML = `
      <h2>Chat</h2>
      <div class="row">
        <label class="muted">Model:</label>
        <select id="chat-model"></select>
        <button id="btn-chat">Send</button>
      </div>
      <textarea id="chat-prompt" placeholder="Ask anything..."></textarea>
      <div id="chat-output" class="output"></div>
    `;

    const output = root.querySelector<HTMLDivElement>("#chat-output")!;
    const select = root.querySelector<HTMLSelectElement>("#chat-model")!;
    const button = root.querySelector<HTMLButtonElement>("#btn-chat")!;
    const promptEl = root.querySelector<HTMLTextAreaElement>("#chat-prompt")!;
    let aborter: AbortController | null = null;

    void (async () => {
      const models = await fetchModels(ctx.config.server.url);
      select.innerHTML = models.length
        ? models.map((m) => `<option value="${m}">${m}</option>`).join("")
        : '<option value="">default</option>';
    })();

    const onSend = () => {
      const prompt = promptEl.value.trim();
      if (!prompt) return;
      output.innerHTML = `<div class="loading"><div class="spinner"></div>Thinking...</div>`;
      aborter?.abort();
      aborter = new AbortController();
      const model = select.value || "qwen2.5:3b";
      streamCompletion(
        ctx.config.server.url,
        { model, messages: [{ role: "user", content: prompt }] },
        output,
        aborter.signal,
      );
    };

    button.addEventListener("click", onSend);

    const controller: SectionController = {
      destroy() {
        aborter?.abort();
      },
    };
    (root as HTMLElement & { _controller?: SectionController })._controller = controller;
    return root;
  },
};
