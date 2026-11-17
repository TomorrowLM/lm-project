param(
    [switch]$Start,
    [switch]$SkipShortcut,
    [switch]$SkipInstaller,
    [string]$ArtifactRoot = (Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::UserProfile)) '.lm-exe\tool-hub'),
    [string]$WindowRoot = ''
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$artifactRoot = $ArtifactRoot
$buildDirectory = Join-Path $artifactRoot 'build'
$appDirectory = Join-Path $artifactRoot 'app'
$configDirectory = Join-Path $artifactRoot 'config'
$cacheDirectory = Join-Path $artifactRoot 'cache'
$logDirectory = Join-Path $artifactRoot 'logs'
$diagnosticsDirectory = Join-Path $artifactRoot 'diagnostics'
$backupDirectory = Join-Path $artifactRoot 'backups'
$deferredFiles = New-Object 'System.Collections.Generic.List[string]'
$windowRoot = if ([string]::IsNullOrWhiteSpace($WindowRoot)) {
    Split-Path -Parent $projectRoot
} else {
    [IO.Path]::GetFullPath($WindowRoot)
}
$buildScript = Join-Path $projectRoot 'build.ps1'

New-Item -ItemType Directory -Force -Path @(
    $buildDirectory,
    $appDirectory,
    $configDirectory,
    $cacheDirectory,
    $logDirectory,
    $diagnosticsDirectory,
    $backupDirectory
) | Out-Null

function Remove-DesktopShortcut {
    param(
        [string]$DesktopDirectory,
        [string]$Name
    )

    $shortcutPath = Join-Path $DesktopDirectory $Name
    if (-not (Test-Path -LiteralPath $shortcutPath)) {
        return
    }

    $shortcutBackupDirectory = Join-Path $backupDirectory 'desktop-shortcuts'
    New-Item -ItemType Directory -Force -Path $shortcutBackupDirectory | Out-Null
    $backupName = $stamp + '-' + $Name
    Move-Item -LiteralPath $shortcutPath -Destination (Join-Path $shortcutBackupDirectory $backupName) -Force
    Write-Output ('Removed desktop shortcut: ' + $Name)
}

function Get-DesktopDirectory {
    $desktopDirectory = [Environment]::GetFolderPath([Environment+SpecialFolder]::Desktop)
    if ([string]::IsNullOrWhiteSpace($desktopDirectory)) {
        $desktopShell = New-Object -ComObject WScript.Shell
        $desktopDirectory = $desktopShell.SpecialFolders.Item('Desktop')
    }
    if ([string]::IsNullOrWhiteSpace($desktopDirectory)) {
        throw 'Unable to resolve the current user desktop directory.'
    }
    return $desktopDirectory
}

$windowRootConfig = Join-Path $configDirectory 'window-root.txt'
Set-Content -LiteralPath $windowRootConfig -Value $windowRoot -Encoding UTF8

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$buildLog = Join-Path $logDirectory ("build-$stamp.log")
& $buildScript -RunTests -OutputDirectory $buildDirectory 2>&1 | Tee-Object -FilePath $buildLog
$exitCode = $LASTEXITCODE

[ordered]@{
    Timestamp = (Get-Date).ToString('o')
    Source = $projectRoot
    Output = $buildDirectory
    Log = $buildLog
    ExitCode = $exitCode
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logDirectory 'last-build.json') -Encoding UTF8

if ($exitCode -ne 0) {
    throw "ToolHub build failed with exit code $exitCode. See $buildLog"
}

$buildApp = Join-Path $buildDirectory 'ToolHub.exe'
$buildCore = Join-Path $buildDirectory 'ToolHub.Core.dll'
$buildInstaller = Join-Path $buildDirectory 'ToolHubInstaller.exe'
$buildLauncher = Join-Path $buildDirectory 'ToolHubLauncher.exe'
$targetApp = Join-Path $appDirectory 'ToolHub.exe'
$targetCore = Join-Path $appDirectory 'ToolHub.Core.dll'
$targetInstaller = Join-Path $appDirectory 'ToolHubInstaller.exe'
 $targetLauncher = Join-Path $appDirectory 'ToolHubLauncher.exe'
if (-not (Test-Path -LiteralPath $buildApp) -or -not (Test-Path -LiteralPath $buildCore) -or
    -not (Test-Path -LiteralPath $buildLauncher) -or
    (-not $SkipInstaller -and -not (Test-Path -LiteralPath $buildInstaller))) {
    throw "Build output is incomplete: $buildApp"
}

$existingTargetCandidates = @($targetApp, $targetCore, $targetLauncher)
if (-not $SkipInstaller) {
    $existingTargetCandidates += $targetInstaller
}
$existingTargets = $existingTargetCandidates | Where-Object { Test-Path -LiteralPath $_ }
if ($existingTargets.Count -gt 0) {
    $backupPath = Join-Path $backupDirectory $stamp
    New-Item -ItemType Directory -Force -Path $backupPath | Out-Null
    foreach ($existingTarget in $existingTargets) {
        Copy-Item -LiteralPath $existingTarget -Destination $backupPath -Force
    }
}

function Stage-DeferredArtifact {
    param(
        [string]$Source,
        [string]$Destination
    )

    $pendingPath = $Destination + '.next'
    Copy-Item -LiteralPath $Source -Destination $pendingPath -Force
    if (-not $deferredFiles.Contains($Destination)) {
        $deferredFiles.Add($Destination)
    }
    Write-Warning "Target file is in use; staged update: $pendingPath"
}

function Copy-DeployedArtifact {
    param(
        [string]$Source,
        [string]$Destination
    )

    try {
        Copy-Item -LiteralPath $Source -Destination $Destination -Force
        $pendingPath = $Destination + '.next'
        if (Test-Path -LiteralPath $pendingPath) {
            Remove-Item -LiteralPath $pendingPath -Force
        }
        return $true
    } catch {
        Stage-DeferredArtifact -Source $Source -Destination $Destination
        return $false
    }
}

$appCopied = Copy-DeployedArtifact -Source $buildApp -Destination $targetApp
if ($appCopied) {
    Copy-DeployedArtifact -Source $buildCore -Destination $targetCore | Out-Null
} else {
    Stage-DeferredArtifact -Source $buildCore -Destination $targetCore
}
if (-not $SkipInstaller) {
    Copy-DeployedArtifact -Source $buildInstaller -Destination $targetInstaller | Out-Null
}
Copy-DeployedArtifact -Source $buildLauncher -Destination $targetLauncher | Out-Null

$sourceRootConfig = Join-Path $configDirectory 'source-root.txt'
Set-Content -LiteralPath $sourceRootConfig -Value $projectRoot -Encoding UTF8

$shortcutPath = ''
if (-not $SkipShortcut) {
    $desktopDirectory = Get-DesktopDirectory
    foreach ($obsoleteShortcutName in @(
        'ToolHubInstaller.lnk',
        'WorkspaceSwitcher.lnk',
        'Wallpaper-GUI.cmd - 快捷方式.lnk'
    )) {
        Remove-DesktopShortcut -DesktopDirectory $desktopDirectory -Name $obsoleteShortcutName
    }
    $shortcutPath = Join-Path $desktopDirectory 'ToolHub.lnk'
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $targetLauncher
    $shortcut.WorkingDirectory = $appDirectory
    $shortcut.Description = 'Windows ToolHub'
    $shortcut.IconLocation = "$targetApp,0"
    $shortcut.Save()
}

$deployLog = Join-Path $logDirectory 'last-deploy.json'
[ordered]@{
    Timestamp = (Get-Date).ToString('o')
    Source = $projectRoot
    Build = $buildDirectory
    App = $appDirectory
    Launcher = $targetLauncher
    Config = $configDirectory
    WindowRoot = $windowRoot
    Shortcut = if ($SkipShortcut) { '' } else { $shortcutPath }
    Installer = if ($SkipInstaller) { '' } else { $targetInstaller }
    DeferredFiles = @($deferredFiles)
    Started = [bool]$Start
} | ConvertTo-Json | Set-Content -LiteralPath $deployLog -Encoding UTF8

if ($Start) {
    $started = Start-Process -FilePath $targetLauncher -WorkingDirectory $appDirectory -PassThru
    Write-Output ('ProcessId=' + $started.Id)
}

Write-Output 'ToolHub deployed.'
Write-Output ('App=' + $targetApp)
Write-Output ('Shortcut=' + $shortcutPath)
