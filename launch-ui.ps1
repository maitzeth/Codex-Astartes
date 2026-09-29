$env:OLLAMA_QWEN_SERVER_DIR = $PSScriptRoot
$exe = Join-Path $PSScriptRoot "src-tauri\target\release\codex-astartes.exe"
Start-Process -FilePath $exe -WorkingDirectory $PSScriptRoot
