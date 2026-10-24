param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$ArtifactRoot = (Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::UserProfile)) '.lm-exe'),
    [switch]$SkipShortcut,
    [switch]$SkipInstaller,
    [switch]$Start
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = [IO.Path]::GetFullPath($ProjectRoot)
$ArtifactRoot = [IO.Path]::GetFullPath($ArtifactRoot)
$sourceWindowRoot = Split-Path -Parent $ProjectRoot
$workspaceSource = Join-Path $sourceWindowRoot 'workspace-switcher'
$wallpaperSource = Join-Path $sourceWindowRoot 'Wallpaper-GUI'
$repairSource = Join-Path $sourceWindowRoot 'desktop-black-screen-repair'
$diagnosticsSource = Join-Path $sourceWindowRoot 'system-stability-diagnostics'
$audioSceneSource = Join-Path $sourceWindowRoot 'audio-scene'
$toolHubArtifact = Join-Path $ArtifactRoot 'tool-hub'
$workspaceArtifact = Join-Path $ArtifactRoot 'workspace-switcher'
$wallpaperArtifact = Join-Path $ArtifactRoot 'Wallpaper-GUI'
$repairArtifact = Join-Path $ArtifactRoot 'desktop-black-screen-repair'
$diagnosticsArtifact = Join-Path $ArtifactRoot 'system-stability-diagnostics'
$audioSceneArtifact = Join-Path $ArtifactRoot 'audio-scene'
$logDirectory = Join-Path $toolHubArtifact 'logs'
$backupDirectory = Join-Path $toolHubArtifact 'backups'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$syncLog = Join-Path $logDirectory ("sync-$stamp.log")
$deferredFiles = New-Object 'System.Collections.Generic.List[string]'

New-Item -ItemType Directory -Force -Path @(
    (Join-Path $toolHubArtifact 'app'),
    (Join-Path $toolHubArtifact 'config'),
    (Join-Path $toolHubArtifact 'cache'),
    $logDirectory,
    $backupDirectory,
    (Join-Path $workspaceArtifact 'app'),
    (Join-Path $workspaceArtifact 'config'),
    (Join-Path $workspaceArtifact 'cache'),
    (Join-Path $workspaceArtifact 'logs'),
    (Join-Path $wallpaperArtifact 'app'),
    (Join-Path $wallpaperArtifact 'config'),
    (Join-Path $wallpaperArtifact 'cache'),
    (Join-Path $wallpaperArtifact 'logs'),
    (Join-Path $repairArtifact 'app'),
    (Join-Path $repairArtifact 'config'),
    (Join-Path $repairArtifact 'logs'),
    (Join-Path $diagnosticsArtifact 'app'),
    (Join-Path $diagnosticsArtifact 'config'),
    (Join-Path $diagnosticsArtifact 'build'),
    (Join-Path $diagnosticsArtifact 'logs'),
    (Join-Path $audioSceneArtifact 'app'),
    (Join-Path $audioSceneArtifact 'config'),
    (Join-Path $audioSceneArtifact 'build'),
    (Join-Path $audioSceneArtifact 'cache'),
    (Join-Path $audioSceneArtifact 'logs')
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

function Write-Utf8NoBom {
    param([string]$Path, [string]$Value)
    [IO.File]::WriteAllText($Path, $Value, (New-Object System.Text.UTF8Encoding($false)))
}

function Invoke-LoggedScript {
    param(
        [string]$ScriptPath,
        [hashtable]$Parameters,
        [string]$LogPath
    )

    & $ScriptPath @Parameters 2>&1 | Tee-Object -FilePath $LogPath
    if ($LASTEXITCODE -ne 0) {
        throw "脚本执行失败：$ScriptPath，退出码 $LASTEXITCODE"
    }
}

function Copy-TreeFiles {
    param([string]$Source, [string]$Destination)

    $excludedDirectoryNames = @('__pycache__', '.pytest_cache', 'tests_py', 'docs', 'Cache')
    $pendingDirectories = New-Object 'System.Collections.Generic.Stack[string]'
    $pendingDirectories.Push($Source)

    while ($pendingDirectories.Count -gt 0) {
        $currentDirectory = $pendingDirectories.Pop()
        foreach ($directory in Get-ChildItem -LiteralPath $currentDirectory -Directory -Force -ErrorAction Stop) {
            if ($excludedDirectoryNames -contains $directory.Name) {
                continue
            }
            $pendingDirectories.Push($directory.FullName)
        }

        foreach ($file in Get-ChildItem -LiteralPath $currentDirectory -File -Force -ErrorAction Stop) {
            $relative = $file.FullName.Substring($Source.TrimEnd('\').Length).TrimStart('\')
            $target = Join-Path $Destination $relative
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
            Copy-Item -LiteralPath $file.FullName -Destination $target -Force
        }
    }
}

function Backup-AppDirectory {
    param([string]$Path, [string]$Name)

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        return
    }

    $target = Join-Path (Join-Path $backupDirectory $stamp) $Name
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
    Copy-Item -LiteralPath $Path -Destination $target -Recurse -Force
}

function Copy-DeployedFile {
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
    } catch {
        $pendingPath = $Destination + '.next'
        Copy-Item -LiteralPath $Source -Destination $pendingPath -Force
        $deferredFiles.Add($Destination)
        Write-Warning "目标文件正在使用，已暂存待更新文件：$pendingPath"
    }
}

function Migrate-WallpaperCache {
    $sourceCache = Join-Path $wallpaperSource 'Cache'
    $targetCache = Join-Path $wallpaperArtifact 'cache'
    if (Test-Path -LiteralPath $sourceCache -PathType Container) {
        Copy-TreeFiles -Source $sourceCache -Destination $targetCache
    }

    $sourceFavorites = Join-Path $wallpaperSource 'config\favorites.json'
    $targetFavorites = Join-Path $wallpaperArtifact 'config\favorites.json'
    if ((Test-Path -LiteralPath $sourceFavorites) -and -not (Test-Path -LiteralPath $targetFavorites)) {
        Copy-Item -LiteralPath $sourceFavorites -Destination $targetFavorites -Force
    }

    $indexPath = Join-Path $targetCache 'images.jsonl'
    if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) {
        return
    }

    $sourcePrefix = $sourceCache.TrimEnd('\')
    $targetPrefix = $targetCache.TrimEnd('\')
    $rewritten = foreach ($line in [IO.File]::ReadAllLines($indexPath, [Text.Encoding]::UTF8)) {
        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }

        try {
            $record = $line | ConvertFrom-Json
            if ($record.file -and $record.file.StartsWith($sourcePrefix, [StringComparison]::OrdinalIgnoreCase)) {
                $relative = $record.file.Substring($sourcePrefix.Length).TrimStart('\', '/')
                $record.file = Join-Path $targetPrefix $relative
            }
            $record | ConvertTo-Json -Compress
        } catch {
            $line
        }
    }
    Write-Utf8NoBom -Path $indexPath -Value (($rewritten -join [Environment]::NewLine) + [Environment]::NewLine)
}

if (-not (Test-Path -LiteralPath $workspaceSource -PathType Container)) { throw "缺少源码目录：$workspaceSource" }
if (-not (Test-Path -LiteralPath $wallpaperSource -PathType Container)) { throw "缺少源码目录：$wallpaperSource" }
if (-not (Test-Path -LiteralPath $repairSource -PathType Container)) { throw "缺少源码目录：$repairSource" }
if (-not (Test-Path -LiteralPath $diagnosticsSource -PathType Container)) { throw "缺少源码目录：$diagnosticsSource" }
if (-not (Test-Path -LiteralPath $audioSceneSource -PathType Container)) { throw "缺少源码目录：$audioSceneSource" }

Write-Output "同步开始：$ProjectRoot" | Tee-Object -FilePath $syncLog

$workspaceBuild = Join-Path $workspaceArtifact 'build'
$workspaceBuildLog = Join-Path $logDirectory "workspace-$stamp.log"
Invoke-LoggedScript -ScriptPath (Join-Path $workspaceSource 'build.ps1') -Parameters @{
    RunTests = $true
    OutputDirectory = $workspaceBuild
} -LogPath $workspaceBuildLog
Backup-AppDirectory -Path (Join-Path $workspaceArtifact 'app') -Name 'workspace-switcher'
Copy-DeployedFile -Source (Join-Path $workspaceBuild 'WorkspaceSwitcher.exe') -Destination (Join-Path $workspaceArtifact 'app\WorkspaceSwitcher.exe')
Copy-DeployedFile -Source (Join-Path $workspaceBuild 'WorkspaceSwitcher.Core.dll') -Destination (Join-Path $workspaceArtifact 'app\WorkspaceSwitcher.Core.dll')

Backup-AppDirectory -Path (Join-Path $wallpaperArtifact 'app') -Name 'Wallpaper-GUI'
Copy-TreeFiles -Source $wallpaperSource -Destination (Join-Path $wallpaperArtifact 'app')
Migrate-WallpaperCache

Backup-AppDirectory -Path (Join-Path $repairArtifact 'app') -Name 'desktop-black-screen-repair'
foreach ($file in Get-ChildItem -LiteralPath $repairSource -File | Where-Object { $_.Extension -in @('.cmd', '.ps1', '.cs') }) {
    Copy-Item -LiteralPath $file.FullName -Destination (Join-Path (Join-Path $repairArtifact 'app') $file.Name) -Force
}

$diagnosticsBuild = Join-Path $diagnosticsArtifact 'build'
$diagnosticsBuildLog = Join-Path $logDirectory "system-stability-diagnostics-$stamp.log"
Invoke-LoggedScript -ScriptPath (Join-Path $diagnosticsSource 'build.ps1') -Parameters @{
    RunTests = $true
    OutputDirectory = $diagnosticsBuild
} -LogPath $diagnosticsBuildLog
Backup-AppDirectory -Path (Join-Path $diagnosticsArtifact 'app') -Name 'system-stability-diagnostics'
Copy-DeployedFile -Source (Join-Path $diagnosticsBuild 'SystemStabilityDiagnostics.exe') -Destination (Join-Path $diagnosticsArtifact 'app\SystemStabilityDiagnostics.exe')
Copy-DeployedFile -Source (Join-Path $diagnosticsBuild 'SystemStabilityDiagnostics.Core.dll') -Destination (Join-Path $diagnosticsArtifact 'app\SystemStabilityDiagnostics.Core.dll')

$audioSceneBuild = Join-Path $audioSceneArtifact 'build'
$audioSceneBuildLog = Join-Path $logDirectory "audio-scene-$stamp.log"
Invoke-LoggedScript -ScriptPath (Join-Path $audioSceneSource 'build.ps1') -Parameters @{
    RunTests = $true
    OutputDirectory = $audioSceneBuild
} -LogPath $audioSceneBuildLog
Backup-AppDirectory -Path (Join-Path $audioSceneArtifact 'app') -Name 'audio-scene'
Copy-DeployedFile -Source (Join-Path $audioSceneBuild 'AudioScene.exe') -Destination (Join-Path $audioSceneArtifact 'app\AudioScene.exe')
Copy-DeployedFile -Source (Join-Path $audioSceneBuild 'AudioScene.Core.dll') -Destination (Join-Path $audioSceneArtifact 'app\AudioScene.Core.dll')

$toolRootConfig = Join-Path $toolHubArtifact 'config\window-root.txt'
Write-Utf8NoBom -Path $toolRootConfig -Value $ArtifactRoot
$toolRootsConfig = Join-Path $toolHubArtifact 'config\tool-roots.ini'
$toolRootLines = @(
    "workspace-switcher=$(Join-Path $workspaceArtifact 'app\WorkspaceSwitcher.exe')",
    "wallpaper-gui=$(Join-Path $wallpaperArtifact 'app\Wallpaper-GUI.cmd')",
    "desktop-black-screen-repair=$(Join-Path $repairArtifact 'app\Repair-DesktopBlackScreen.cmd')",
    "system-stability-diagnostics=$(Join-Path $diagnosticsArtifact 'app\SystemStabilityDiagnostics.exe')",
    "audio-scene=$(Join-Path $audioSceneArtifact 'app\AudioScene.exe')"
)
Write-Utf8NoBom -Path $toolRootsConfig -Value ($toolRootLines -join [Environment]::NewLine)

$toolHubParameters = @{
    ArtifactRoot = $toolHubArtifact
    WindowRoot = $ArtifactRoot
    SkipShortcut = $true
}
if ($SkipInstaller) { $toolHubParameters.SkipInstaller = $true }
Invoke-LoggedScript -ScriptPath (Join-Path $ProjectRoot 'tools\build-toolhub.ps1') -Parameters $toolHubParameters -LogPath (Join-Path $logDirectory "tool-hub-$stamp.log")

$sourceRootConfig = Join-Path $toolHubArtifact 'config\source-root.txt'
Write-Utf8NoBom -Path $sourceRootConfig -Value $ProjectRoot

if (-not $SkipShortcut) {
    $desktop = Get-DesktopDirectory
    $shell = New-Object -ComObject WScript.Shell
    foreach ($wallpaperShortcut in Get-ChildItem -LiteralPath $desktop -Filter 'Wallpaper-GUI*.lnk' -Force) {
        Remove-DesktopShortcut -DesktopDirectory $desktop -Name $wallpaperShortcut.Name
    }
    foreach ($obsoleteShortcutName in @(
        'ToolHubInstaller.lnk',
        'WorkspaceSwitcher.lnk',
        'Wallpaper-GUI.cmd - 快捷方式.lnk'
    )) {
        Remove-DesktopShortcut -DesktopDirectory $desktop -Name $obsoleteShortcutName
    }
    foreach ($shortcutSpec in @(
        @{ Name = 'ToolHub.lnk'; Target = (Join-Path $toolHubArtifact 'app\ToolHubLauncher.exe'); Description = 'Windows ToolHub' }
    )) {
        $shortcut = $shell.CreateShortcut((Join-Path $desktop $shortcutSpec.Name))
        $shortcut.TargetPath = $shortcutSpec.Target
        $shortcut.WorkingDirectory = Split-Path -Parent $shortcutSpec.Target
        $shortcut.Description = $shortcutSpec.Description
        $shortcut.IconLocation = "$($shortcutSpec.Target),0"
        $shortcut.Save()
    }
}

if ($Start) {
    Start-Process -FilePath (Join-Path $toolHubArtifact 'app\ToolHubLauncher.exe') -WorkingDirectory (Join-Path $toolHubArtifact 'app') | Out-Null
}

[ordered]@{
    Timestamp = (Get-Date).ToString('o')
    Source = $ProjectRoot
    ArtifactRoot = $ArtifactRoot
    ToolHub = Join-Path $toolHubArtifact 'app\ToolHub.exe'
    ToolHubLauncher = Join-Path $toolHubArtifact 'app\ToolHubLauncher.exe'
    WorkspaceSwitcher = Join-Path $workspaceArtifact 'app\WorkspaceSwitcher.exe'
    Wallpaper = Join-Path $wallpaperArtifact 'app\Wallpaper-GUI.cmd'
    DesktopRepair = Join-Path $repairArtifact 'app\Repair-DesktopBlackScreen.cmd'
    SystemStabilityDiagnostics = Join-Path $diagnosticsArtifact 'app\SystemStabilityDiagnostics.exe'
    AudioScene = Join-Path $audioSceneArtifact 'app\AudioScene.exe'
    DeferredFiles = @($deferredFiles)
    SyncLog = $syncLog
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logDirectory 'last-sync.json') -Encoding UTF8

Write-Output 'Window tools synchronized.'
Write-Output ('ArtifactRoot=' + $ArtifactRoot)
