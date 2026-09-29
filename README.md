# Codex-Astartes

Native Windows desktop UI for the **LexiLocal** backend — a local Ollama-powered REST server with an OpenAI-compatible API.

- Connects to LexiLocal via `http://localhost:8000` (or any URL you point it at, including a backend on another machine on your LAN).
- Can **start and stop the backend** locally from the sidebar.
- Built with Tauri v2 + vanilla TypeScript. No frontend framework.

---

## Features

- **Sidebar navigation**: Chat · Translate · Tools · REST API · Activity · Settings
- **Chat**: model selector from `/v1/models`, SSE-streamed completions via `/v1/chat/completions`
- **Translate**: EN ↔ ES, streaming, system prompt built in
- **Tools → Clipboard history**: last 10 items copied to Windows clipboard, with Copy / Send to Chat / Send to Translate actions. Persisted to `config.toml`.
- **REST API**: copyable curl examples for `/v1/models`, `/v1/chat/completions`, and SSE streaming
- **Activity Log**: recent requests with timestamps, client IPs, method, path, status, REQ/RES bodies
- **Settings**: backend directory picker (folder dialog), base URL editor, theme switcher
- **First-run setup screen**: pick the backend install directory on first launch
- **Light/dark theme**: toggle in the sidebar footer, persisted

---

## Prerequisites

- Windows 10 or 11 (x64)
- [Node.js](https://nodejs.org) 20+ (to build from source)
- [Rust](https://rustup.rs/) + Cargo
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/) with the **C++ workload**
- [Git for Windows](https://git-scm.com/) (Git Bash — used by the Start/Stop buttons to run `run.sh`)
- A running [LexiLocal](https://github.com/maitzeth/LexiLocal) backend

## Build

```bash
git clone https://github.com/maitzeth/Codex-Astartes.git
cd Codex-Astartes
npm install
npm run tauri:build
```

Outputs:

- Portable: `src-tauri/target/release/codex-astartes.exe`
- NSIS installer: `src-tauri/target/release/bundle/nsis/Codex-Astartes_1.0.0_x64-setup.exe`

The installer creates Start Menu + Desktop shortcuts.

## Run in development mode

```bash
npm install
npm run tauri:dev
```

Vite serves on `localhost:1420` and Tauri opens a window pointing at it. Hot reload works for TypeScript changes; Rust changes trigger rebuild + restart.

---

## First-run setup

On first launch, the app shows a setup screen because there's no `config.toml` yet. Browse to your LexiLocal install directory (the folder that contains `run.sh`) and save. The choice is persisted in `config.toml` next to the executable.

You can change it later in **Settings → Backend install directory**.

---

## Configuration (`config.toml`)

The config file lives in the same directory as the executable. For the NSIS-installed app, that is `%LocalAppData%\Codex-Astartes\config.toml`.

```toml
[server]
# Absolute path to the LexiLocal backend install directory.
dir = "C:\\Users\\andre\\Documents\\Projects\\ollama-qwen-server"
# Base URL the frontend uses to reach the backend.
url = "http://localhost:8000"

[ui]
theme = "dark"   # or "light"

[clipboard]
poll_ms = 750
max_items = 10
items = [
  { timestamp = "2026-09-29T12:34:56-03:00", text = "Hello world" },
  # …
]
```

Writes are atomic (write to `config.toml.tmp` then rename). Corrupted configs are preserved as `config.toml.broken-<unix-ts>` and defaults are written.

---

## Quick launch scripts

- `launch-ui.bat` — sets `OLLAMA_QWEN_SERVER_DIR` and launches the built `.exe`.
- `toggle-server.ps1` — toggles the backend start/stop from a terminal.
- `create-desktop-shortcut.ps1` — creates **Codex-Astartes Server** (toggle) and **Codex-Astartes** (UI) shortcuts on your desktop.

```powershell
powershell -ExecutionPolicy Bypass -File .\create-desktop-shortcut.ps1
```

---

## Architecture

```
src-tauri/src/
├── main.rs        # tauri::Builder, plugins, AppState, command registration
├── config.rs      # Config struct, TOML load/save with atomic writes
├── commands.rs    # all #[tauri::command] entry points
├── server.rs      # backend (bash run.sh) lifecycle
└── clipboard.rs   # background polling + emit 'clipboard://changed'

src/
├── main.ts        # shell + sidebar + setup overlay + theme toggle
├── styles.css     # dark + light CSS variables
├── icons.ts       # inline Lucide-style SVG icons
├── lib/
│   ├── tauri.ts   # typed wrappers around invoke()
│   └── theme.ts   # applyTheme(theme)
├── sections/
│   ├── types.ts   # Section, SectionController, SectionContext
│   ├── chat.ts
│   ├── translate.ts
│   ├── tools.ts
│   ├── rest.ts
│   ├── activity.ts
│   └── settings.ts
└── tools/
    └── clipboard.ts  # view + actions for clipboard history
```

---

## Troubleshooting

### "Backend directory not configured. Open Settings to set it."

The setup screen didn't run (you already configured once and the path is empty or invalid). Open **Settings** and pick a valid directory that contains `run.sh`.

### Start/Stop buttons do nothing

The UI spawns `bash <backend_dir>/run.sh start|stop`. Make sure Git Bash is installed and `bash` is on the system `PATH`.

### Cannot reach backend at the configured URL

If the backend is on another machine on your LAN, change **Settings → Backend base URL** to that machine's IP (e.g. `http://192.168.1.6:8000`). Also open port 8000 in that machine's firewall.

### Clipboard history is empty

The poller reads the system clipboard every `poll_ms` (default 750ms) **while the app is running**. Copy something to the clipboard after the app is open and it should appear within ~1 second. Use **Tools → Resume** if you paused polling.

---

## License

MIT.
