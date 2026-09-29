@echo off
setlocal
set OLLAMA_QWEN_SERVER_DIR=%~dp0
start "" "%~dp0src-tauri\target\release\codex-astartes.exe"
