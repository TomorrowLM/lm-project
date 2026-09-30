param(
    [ValidateSet('Diagnose', 'Repair')]
    [string]$Mode = 'Diagnose',
    [string]$WallpaperPath = '',
    [switch]$SkipExplorerRestart,
    [switch]$StopWorkspaceSwitcher,
    [switch]$HideKnownTopMostOverlay,
    [switch]$NoWallpaperChange,
    [string]$OutputDirectory = ''
)

# Legacy entry point. Delegate to the canonical safety script.
$scriptFolderName = ([char]0x811A).ToString() + ([char]0x672C).ToString()
$canonicalScript = 'D:\LM\lm-project\' + $scriptFolderName + '\window\desktop-black-screen-repair\Repair-DesktopBlackScreen.ps1'
if (-not (Test-Path -LiteralPath $canonicalScript)) {
    throw "Canonical repair script was not found: $canonicalScript"
}

$safeWallpaperPath = if ($null -eq $WallpaperPath) { '' } else { [string]$WallpaperPath }
$safeOutputDirectory = if ($null -eq $OutputDirectory) { '' } else { [string]$OutputDirectory }
$forwardFlags = @()
if ($PSBoundParameters.ContainsKey('SkipExplorerRestart')) { $forwardFlags += '-SkipExplorerRestart' }
if ($PSBoundParameters.ContainsKey('StopWorkspaceSwitcher')) { $forwardFlags += '-StopWorkspaceSwitcher' }
if ($PSBoundParameters.ContainsKey('HideKnownTopMostOverlay')) { $forwardFlags += '-HideKnownTopMostOverlay' }
if ($PSBoundParameters.ContainsKey('NoWallpaperChange')) { $forwardFlags += '-NoWallpaperChange' }
$childArgumentLine = "-NoProfile -ExecutionPolicy Bypass -File `"$canonicalScript`" -Mode `"$Mode`" -WallpaperPath `"$safeWallpaperPath`" -OutputDirectory `"$safeOutputDirectory`" $($forwardFlags -join ' ')"
Write-Host "Forwarding to canonical repair script."
$child = Start-Process -FilePath 'powershell.exe' -ArgumentList $childArgumentLine -Wait -PassThru -NoNewWindow
exit $child.ExitCode

<#
$ErrorActionPreference = "Stop"

function Write-RepairStatus([string]$Message) {
    Write-Host ("[WorkspaceSwitcher 修复] " + $Message) -ForegroundColor Cyan
}

$backupRoot = Join-Path "D:\LM\workspace-switcher-desktop-repair-backups" (Get-Date -Format 'yyyyMMdd-HHmmss')
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

Write-RepairStatus "停止 WorkspaceSwitcher，避免它继续影响桌面显示"
Get-Process -Name WorkspaceSwitcher -ErrorAction SilentlyContinue | Stop-Process -Force

Write-RepairStatus "备份桌面和启动项注册表"
# 使用 reg.exe 导出，避免 PowerShell 对注册表对象序列化时丢失值。
& reg.exe export "HKCU\Control Panel\Desktop" (Join-Path $backupRoot "desktop.reg") /y | Out-Null
& reg.exe export "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" (Join-Path $backupRoot "run.reg") /y | Out-Null

Write-RepairStatus "移除仅属于 WorkspaceSwitcher 的自动启动项"
$runKeyPaths = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce"
)
foreach ($runKeyPath in $runKeyPaths) {
    if (-not (Test-Path $runKeyPath)) {
        continue
    }

    $runValues = Get-ItemProperty $runKeyPath
    foreach ($property in $runValues.PSObject.Properties) {
        if ($property.Name -like "PS*" -or $null -eq $property.Value) {
            continue
        }

        if ([string]$property.Value -match "WorkspaceSwitcher\.exe") {
            Remove-ItemProperty -Path $runKeyPath -Name $property.Name -ErrorAction SilentlyContinue
        }
    }
}

$currentWallpaper = ""
try {
    $desktopKey = Get-ItemProperty "HKCU:\Control Panel\Desktop" -ErrorAction Stop
    $currentWallpaper = [string]$desktopKey.WallPaper
} catch {
    Write-RepairStatus "读取当前壁纸失败，将使用 Windows 默认壁纸"
}

if ([string]::IsNullOrWhiteSpace($WallpaperPath) -and (Test-Path -LiteralPath $currentWallpaper)) {
    $WallpaperPath = $currentWallpaper
}

if ([string]::IsNullOrWhiteSpace($WallpaperPath) -or -not (Test-Path -LiteralPath $WallpaperPath)) {
    $WallpaperPath = Join-Path $env:SystemRoot "Web\Wallpaper\Windows\img0.jpg"
}

if (-not (Test-Path -LiteralPath $WallpaperPath)) {
    throw "找不到可用壁纸：$WallpaperPath"
}

Write-RepairStatus "设置壁纸：$WallpaperPath"
# 先写入标准用户配置；在受限环境中失败时仍继续调用官方壁纸 API。
 $registryApplied = $false
try {
    & reg.exe add "HKCU\Control Panel\Desktop" /v WallPaper /t REG_SZ /d $WallpaperPath /f | Out-Null
    $wallpaperValueApplied = $LASTEXITCODE -eq 0
    & reg.exe add "HKCU\Control Panel\Desktop" /v WallpaperStyle /t REG_SZ /d 10 /f | Out-Null
    $styleValueApplied = $LASTEXITCODE -eq 0
    & reg.exe add "HKCU\Control Panel\Desktop" /v TileWallpaper /t REG_SZ /d 0 /f | Out-Null
    $tileValueApplied = $LASTEXITCODE -eq 0
    $registryApplied = $wallpaperValueApplied -and $styleValueApplied -and $tileValueApplied
    if (-not $registryApplied) {
        Write-RepairStatus "部分桌面配置写入失败，继续使用 Windows 壁纸 API"
    }
} catch {
    Write-RepairStatus "注册表写入被当前权限拦截，继续使用 Windows 壁纸 API"
}

if (-not ([System.Management.Automation.PSTypeName]"DesktopBlackScreenRepair.NativeMethods").Type) {
    Add-Type @'
using System;
using System.Runtime.InteropServices;

namespace DesktopBlackScreenRepair {
    public static class NativeMethods {
        [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern bool SystemParametersInfo(uint action, uint parameter, string value, uint flags);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        public static extern IntPtr SendMessageTimeout(
            IntPtr window,
            uint message,
            IntPtr wParam,
            IntPtr lParam,
            uint flags,
            uint timeout,
            out IntPtr result);
    }
}
'@
}

$wallpaperApplied = [DesktopBlackScreenRepair.NativeMethods]::SystemParametersInfo(20, 0, $WallpaperPath, 3)
if (-not $wallpaperApplied -and -not $registryApplied) {
    $lastError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    Write-RepairStatus "壁纸 API 未成功（Win32 错误码：$lastError），尝试刷新用户桌面配置"
    $rundll32 = Join-Path $env:SystemRoot "System32\rundll32.exe"
    if (Test-Path -LiteralPath $rundll32) {
        Start-Process -FilePath $rundll32 -ArgumentList "user32.dll,UpdatePerUserSystemParameters" -Wait
    }
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

if (-not $SkipExplorerRestart) {
    Write-RepairStatus "重启 Explorer 外壳，重新绘制桌面"
    Get-Process explorer -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
    Start-Process -FilePath (Join-Path $env:SystemRoot "explorer.exe")
    Start-Sleep -Seconds 3
}

$savedWallpaper = ""
try {
    $savedWallpaper = [string](Get-ItemProperty "HKCU:\Control Panel\Desktop" -ErrorAction Stop).WallPaper
} catch {
    $savedWallpaper = $WallpaperPath
}
$explorerReady = $null -ne (Get-Process explorer -ErrorAction SilentlyContinue)
$workspaceSwitcherReady = $null -ne (Get-Process -Name WorkspaceSwitcher -ErrorAction SilentlyContinue)

Write-RepairStatus "完成"
[pscustomobject]@{
    WallpaperPath = $savedWallpaper
    WallpaperApiSucceeded = $wallpaperApplied
    RegistryWallpaperApplied = $registryApplied
    ExplorerRunning = $explorerReady
    WorkspaceSwitcherRunning = $workspaceSwitcherReady
    BackupDirectory = $backupRoot
} | Format-List
#>
