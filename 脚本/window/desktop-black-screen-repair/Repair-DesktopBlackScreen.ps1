[CmdletBinding()]
param(
    [ValidateSet("Diagnose", "Repair")]
    [string]$Mode = "Diagnose",
    [switch]$SkipExplorerRestart,
    [switch]$NoWallpaperChange,
    [switch]$ForceDefaultWallpaper,
    [switch]$StopWorkspaceSwitcher,
    [switch]$HideKnownTopMostOverlay,
    [switch]$DisableWorkspaceSwitcherStartup,
    [switch]$RunSystemFileCheck,
    [switch]$RunComponentStoreRepair,
    [string]$WallpaperPath = "",
    [string]$OutputDirectory = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$scriptDirectory = Split-Path -Parent $PSCommandPath
if ([string]::IsNullOrWhiteSpace($scriptDirectory)) {
    $scriptDirectory = (Get-Location).Path
}
$defaultOutputDirectory = Join-Path $scriptDirectory "reports"
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = $defaultOutputDirectory
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
if (-not (Test-Path -LiteralPath $OutputDirectory -PathType Container)) {
    throw "无法创建日志目录：$OutputDirectory"
}
$sessionName = Get-Date -Format "yyyyMMdd-HHmmss"
$sessionDirectory = Join-Path $OutputDirectory $sessionName
New-Item -ItemType Directory -Path $sessionDirectory -Force | Out-Null
if (-not (Test-Path -LiteralPath $sessionDirectory -PathType Container)) {
    throw "无法创建本次运行目录：$sessionDirectory"
}
$logPath = Join-Path $sessionDirectory "repair.log"
$reportPath = Join-Path $sessionDirectory "diagnostics.json"
$backupDirectory = Join-Path $sessionDirectory "registry-backup"

function Write-RepairLog {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,
        [ValidateSet("INFO", "WARN", "ERROR")]
        [string]$Level = "INFO"
    )

    $line = "[{0}] [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Message
    Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
    $color = "Cyan"
    if ($Level -eq "WARN") { $color = "Yellow" }
    if ($Level -eq "ERROR") { $color = "Red" }
    Write-Host $line -ForegroundColor $color
}

function Test-ReadableFile {
    param([string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return $false
    }

    try {
        if (-not (Test-Path -LiteralPath $Path -PathType Leaf -ErrorAction Stop)) {
            return $false
        }

        $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        $stream.Dispose()
        return $true
    }
    catch {
        return $false
    }
}

function Ensure-NativeTypes {
    if ("DesktopBlackScreenRepair.NativeMethods" -as [type]) {
        return
    }

    Add-Type @'
using System;
using System.Collections.Generic;
using System.Text;
using System.Runtime.InteropServices;

namespace DesktopBlackScreenRepair {
    public static class NativeMethods {
        public const uint SPI_GETDESKWALLPAPER = 0x0073;
        public const uint SPI_SETDESKWALLPAPER = 0x0014;
        public const uint SPIF_UPDATEINIFILE = 0x0001;
        public const uint SPIF_SENDWININICHANGE = 0x0002;

        [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern uint SystemParametersInfo(uint action, uint parameter, StringBuilder value, uint flags);

        [DllImport("user32.dll", EntryPoint = "SystemParametersInfoW", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern bool SystemParametersInfoSet(uint action, uint parameter, string value, uint flags);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        public static extern IntPtr SendMessageTimeout(
            IntPtr window,
            uint message,
            IntPtr wParam,
            IntPtr lParam,
            uint flags,
            uint timeout,
            out IntPtr result);

        public delegate bool EnumWindowsProc(IntPtr window, IntPtr data);

        [DllImport("user32.dll")]
        public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr data);

        [DllImport("user32.dll")]
        public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        public static extern int GetWindowText(IntPtr window, StringBuilder text, int maxCount);

        [DllImport("user32.dll")]
        public static extern int GetWindowTextLength(IntPtr window);

        [DllImport("user32.dll")]
        public static extern bool IsWindowVisible(IntPtr window);

        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr window, int command);

        [DllImport("user32.dll")]
        public static extern bool GetWindowRect(IntPtr window, out RECT rectangle);

        [DllImport("user32.dll", EntryPoint = "GetWindowLongW")]
        public static extern int GetWindowLong(IntPtr window, int index);

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        public class WindowInfo {
            public IntPtr Handle;
            public uint ProcessId;
            public string Title;
            public int Left;
            public int Top;
            public int Width;
            public int Height;
        }

        public static WindowInfo[] GetVisibleTopMostWindows() {
            List<WindowInfo> result = new List<WindowInfo>();
            EnumWindows(delegate(IntPtr window, IntPtr data) {
                if (!IsWindowVisible(window) || GetWindowTextLength(window) == 0) {
                    return true;
                }

                int extendedStyle = GetWindowLong(window, -20);
                if ((extendedStyle & 0x00000008) == 0) {
                    return true;
                }

                RECT rectangle;
                if (!GetWindowRect(window, out rectangle)) {
                    return true;
                }

                StringBuilder text = new StringBuilder(512);
                GetWindowText(window, text, text.Capacity);
                uint processId;
                GetWindowThreadProcessId(window, out processId);
                result.Add(new WindowInfo {
                    Handle = window,
                    ProcessId = processId,
                    Title = text.ToString(),
                    Left = rectangle.Left,
                    Top = rectangle.Top,
                    Width = Math.Max(0, rectangle.Right - rectangle.Left),
                    Height = Math.Max(0, rectangle.Bottom - rectangle.Top)
                });
                return true;
            }, IntPtr.Zero);
            return result.ToArray();
        }
    }
}
'@
}

function Get-WallpaperInfo {
    Ensure-NativeTypes
    $value = New-Object System.Text.StringBuilder 2048
    $apiResult = [DesktopBlackScreenRepair.NativeMethods]::SystemParametersInfo(
        [DesktopBlackScreenRepair.NativeMethods]::SPI_GETDESKWALLPAPER,
        [uint32]$value.Capacity,
        $value,
        0)
    $apiPath = $value.ToString()
    $registryPath = ""
    try {
        $registryPath = [string](Get-ItemProperty "HKCU:\Control Panel\Desktop" -Name WallPaper -ErrorAction Stop).WallPaper
    }
    catch {
    }

    if ([string]::IsNullOrWhiteSpace($registryPath)) {
        $desktopKey = $null
        try {
            $desktopKey = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey("Control Panel\Desktop")
            if ($null -ne $desktopKey) {
                $registryPath = [string]$desktopKey.GetValue("WallPaper", "")
            }
        }
        catch {
        }
        finally {
            if ($null -ne $desktopKey) { $desktopKey.Dispose() }
        }
    }

    $selectedPath = $apiPath
    if ([string]::IsNullOrWhiteSpace($selectedPath)) {
        $selectedPath = $registryPath
    }

    [pscustomobject]@{
        ApiSucceeded = ($apiResult -ne 0)
        ApiPath = $apiPath
        RegistryPath = $registryPath
        SelectedPath = $selectedPath
        Exists = (Test-Path -LiteralPath $selectedPath -PathType Leaf -ErrorAction SilentlyContinue)
        Readable = (Test-ReadableFile $selectedPath)
    }
}

function Get-ProcessInfo {
    param([string]$Name)

    $process = Get-Process -Name $Name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $process) {
        return [pscustomobject]@{ Name = $Name; Running = $false; Responding = $false; Id = $null; Path = $null }
    }

    $path = $null
    try { $path = $process.Path } catch { }
    [pscustomobject]@{
        Name = $Name
        Running = $true
        Responding = [bool]$process.Responding
        Id = $process.Id
        Path = $path
    }
}

function Get-TopMostOverlayInfo {
    Ensure-NativeTypes
    $result = @()
    foreach ($window in [DesktopBlackScreenRepair.NativeMethods]::GetVisibleTopMostWindows()) {
        $processName = ""
        try { $processName = (Get-Process -Id $window.ProcessId -ErrorAction Stop).ProcessName } catch { }
        $area = [int64]$window.Width * [int64]$window.Height
        if ($area -ge 100000) {
            $result += [pscustomobject]@{
                ProcessId = $window.ProcessId
                ProcessName = $processName
                Title = $window.Title
                Bounds = "{0},{1} {2}x{3}" -f $window.Left, $window.Top, $window.Width, $window.Height
                Area = $area
            }
        }
    }
    return $result
}

function Get-DesktopDiagnostics {
    $wallpaper = Get-WallpaperInfo
    $diagnostics = [ordered]@{
        Timestamp = (Get-Date).ToString("o")
        Computer = $env:COMPUTERNAME
        User = $env:USERNAME
        Mode = $Mode
        Explorer = Get-ProcessInfo "explorer"
        Dwm = Get-ProcessInfo "dwm"
        WorkspaceSwitcher = Get-ProcessInfo "WorkspaceSwitcher"
        Wallpaper = $wallpaper
        LargeTopMostWindows = @(Get-TopMostOverlayInfo)
        RecentDesktopErrors = @()
    }

    try {
        $startTime = (Get-Date).AddHours(-6)
        $diagnostics.RecentDesktopErrors = @(
            Get-WinEvent -FilterHashtable @{ LogName = "Application"; StartTime = $startTime } -ErrorAction Stop |
                Where-Object {
                    $_.ProviderName -match "Application Error|\.NET Runtime|Windows Error Reporting" -and
                    $_.Message -match "explorer\.exe|dwm\.exe|WorkspaceSwitcher|ShellExperienceHost"
                } |
                Select-Object -First 20 TimeCreated, ProviderName, Id, LevelDisplayName, Message
        )
    }
    catch {
        $diagnostics.RecentDesktopErrors = @([pscustomobject]@{ Error = $_.Exception.Message })
    }

    return [pscustomobject]$diagnostics
}

function Hide-KnownTopMostOverlay {
    Ensure-NativeTypes
    $hiddenCount = 0
    foreach ($window in [DesktopBlackScreenRepair.NativeMethods]::GetVisibleTopMostWindows()) {
        $process = Get-Process -Id $window.ProcessId -ErrorAction SilentlyContinue
        if ($null -eq $process -or $process.ProcessName -ne "ClickToDo") {
            continue
        }

        $area = [long]$window.Width * [long]$window.Height
        if ($area -lt 1000000) {
            continue
        }

        if ([DesktopBlackScreenRepair.NativeMethods]::ShowWindow($window.Handle, 0)) {
            $hiddenCount++
            Write-RepairLog ("已隐藏全屏 ClickToDo 覆盖层：{0},{1} {2}x{3}" -f $window.Left, $window.Top, $window.Width, $window.Height) "WARN"
        }
    }

    if ($hiddenCount -eq 0) {
        Write-RepairLog "未发现需要隐藏的全屏 ClickToDo 覆盖层"
    }
    else {
        Write-RepairLog ("已隐藏 ClickToDo 全屏覆盖层数量：{0}" -f $hiddenCount)
    }
    return $hiddenCount
}

function Save-Diagnostics {
    param([object]$Diagnostics)
    $Diagnostics | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $reportPath -Encoding UTF8
    Write-RepairLog "诊断报告：$reportPath"
}

function Backup-DesktopRegistry {
    New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
    $desktopBackup = Join-Path $backupDirectory "desktop.reg"
    $runBackup = Join-Path $backupDirectory "run.reg"
    $desktopKeyExists = Test-Path -LiteralPath "HKCU:\Control Panel\Desktop"
    $runKeyExists = Test-Path -LiteralPath "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
    $desktopCode = 0
    $runCode = 0
    if ($desktopKeyExists) {
        try {
            & reg.exe export "HKCU\Control Panel\Desktop" $desktopBackup /y 2>$null | Out-Null
            $desktopCode = $LASTEXITCODE
        }
        catch {
            $desktopCode = 1
            Write-RepairLog "reg.exe 不可用，跳过 Desktop 注册表导出；不会阻止后续修复" "WARN"
        }
    }
    else {
        Write-RepairLog "桌面注册表键不存在，跳过 Desktop 备份" "WARN"
    }
    if ($runKeyExists) {
        try {
            & reg.exe export "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" $runBackup /y 2>$null | Out-Null
            $runCode = $LASTEXITCODE
        }
        catch {
            $runCode = 1
            Write-RepairLog "reg.exe 不可用，跳过 Run 注册表导出；不会阻止后续修复" "WARN"
        }
    }
    else {
        Write-RepairLog "启动项注册表键不存在，跳过 Run 备份" "WARN"
    }
    Write-RepairLog ("注册表备份完成：Desktop={0}, Run={1}" -f $desktopCode, $runCode)
}

function Disable-WorkspaceSwitcherStartup {
    $keyPaths = @(
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run",
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce"
    )
    foreach ($keyPath in $keyPaths) {
        if (-not (Test-Path -LiteralPath $keyPath)) { continue }
        $values = Get-ItemProperty -LiteralPath $keyPath
        foreach ($property in $values.PSObject.Properties) {
            if ($property.Name -like "PS*" -or $null -eq $property.Value) { continue }
            if ([string]$property.Value -match "WorkspaceSwitcher\.exe") {
                Remove-ItemProperty -LiteralPath $keyPath -Name $property.Name -ErrorAction SilentlyContinue
                Write-RepairLog "已移除 WorkspaceSwitcher 启动项：$keyPath\$($property.Name)"
            }
        }
    }
}

function Set-WallpaperSafely {
    param([string]$Path)
    Ensure-NativeTypes
    if (-not (Test-ReadableFile $Path)) {
        Write-RepairLog "壁纸不可读，未写入系统：$Path" "WARN"
        return $false
    }

    $wallpaperCode = 0
    $styleCode = 0
    $tileCode = 0
    $desktopKey = $null
    try {
        $desktopKey = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey("Control Panel\Desktop")
        if ($null -eq $desktopKey) { throw "无法打开当前用户 Desktop 注册表键" }
        $desktopKey.SetValue("WallPaper", $Path, [Microsoft.Win32.RegistryValueKind]::String)
        $desktopKey.SetValue("WallpaperStyle", "10", [Microsoft.Win32.RegistryValueKind]::String)
        $desktopKey.SetValue("TileWallpaper", "0", [Microsoft.Win32.RegistryValueKind]::String)
    }
    catch {
        $wallpaperCode = 1
        $styleCode = 1
        $tileCode = 1
        Write-RepairLog ("当前用户壁纸注册表写入失败：{0}" -f $_.Exception.Message) "ERROR"
    }
    finally {
        if ($null -ne $desktopKey) { $desktopKey.Dispose() }
    }
    if ($wallpaperCode -ne 0 -or $styleCode -ne 0 -or $tileCode -ne 0) {
        Write-RepairLog ("壁纸注册表写入失败：Wallpaper={0}, WallpaperStyle={1}, TileWallpaper={2}" -f $wallpaperCode, $styleCode, $tileCode) "ERROR"
        return $false
    }

    $success = [DesktopBlackScreenRepair.NativeMethods]::SystemParametersInfoSet(
        [DesktopBlackScreenRepair.NativeMethods]::SPI_SETDESKWALLPAPER,
        0,
        $Path,
        [DesktopBlackScreenRepair.NativeMethods]::SPIF_UPDATEINIFILE -bor [DesktopBlackScreenRepair.NativeMethods]::SPIF_SENDWININICHANGE)
    if (-not $success) {
        $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        Write-RepairLog "壁纸 API 失败，Win32 错误码：$errorCode" "ERROR"
        return $false
    }

    $broadcastResult = [IntPtr]::Zero
    [DesktopBlackScreenRepair.NativeMethods]::SendMessageTimeout(
        [IntPtr]0xffff,
        0x001A,
        [IntPtr]::Zero,
        [IntPtr]::Zero,
        2,
        5000,
        [ref]$broadcastResult) | Out-Null
    $wallpaperInfo = Get-WallpaperInfo
    $verified = $wallpaperInfo.Readable -and (
        [String]::Equals($wallpaperInfo.SelectedPath, $Path, [StringComparison]::OrdinalIgnoreCase) -or
        [String]::Equals($wallpaperInfo.RegistryPath, $Path, [StringComparison]::OrdinalIgnoreCase))
    if ($verified) {
        Write-RepairLog "已恢复并验证壁纸：$Path"
    }
    else {
        Write-RepairLog "壁纸 API 返回成功，但回读验证失败：$Path" "ERROR"
    }
    return $verified
}

function Restart-ExplorerSafely {
    Write-RepairLog "重启 Explorer 外壳"
    Get-Process -Name explorer -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Start-Process -FilePath (Join-Path $env:SystemRoot "explorer.exe")
    Start-Sleep -Seconds 3
}

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Invoke-OptionalSystemRepair {
    if (-not ($RunSystemFileCheck -or $RunComponentStoreRepair)) { return }
    if (-not (Test-IsAdministrator)) {
        Write-RepairLog "SFC/DISM 需要管理员权限，已跳过。请用管理员 PowerShell 单独执行。" "WARN"
        return
    }

    if ($RunSystemFileCheck) {
        Write-RepairLog "开始 SFC /scannow；该操作可能需要较长时间"
        & sfc.exe /scannow
    }
    if ($RunComponentStoreRepair) {
        Write-RepairLog "开始 DISM /Online /Cleanup-Image /RestoreHealth；该操作可能需要较长时间"
        & dism.exe /Online /Cleanup-Image /RestoreHealth
    }
}

function Stop-WorkspaceSwitcherSafely {
    $processes = Get-Process -Name WorkspaceSwitcher -ErrorAction SilentlyContinue
    if ($null -eq $processes) {
        Write-RepairLog "WorkspaceSwitcher 未运行"
        return
    }
    $processes | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-RepairLog "已停止 WorkspaceSwitcher 进程"
}

Write-RepairLog "桌面黑屏工具启动，模式：$Mode"
$before = Get-DesktopDiagnostics
Save-Diagnostics $before
$wallpaperWriteSucceeded = $false
$repairExitCode = 0

if ($Mode -eq "Repair") {
    # 当前用户壁纸与受控覆盖层修复不需要管理员权限；SFC/DISM 在下方单独检查权限。
    Backup-DesktopRegistry

    if ($StopWorkspaceSwitcher) {
        $workspaceProcesses = Get-Process -Name WorkspaceSwitcher -ErrorAction SilentlyContinue
        if ($null -eq $workspaceProcesses) {
            Write-RepairLog "WorkspaceSwitcher 未运行"
        }
        else {
            $workspaceProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
            Write-RepairLog "已停止 WorkspaceSwitcher 进程"
        }
    }
    if ($HideKnownTopMostOverlay) {
        [void](Hide-KnownTopMostOverlay)
    }
    if ($DisableWorkspaceSwitcherStartup) {
        $keyPaths = @(
            "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run",
            "HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce"
        )
        foreach ($keyPath in $keyPaths) {
            if (-not (Test-Path -LiteralPath $keyPath)) { continue }
            $values = Get-ItemProperty -LiteralPath $keyPath
            foreach ($property in $values.PSObject.Properties) {
                if ($property.Name -like "PS*" -or $null -eq $property.Value) { continue }
                if ([string]$property.Value -match "WorkspaceSwitcher\.exe") {
                    Remove-ItemProperty -LiteralPath $keyPath -Name $property.Name -ErrorAction SilentlyContinue
                    Write-RepairLog "已移除 WorkspaceSwitcher 启动项：$keyPath\$($property.Name)"
                }
            }
        }
    }

    $wallpaperInfo = Get-WallpaperInfo
    $wallpaperMismatch = $false
    if (-not [string]::IsNullOrWhiteSpace($wallpaperInfo.ApiPath) -and
        -not [string]::IsNullOrWhiteSpace($wallpaperInfo.RegistryPath)) {
        $wallpaperMismatch = -not [string]::Equals(
            $wallpaperInfo.ApiPath.Trim(),
            $wallpaperInfo.RegistryPath.Trim(),
            [StringComparison]::OrdinalIgnoreCase)
    }
    if ($wallpaperMismatch) {
        Write-RepairLog "检测到 API 壁纸路径与注册表路径不一致，将在安全修复中重新同步" "WARN"
    }
    $wallpaperInfo | Add-Member -NotePropertyName WallpaperMismatch -NotePropertyValue $wallpaperMismatch -Force
    $targetWallpaper = $WallpaperPath
    if ($ForceDefaultWallpaper) {
        $targetWallpaper = Join-Path $env:SystemRoot "Web\Wallpaper\Windows\img0.jpg"
    }
    elseif ([string]::IsNullOrWhiteSpace($targetWallpaper) -and $wallpaperMismatch) {
        if ($wallpaperInfo.ApiSucceeded -and (Test-ReadableFile $wallpaperInfo.ApiPath)) {
            $targetWallpaper = $wallpaperInfo.ApiPath
            Write-RepairLog "当前 API 壁纸可读，选择它同步注册表和桌面设置：$targetWallpaper"
        }
        else {
            $targetWallpaper = Join-Path $env:SystemRoot "Web\Wallpaper\Windows\img0.jpg"
            Write-RepairLog "API 壁纸不可读，选择 Windows 默认壁纸作为安全回退：$targetWallpaper" "WARN"
        }
    }
    elseif ([string]::IsNullOrWhiteSpace($targetWallpaper) -and (-not $wallpaperInfo.Readable)) {
        $targetWallpaper = Join-Path $env:SystemRoot "Web\Wallpaper\Windows\img0.jpg"
        Write-RepairLog "当前壁纸不可读，选择 Windows 默认壁纸作为安全回退：$targetWallpaper" "WARN"
    }

    if (-not $NoWallpaperChange -and -not [string]::IsNullOrWhiteSpace($targetWallpaper)) {
        $wallpaperWriteSucceeded = Set-WallpaperSafely $targetWallpaper
        if (-not $wallpaperWriteSucceeded) {
            $repairExitCode = 1
        }
    }
    elseif ($NoWallpaperChange) {
        Write-RepairLog "已指定 NoWallpaperChange，不修改壁纸"
    }
    else {
        Write-RepairLog "当前壁纸可读，不修改壁纸"
    }

    if (-not $SkipExplorerRestart) {
        Write-RepairLog "重启 Explorer 外壳"
        Get-Process -Name explorer -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Start-Process -FilePath (Join-Path $env:SystemRoot "explorer.exe")
        Start-Sleep -Seconds 3
    }
    else {
        Write-RepairLog "已指定 SkipExplorerRestart，不重启 Explorer"
    }

    if ($RunSystemFileCheck -or $RunComponentStoreRepair) {
        $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
        $principal = New-Object Security.Principal.WindowsPrincipal($identity)
        $isAdministrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
        if (-not $isAdministrator) {
            Write-RepairLog "SFC/DISM 需要管理员权限，已跳过。" "WARN"
        }
        else {
            if ($RunSystemFileCheck) {
                Write-RepairLog "开始 SFC /scannow；该操作可能需要较长时间"
                & sfc.exe /scannow
            }
            if ($RunComponentStoreRepair) {
                Write-RepairLog "开始 DISM /Online /Cleanup-Image /RestoreHealth；该操作可能需要较长时间"
                & dism.exe /Online /Cleanup-Image /RestoreHealth
            }
        }
    }
    $after = Get-DesktopDiagnostics
    Save-Diagnostics $after
    if (-not $NoWallpaperChange -and -not [string]::IsNullOrWhiteSpace($targetWallpaper) -and (-not $after.Wallpaper.Readable)) {
        Write-RepairLog "修复结束后仍无法读取当前壁纸，已返回失败状态。" "ERROR"
        $repairExitCode = 1
    }
    Write-RepairLog "修复流程结束；WorkspaceSwitcher 不会被本脚本启动"
}

$finalDiagnostics = if ($Mode -eq "Repair") { $after } else { $before }
$finalDiagnostics | ConvertTo-Json -Depth 10
Write-Host "日志目录：$sessionDirectory" -ForegroundColor Cyan
if ($repairExitCode -ne 0) {
    exit $repairExitCode
}
