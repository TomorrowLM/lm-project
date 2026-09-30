@echo off
setlocal
title WorkspaceSwitcher - 修复桌面黑屏
call "%~dp0..\desktop-black-screen-repair\Repair-DesktopBlackScreen.cmd"
if errorlevel 1 (
  echo.
  echo 修复失败。请确认这是在当前登录的 Windows 桌面中双击运行，而不是在服务或远程受限会话中运行。
  pause
  exit /b 1
)
echo.
echo 兼容入口执行完成。请先确认桌面和鼠标输入正常，再手动启动工作区应用。
pause
endlocal
