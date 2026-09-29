// Clipboard history view. PR 3 will replace this with the full implementation
// that subscribes to `clipboard://changed` events from the Rust poller.

export function renderClipboard(root: HTMLElement): void {
  root.innerHTML = `
    <h2>Tools</h2>
    <h3>Clipboard history</h3>
    <p class="muted">Coming in PR 3 — last 10 items copied to Windows clipboard.</p>
  `;
}
