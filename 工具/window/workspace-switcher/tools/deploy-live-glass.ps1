$ErrorActionPreference = 'Stop'
$artifactRoot = Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::UserProfile)) '.lm-exe\workspace-switcher'
$source = Join-Path $artifactRoot 'build'
$target = Join-Path $artifactRoot 'app'
$config = Join-Path $artifactRoot 'config'
$cache = Join-Path $artifactRoot 'cache'
$logs = Join-Path $artifactRoot 'logs'
$diagnostics = Join-Path $artifactRoot 'diagnostics'
$backups = Join-Path $artifactRoot 'backups'

New-Item -ItemType Directory -Force -Path $target, $config, $cache, $logs, $diagnostics, $backups | Out-Null

Get-Process -Name WorkspaceSwitcher -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1
Copy-Item -LiteralPath (Join-Path $source 'WorkspaceSwitcher.exe') -Destination (Join-Path $target 'WorkspaceSwitcher.exe') -Force
Copy-Item -LiteralPath (Join-Path $source 'WorkspaceSwitcher.Core.dll') -Destination (Join-Path $target 'WorkspaceSwitcher.Core.dll') -Force
$started = Start-Process -FilePath (Join-Path $target 'WorkspaceSwitcher.exe') -ArgumentList '--show' -WindowStyle Normal -PassThru
Start-Sleep -Milliseconds 500
$shortcutUpdated = 'preserved'

[ordered]@{
    Timestamp = (Get-Date).ToString('o')
    Source = $source
    Target = $target
    ProcessId = $started.Id
    ShortcutUpdated = $shortcutUpdated
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logs 'last-deploy.json') -Encoding UTF8

Write-Output 'WorkspaceSwitcher deployed and started with --show.'
Write-Output ('ProcessId=' + $started.Id)
Write-Output ('Target=' + $target)
Write-Output ('ShortcutUpdated=' + $shortcutUpdated)
