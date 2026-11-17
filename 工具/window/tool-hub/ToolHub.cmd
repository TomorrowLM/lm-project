@echo off
setlocal
set "APP=%USERPROFILE%\.lm-exe\tool-hub\app\ToolHubLauncher.exe"
if not exist "%APP%" (
    echo ToolHub is not deployed. Run tools\sync-window-tools.ps1 first.
    exit /b 1
)
start "Windows ToolHub" "%APP%"
endlocal
