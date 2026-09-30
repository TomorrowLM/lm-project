@echo off
setlocal
set "APP=%~dp0..\..\..\..\tool-hub\build\ToolHub.exe"

if not exist "%APP%" (
  echo ToolHub.exe not found: "%APP%"
  echo Build D:\LM\tool-hub first with build.ps1.
  exit /b 1
)

start "Windows ToolHub" "%APP%"
endlocal
