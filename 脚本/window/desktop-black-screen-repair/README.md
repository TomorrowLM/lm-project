# Windows 桌面黑屏诊断与恢复工具

这个工具用于处理 Windows 桌面变黑、壁纸消失、Explorer 崩溃或桌面刷新失败等问题。它是独立工具，不依赖 WorkspaceSwitcher；默认只诊断，不自动改系统。

## 快速使用

双击：

```text
Repair-DesktopBlackScreen.cmd
```

然后选择：

1. 只诊断：不停止进程、不改壁纸、不改注册表。
2. 安全修复：停止 WorkspaceSwitcher（如果正在运行）、恢复无法读取的壁纸、隐藏已识别的全屏覆盖层、重启 Explorer。普通壁纸和覆盖层修复在当前用户权限下直接执行；只有显式启用 SFC/DISM 时才需要管理员权限。

如果目标是恢复黑屏，选择 `2` 即可。CMD 现在会显示子进程退出码；只有看到“壁纸已恢复并验证”相关日志，才表示壁纸真的写入并回读成功。选择 `1` 只会生成诊断报告，不会改变黑屏状态。

PowerShell 直接使用：

```powershell
# 只诊断
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Repair-DesktopBlackScreen.ps1 -Mode Diagnose

# 安全恢复
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Repair-DesktopBlackScreen.ps1 -Mode Repair -StopWorkspaceSwitcher

# 只重启 Explorer，不改壁纸
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Repair-DesktopBlackScreen.ps1 -Mode Repair -StopWorkspaceSwitcher -NoWallpaperChange

# 明确指定一张壁纸
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Repair-DesktopBlackScreen.ps1 -Mode Repair -WallpaperPath "C:\Path\wallpaper.jpg"
```

## 覆盖的常见原因

- `explorer.exe` 崩溃、未启动或桌面外壳没有重新绘制。
- DWM 进程异常或无响应。工具只检测并记录，不强制结束 DWM。
- Windows Spotlight、Dynamic Theme、OneDrive 或网络壁纸路径存在但当前用户不可读取。
- 壁纸注册表值为空、指向不存在文件，或壁纸 API 与注册表状态不一致。
- 大面积 TopMost 窗口覆盖桌面。工具只报告窗口标题和进程，不自动关闭未知应用。
- Windows 的 `ClickToDo.exe` 全屏置顶层覆盖桌面。安全修复入口只隐藏它的全屏窗口，不结束进程；未知 TopMost 窗口仍只报告不处理。
- WorkspaceSwitcher 残留进程、窗口层或键盘钩子影响桌面交互。只有传入 `-StopWorkspaceSwitcher` 才会停止它。
- Explorer 重启后桌面图标、任务栏和壁纸没有重新加载。

## 安全边界

- 默认 `-Mode Diagnose` 是只读操作。
- `-Mode Repair` 会备份以下用户注册表键：
  - `HKCU\Control Panel\Desktop`
  - `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
- 备份和日志默认位于修复脚本旁的 `reports` 目录：

```text
D:\LM\lm-project\脚本\window\desktop-black-screen-repair\reports\yyyyMMdd-HHmmss\
```

- 不删除文件，不结束未知应用，不修改其他启动项，不启动 WorkspaceSwitcher。
- 只对明确识别为 `ClickToDo.exe` 且面积达到全屏阈值的窗口调用隐藏，不结束该进程；需要恢复时重新打开对应功能即可。
- 只有在当前壁纸不可读、或显式传入 `-WallpaperPath` / `-ForceDefaultWallpaper` 时才会设置壁纸。
- `-RunSystemFileCheck` 和 `-RunComponentStoreRepair` 默认关闭，并且需要管理员 PowerShell；它们只在用户显式传参时执行。
- 不直接重启 DWM，避免导致显示器闪烁或登录会话中断。
- 安全修复会检查 `reg.exe` 写入、`SystemParametersInfo` 返回值和壁纸回读结果；任一步失败都会记录 ERROR 并返回非零退出码，不再把失败当成成功。
- WorkspaceSwitcher 面板自身在动态壁纸路径不可读时只回退到 `C:\Windows\Web\Wallpaper\Windows\img0.jpg` 绘制面板背景，不会修改系统桌面壁纸。

## 诊断输出

每次运行都会生成：

- `repair.log`：按时间记录执行步骤和错误。
- `diagnostics.json`：Explorer、DWM、WorkspaceSwitcher、壁纸读写状态、TopMost 大窗口和近期桌面相关错误。

## 回滚

工具不会自动删除备份。若需要恢复原来的桌面注册表配置，可在管理员或当前用户 PowerShell 中执行：

```powershell
reg.exe import ".\registry-backup\desktop.reg"
reg.exe import ".\registry-backup\run.reg"
Stop-Process -Name explorer -Force
Start-Process explorer.exe
```

## 测试

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\Test-RepairDesktopBlackScreen.ps1
```
