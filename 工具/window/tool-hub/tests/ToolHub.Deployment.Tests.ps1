param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$failures = 0

function Assert-Contains {
    param(
        [string]$Content,
        [string]$Expected,
        [string]$Message
    )

    if ($Content.Contains($Expected)) {
        return
    }

    $script:failures++
    Write-Output ("FAIL " + $Message)
}

$buildScript = Get-Content -LiteralPath (Join-Path $ProjectRoot 'build.ps1') -Raw
$deployScriptPath = Join-Path $ProjectRoot 'tools\build-toolhub.ps1'
$syncScriptPath = Join-Path $ProjectRoot 'tools\sync-window-tools.ps1'
$installerSourcePath = Join-Path $ProjectRoot 'src\ToolHubInstaller.cs'
$deployScript = if (Test-Path -LiteralPath $deployScriptPath) { Get-Content -LiteralPath $deployScriptPath -Raw } else { '' }
$syncScript = if (Test-Path -LiteralPath $syncScriptPath) { Get-Content -LiteralPath $syncScriptPath -Raw } else { '' }
$installerSource = if (Test-Path -LiteralPath $installerSourcePath) { Get-Content -LiteralPath $installerSourcePath -Raw } else { '' }
$launcher = Get-Content -LiteralPath (Join-Path $ProjectRoot 'ToolHub.cmd') -Raw

Assert-Contains $buildScript "'build'" 'build defaults local builds to the source build directory'
Assert-Contains $buildScript "'build-test'" 'build defaults test builds to the source test directory'
Assert-Contains $deployScript '.lm-exe\tool-hub' 'deployment uses the ToolHub artifact root'
Assert-Contains $deployScript "Join-Path `$artifactRoot 'app'" 'deployment has an app directory'
Assert-Contains $deployScript "Join-Path `$artifactRoot 'config'" 'deployment has a config directory'
Assert-Contains $deployScript "Join-Path `$artifactRoot 'cache'" 'deployment has a cache directory'
Assert-Contains $deployScript "Join-Path `$artifactRoot 'logs'" 'deployment has a logs directory'
Assert-Contains $deployScript "Join-Path `$artifactRoot 'backups'" 'deployment has a backups directory'
Assert-Contains $deployScript 'window-root.txt' 'deployment writes the window root configuration'
Assert-Contains $deployScript 'CreateShortcut' 'deployment creates a desktop shortcut'
Assert-Contains $deployScript 'Remove-DesktopShortcut' 'standalone deployment cleans obsolete tool-chain shortcuts'
Assert-Contains $syncScript 'ToolHub.lnk' 'sync keeps a single ToolHub desktop shortcut'
Assert-Contains $syncScript 'ToolHubInstaller.lnk' 'sync removes the obsolete installer shortcut'
Assert-Contains $syncScript 'WorkspaceSwitcher.lnk' 'sync removes the child workspace shortcut'
Assert-Contains $syncScript 'Wallpaper-GUI.cmd - 快捷方式.lnk' 'sync removes the child wallpaper shortcut'
Assert-Contains $syncScript 'Wallpaper-GUI*.lnk' 'sync also matches renamed wallpaper shortcuts'
Assert-Contains $syncScript 'SpecialFolders' 'sync resolves the OneDrive desktop path when needed'
Assert-Contains $syncScript 'Remove-DesktopShortcut' 'sync cleans obsolete tool-chain shortcuts'
Assert-Contains $launcher '.lm-exe\tool-hub\app\ToolHubLauncher.exe' 'launcher starts the deployed startup launcher'
Assert-Contains $buildScript 'ToolHubInstaller.exe' 'build compiles the installer executable'
Assert-Contains $buildScript 'ToolHubLauncher.exe' 'build compiles the startup launcher executable'
Assert-Contains $buildScript 'ToolHubIcon.cs' 'build compiles the shared ToolHub icon renderer'
Assert-Contains $buildScript 'CreateToolHubIcon' 'build generates the shared ToolHub icon resource'
Assert-Contains $buildScript '/win32icon:' 'build embeds the shared icon into application binaries'
Assert-Contains $syncScript 'workspace-switcher' 'sync includes workspace switcher'
Assert-Contains $syncScript 'Wallpaper-GUI' 'sync includes wallpaper tool'
Assert-Contains $syncScript 'desktop-black-screen-repair' 'sync includes desktop repair tool'
Assert-Contains $syncScript 'audio-scene' 'sync includes audio scene tool'
Assert-Contains $syncScript 'AudioScene.exe' 'sync deploys audio scene executable'
Assert-Contains $syncScript 'favorites.json' 'sync migrates wallpaper favorites'
Assert-Contains $syncScript 'ArtifactRoot' 'sync supports an explicit artifact root'
Assert-Contains $installerSource 'sync-window-tools.ps1' 'installer launches the sync script'
$launcherSourcePath = Join-Path $ProjectRoot 'src\ToolHubLauncher.cs'
$launcherSource = if (Test-Path -LiteralPath $launcherSourcePath) { Get-Content -LiteralPath $launcherSourcePath -Raw } else { '' }
Assert-Contains $launcherSource '.next' 'startup launcher applies staged updates'
Assert-Contains $launcherSource 'WorkspaceSwitcher.exe' 'startup launcher updates the workspace executable'
Assert-Contains $launcherSource 'ToolHub.exe' 'startup launcher starts ToolHub'
Assert-Contains $syncScript 'ToolHubLauncher.exe' 'sync deploys the startup launcher'
Assert-Contains $syncScript 'ToolHub.lnk' 'sync keeps the ToolHub desktop entry'
Assert-Contains $launcher '.lm-exe\tool-hub\app\ToolHubLauncher.exe' 'launcher command starts the startup launcher'

if ($failures -ne 0) {
    throw "FAILED ToolHub.Deployment.Tests: $failures"
}

Write-Output 'PASS ToolHub.Deployment.Tests'
