# Codex-Astartes

Native Windows desktop UI for the **LexiLocal** backend (a local Ollama-powered REST server).

**Status:** initial import from the LexiLocal monorepo. The Tauri app is being split into its own repo as part of the `split-tauri-repo` SDD change. See [`LexiLocal/openspec/changes/split-tauri-repo/`](https://github.com/maitzeth/LexiLocal/tree/master/openspec/changes/split-tauri-repo) for the design.

## Prerequisites

- [Node.js](https://nodejs.org) 20+
- [Rust](https://rustup.rs/) + Cargo
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/) with the **C++ workload** (Windows)
- A running [LexiLocal](https://github.com/maitzeth/LexiLocal) backend

## Build

```bash
npm install
npm run tauri:build
```

Outputs:

- Portable: `src-tauri/target/release/codex-astartes.exe`
- NSIS installer: `src-tauri/target/release/bundle/nsis/Codex-Astartes_<version>_x64-setup.exe`

## Quick launch

```bash
# Build first, then:
launch-ui.bat          # or .\launch-ui.ps1 from PowerShell
```

## Desktop shortcuts

```powershell
powershell -ExecutionPolicy Bypass -File .\create-desktop-shortcut.ps1
```

This creates **Codex-Astartes Server** (toggle) and **Codex-Astartes** (UI) shortcuts on your desktop.

## License

MIT.
