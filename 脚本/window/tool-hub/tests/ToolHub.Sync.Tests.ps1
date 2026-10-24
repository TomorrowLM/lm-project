param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$ArtifactRoot = ''
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = [IO.Path]::GetFullPath($ProjectRoot)
if ([string]::IsNullOrWhiteSpace($ArtifactRoot)) {
    $ArtifactRoot = Join-Path $ProjectRoot 'build-test\sync'
}
$syncScript = Join-Path $ProjectRoot 'tools\sync-window-tools.ps1'
if (-not (Test-Path -LiteralPath $syncScript)) {
    throw "Sync script not found: $syncScript"
}

if (Test-Path -LiteralPath $ArtifactRoot) {
    Remove-Item -LiteralPath $ArtifactRoot -Recurse -Force
}

powershell.exe -NoProfile -ExecutionPolicy Bypass -File $syncScript `
    -ProjectRoot $ProjectRoot `
    -ArtifactRoot $ArtifactRoot `
    -SkipShortcut
if ($LASTEXITCODE -ne 0) {
    throw "Sync script failed with exit code $LASTEXITCODE"
}

$expectedFiles = @(
    (Join-Path $ArtifactRoot 'workspace-switcher\app\WorkspaceSwitcher.exe'),
    (Join-Path $ArtifactRoot 'Wallpaper-GUI\app\Wallpaper-GUI.cmd'),
    (Join-Path $ArtifactRoot 'desktop-black-screen-repair\app\Repair-DesktopBlackScreen.cmd'),
    (Join-Path $ArtifactRoot 'system-stability-diagnostics\app\SystemStabilityDiagnostics.exe'),
    (Join-Path $ArtifactRoot 'audio-scene\app\AudioScene.exe'),
    (Join-Path $ArtifactRoot 'audio-scene\app\AudioScene.Core.dll'),
    (Join-Path $ArtifactRoot 'tool-hub\app\ToolHub.exe'),
    (Join-Path $ArtifactRoot 'tool-hub\app\ToolHubLauncher.exe'),
    (Join-Path $ArtifactRoot 'tool-hub\app\ToolHubInstaller.exe'),
    (Join-Path $ArtifactRoot 'tool-hub\config\tool-roots.ini')
)
foreach ($expectedFile in $expectedFiles) {
    if (-not (Test-Path -LiteralPath $expectedFile -PathType Leaf)) {
        throw "Expected deployed file not found: $expectedFile"
    }
}

$toolRoots = Get-Content -Raw (Join-Path $ArtifactRoot 'tool-hub\config\tool-roots.ini')
if ($toolRoots -notmatch '(?m)^system-stability-diagnostics=') {
    throw 'System stability diagnostics entry is missing from tool-roots.ini'
}
if ($toolRoots -notmatch '(?m)^audio-scene=') {
    throw 'Audio scene entry is missing from tool-roots.ini'
}

Write-Output 'PASS ToolHub.Sync.Tests'
