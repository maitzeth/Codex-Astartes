import type { Section } from "./types";
import { restIcon, copyIcon } from "../icons";

function buildCurlExample(endpoint: string, method: string, body: string): string {
  const url = `${endpoint}`;
  if (method === "GET") return `curl ${url}`;
  return `curl -X ${method} ${url} \\\n  -H "Content-Type: application/json" \\\n  -d '${body}'`;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const restSection: Section = {
  id: "rest",
  label: "REST API",
  icon: restIcon,
  render(ctx): HTMLElement {
    const root = document.createElement("div");
    root.className = "panel";
    const baseUrl = ctx.config.server.url;

    root.innerHTML = `
      <h2>REST API (OpenAI-compatible)</h2>
      <p class="muted">Server: <code class="server-url">${baseUrl}</code></p>
      <p class="muted">Compatible with the OpenAI Chat Completions API. Spanify can point to <code>${baseUrl}/v1</code>.</p>
      <div class="examples">
        <div class="example">
          <div class="example-header">
            <strong>List models</strong>
            <button class="copy-btn secondary" data-copy="models">${copyIcon()} Copy</button>
          </div>
          <pre class="ex-models">${buildCurlExample(`${baseUrl}/v1/models`, "GET", "")}</pre>
        </div>
        <div class="example">
          <div class="example-header">
            <strong>Chat completion</strong>
            <button class="copy-btn secondary" data-copy="chat">${copyIcon()} Copy</button>
          </div>
          <pre class="ex-chat">${buildCurlExample(
            `${baseUrl}/v1/chat/completions`,
            "POST",
            JSON.stringify({
              model: "qwen2.5:3b",
              messages: [{ role: "user", content: "Hello" }],
              stream: false,
            })
          )}</pre>
        </div>
        <div class="example">
          <div class="example-header">
            <strong>Streaming (SSE)</strong>
            <button class="copy-btn secondary" data-copy="stream">${copyIcon()} Copy</button>
          </div>
          <pre class="ex-stream">curl -N ${baseUrl}/v1/chat/completions \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"qwen2.5:3b","messages":[{"role":"user","content":"Hi"}],"stream":true}'</pre>
        </div>
      </div>
    `;

    root.querySelectorAll<HTMLButtonElement>(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const key = btn.dataset.copy!;
        const pre = root.querySelector<HTMLPreElement>(`.ex-${key}`);
        if (!pre) return;
        const ok = await copy(pre.textContent || "");
        const original = btn.innerHTML;
        btn.innerHTML = ok ? "✓ Copied" : "✗ Failed";
        setTimeout(() => (btn.innerHTML = original), 1500);
      });
    });

    return root;
  },
};
