param(
    [string]$ProjectRoot = (Join-Path $PSScriptRoot "..")
)

$ErrorActionPreference = "Stop"
$scriptPath = Join-Path $ProjectRoot "Repair-DesktopBlackScreen.ps1"
$wrapperPath = Join-Path $ProjectRoot "Repair-DesktopBlackScreen.cmd"
$readmePath = Join-Path $ProjectRoot "README.md"

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) {
        throw "FAIL: $Message"
    }
    Write-Host "PASS: $Message" -ForegroundColor Green
}

Assert-True (Test-Path -LiteralPath $scriptPath) "PowerShell 修复脚本存在"
Assert-True (Test-Path -LiteralPath $wrapperPath) "CMD 启动包装器存在"
Assert-True (Test-Path -LiteralPath $readmePath) "使用说明存在"

$scriptText = Get-Content -LiteralPath $scriptPath -Raw -Encoding UTF8
foreach ($marker in @(
    "Diagnose",
    "Repair",
    "SystemParametersInfo",
    "SPI_GETDESKWALLPAPER",
    "SPI_SETDESKWALLPAPER",
    "Get-Process -Name explorer",
    'Get-ProcessInfo "dwm"',
    "EnumWindows",
    "reg.exe export",
    "WorkspaceSwitcher",
    "Set-WallpaperSafely",
    "wallpaperWriteSucceeded",
    "WallpaperMismatch",
    "Test-IsAdministrator",
    "Web\Wallpaper\Windows\img0.jpg",
    "repairExitCode"
    "HideKnownTopMostOverlay"
    "ShowWindow"
    "ClickToDo"
)) {
    Assert-True ($scriptText.Contains($marker)) "脚本包含能力：$marker"
}

$cmdText = Get-Content -LiteralPath $wrapperPath -Raw -Encoding UTF8
Assert-True ($cmdText.Contains('-File "%~dp0Repair-DesktopBlackScreen.ps1"')) "CMD 直接使用脚本绝对路径"
Assert-True ($cmdText.Contains("exitCode=%errorlevel%")) "CMD 回报子进程退出码"
Assert-True ($cmdText.Contains("-Mode Repair")) "CMD 直接执行当前用户修复"
Assert-True ($cmdText.Contains("-HideKnownTopMostOverlay")) "CMD 启用已知覆盖层修复"
Assert-True ($cmdText.Contains("-StopWorkspaceSwitcher")) "CMD 传递工作区清理选项"
$cmdBytes = [System.IO.File]::ReadAllBytes($wrapperPath)
$cmdEncodingText = [System.Text.Encoding]::UTF8.GetString($cmdBytes)
Assert-True ($cmdEncodingText.Contains("`r`n")) "CMD 使用 Windows CRLF 换行"

$appSourceRoot = Join-Path $ProjectRoot "..\workspace-switcher\src"
$liveBackdropPath = Join-Path $appSourceRoot "WorkspaceSwitcher.LiveBackdrop.cs"
Assert-True (Test-Path -LiteralPath $liveBackdropPath) "工作区玻璃渲染源文件存在"
$liveBackdropText = Get-Content -LiteralPath $liveBackdropPath -Raw -Encoding UTF8
foreach ($marker in @(
    "ResolveWallpaperPath",
    "File.Exists(fallback)"
)) {
    Assert-True ($liveBackdropText.Contains($marker)) "面板玻璃回退能力：$marker"
}

Write-Host "全部契约测试通过。" -ForegroundColor Cyan
