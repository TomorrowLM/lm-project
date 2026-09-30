@echo off
setlocal
title Windows 桌面黑屏诊断与恢复

echo.
echo 1. 只诊断（不修改系统）
echo 2. 安全修复（停止 WorkspaceSwitcher、恢复壁纸、重启 Explorer）
echo.
choice /C 12 /N /M "请选择 1 或 2："
if errorlevel 2 goto repair
if errorlevel 1 goto diagnose
goto end

:diagnose
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Repair-DesktopBlackScreen.ps1" -Mode Diagnose
set "exitCode=%errorlevel%"
goto report

:repair
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Repair-DesktopBlackScreen.ps1" -Mode Repair -StopWorkspaceSwitcher -HideKnownTopMostOverlay
set "exitCode=%errorlevel%"
goto report

:report
if not "%exitCode%"=="0" (
  echo.
  echo 修复脚本未成功执行，退出码：%exitCode%
  echo 请确认已允许管理员权限；详细日志位于 "%~dp0reports"。
) else (
  echo.
  echo 操作已完成。请查看上方诊断/修复报告，确认壁纸回读验证成功。
)

:end
echo.
echo WorkspaceSwitcher 不会由此脚本启动。
pause
endlocal & exit /b %exitCode%
