# Creates two desktop shortcuts:
# 1. "Codex-Astartes Server" - toggle start/stop of the LexiLocal backend
# 2. "Codex-Astartes"       - opens the native UI

$projectDir = $PSScriptRoot
$desktop = [Environment]::GetFolderPath("Desktop")

function New-DesktopShortcut {
    param(
        [string]$Name,
        [string]$Target,
        [string]$Arguments = "",
        [string]$WorkingDir,
        [string]$IconPath
    )

    $shortcutPath = Join-Path $desktop "$Name.lnk"
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $Target
    $shortcut.Arguments = $Arguments
    $shortcut.WorkingDirectory = $WorkingDir
    $shortcut.WindowStyle = 7  # Minimized (for toggle script console)
    if ($IconPath -and (Test-Path $IconPath)) {
        $shortcut.IconLocation = "$IconPath,0"
    }
    $shortcut.Save()
    Write-Host "[+] Created: $shortcutPath" -ForegroundColor Green
}

# 1. Toggle server shortcut
$toggleScript = Join-Path $projectDir "toggle-server.ps1"
$powershell = (Get-Command powershell.exe).Source
New-DesktopShortcut -Name "Codex-Astartes Server" `
    -Target $powershell `
    -Arguments "-NoProfile -ExecutionPolicy Bypass -File `"$toggleScript`"" `
    -WorkingDir $projectDir

# 2. UI shortcut
$uiExe = Join-Path $projectDir "src-tauri\target\release\codex-astartes.exe"
if (Test-Path $uiExe) {
    New-DesktopShortcut -Name "Codex-Astartes" `
        -Target $uiExe `
        -WorkingDir $projectDir `
        -IconPath $uiExe
} else {
    Write-Host "[!] UI exe not found at $uiExe" -ForegroundColor Yellow
    Write-Host "    Run: npm run tauri:build" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done. Shortcuts created on your desktop." -ForegroundColor Cyan
Read-Host "Press Enter to close"
