import type { Section, SectionController } from "./types";
import { translateIcon } from "../icons";

async function streamTranslate(
  baseUrl: string,
  model: string,
  system: string,
  user: string,
  output: HTMLDivElement,
  signal: AbortSignal,
) {
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
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
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            if (!gotAny) {
              output.textContent = "";
              gotAny = true;
            }
            output.textContent += content;
          }
        } catch {
          /* ignore */
        }
      }
    }
  }
  if (!gotAny) output.textContent = "(empty response)";
}

export const translateSection: Section = {
  id: "translate",
  label: "Translate",
  icon: translateIcon,
  render(ctx): HTMLElement {
    const root = document.createElement("div");
    root.className = "panel";
    root.innerHTML = `
      <h2>Translate</h2>
      <textarea id="translate-text" placeholder="Text to translate..."></textarea>
      <div class="row">
        <select id="translate-source">
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
        <span>→</span>
        <select id="translate-target">
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
        <button id="btn-translate">Translate</button>
      </div>
      <div id="translate-output" class="output"></div>
    `;

    const button = root.querySelector<HTMLButtonElement>("#btn-translate")!;
    const text = root.querySelector<HTMLTextAreaElement>("#translate-text")!;
    const source = root.querySelector<HTMLSelectElement>("#translate-source")!;
    const target = root.querySelector<HTMLSelectElement>("#translate-target")!;
    const output = root.querySelector<HTMLDivElement>("#translate-output")!;
    let aborter: AbortController | null = null;

    const onTranslate = () => {
      const t = text.value.trim();
      if (!t) return;
      if (source.value === target.value) {
        output.textContent = "Source and target must differ.";
        return;
      }
      output.innerHTML = `<div class="loading"><div class="spinner"></div>Translating...</div>`;
      aborter?.abort();
      aborter = new AbortController();
      const direction = `${source.value.toUpperCase()} -> ${target.value.toUpperCase()}`;
      const system =
        "You are a professional translator. Return ONLY the translated text, with no explanations, notes, or extra formatting.";
      const user = `Translate the following text from ${direction}:\n\n${t}`;
      streamTranslate(
        ctx.config.server.url,
        "qwen2.5:3b",
        system,
        user,
        output,
        aborter.signal,
      );
    };

    button.addEventListener("click", onTranslate);

    (root as HTMLElement & { _controller?: SectionController })._controller = {
      destroy() {
        aborter?.abort();
      },
    };
    return root;
  },
};
