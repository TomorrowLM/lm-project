param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$failures = 0

function Assert-Contains {
    param([string]$Text, [string]$Needle, [string]$Message)
    if ($Text.IndexOf($Needle, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
        Write-Output ('PASS ' + $Message)
        return
    }

    $script:failures++
    Write-Output ('FAIL ' + $Message)
}

function Assert-NotContains {
    param([string]$Text, [string]$Needle, [string]$Message)
    if ($Text.IndexOf($Needle, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
        Write-Output ('PASS ' + $Message)
        return
    }

    $script:failures++
    Write-Output ('FAIL ' + $Message)
}

$sourceFiles = Get-ChildItem -LiteralPath (Join-Path $ProjectRoot 'src') -File -Filter '*.cs'
$source = ($sourceFiles | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw }) -join [Environment]::NewLine
$appSource = Get-Content -LiteralPath (Join-Path $ProjectRoot 'src\AudioScene.App.cs') -Raw
$loadStart = $appSource.IndexOf('private void LoadState()', [StringComparison]::Ordinal)
$refreshStart = $appSource.IndexOf('private void RefreshDevices()', [StringComparison]::Ordinal)
$loadBody = if ($loadStart -ge 0 -and $refreshStart -gt $loadStart) {
    $appSource.Substring($loadStart, $refreshStart - $loadStart)
} else {
    ''
}

Assert-Contains $appSource 'Application.Run(form)' 'audio scene has an explicit desktop application entry point'
Assert-NotContains $loadBody 'backend.Apply' 'startup state loading does not apply a scene'
Assert-NotContains $loadBody 'ApplyProfile' 'startup state loading does not call the apply action'
Assert-NotContains $source 'System.Threading.Timer' 'audio scene has no polling timer'
Assert-NotContains $source 'System.Windows.Forms.Timer' 'audio scene has no UI timer'
Assert-NotContains $source 'Task.Run' 'audio scene has no background task'
Assert-NotContains $source 'Process.Start' 'audio scene does not launch other processes'
Assert-NotContains $source 'ServiceBase' 'audio scene does not create a Windows service'
Assert-NotContains $source 'OpenSCManager' 'audio scene does not access the service manager'
Assert-NotContains $source 'SetDefaultEndpoint' 'audio scene does not switch the system default route'
Assert-NotContains $source '.sys' 'audio scene does not install a driver'

if ($failures -ne 0) {
    throw "FAILED AudioScene.Safety.Tests: $failures"
}

Write-Output 'PASS AudioScene.Safety.Tests'
