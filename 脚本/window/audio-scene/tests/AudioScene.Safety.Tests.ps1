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
$deleteStart = $appSource.IndexOf('private void DeleteProfile()', [StringComparison]::Ordinal)
$deleteEnd = $appSource.IndexOf('private bool UpdateProfileFromEditor', $deleteStart, [StringComparison]::Ordinal)
$deleteBody = if ($deleteStart -ge 0 -and $deleteEnd -gt $deleteStart) {
    $appSource.Substring($deleteStart, $deleteEnd - $deleteStart)
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
Assert-NotContains $source 'Peace.exe' 'audio scene does not depend on or launch Peace'
Assert-NotContains $source 'CreateService' 'audio scene does not create an audio service'
Assert-NotContains $source 'RegistryKey' 'audio scene does not modify the registry'
Assert-Contains $source 'EqualizerApoAdapter' 'audio scene has an optional Equalizer APO adapter'
Assert-Contains $source 'OwnedConfigPath' 'audio scene writes only its owned user configuration'
Assert-Contains $source 'GetMixFormat' 'audio scene reads the current output mix format'
Assert-Contains $source 'voice-ai' 'audio scene provides an AI voice preset'
Assert-Contains $appSource 'bassBar' 'audio scene exposes bass control'
Assert-Contains $appSource 'trebleBar' 'audio scene exposes treble control'
Assert-Contains $appSource 'voiceClarityBar' 'audio scene exposes voice clarity control'
Assert-Contains $appSource 'equalizerBars' 'audio scene exposes graphic EQ controls'
Assert-Contains $appSource 'spatialList' 'audio scene exposes spatial mode control'
Assert-Contains $appSource 'sampleRateLabel' 'audio scene displays the output sample rate'
Assert-Contains $appSource 'Panel editorHost' 'audio scene has a dedicated scrollable editor viewport'
Assert-Contains $appSource 'editorHost.Controls.Add(editor)' 'audio scene places the editor inside the scrollable viewport'
Assert-Contains $appSource 'new RowStyle(SizeType.Absolute, 240F)' 'audio scene reserves a full row for the equalizer'
Assert-Contains $source '0BD7A1BE-7A1A-44DB-8397-CC5392387B5E' 'audio scene uses the Windows device collection interface IID'
Assert-NotContains $source '0BD7A1BE-7A1A-44DB-8397-C0C5D4A5AFB4' 'audio scene does not use the invalid device collection IID'
Assert-Contains $deleteBody 'profiles.Remove(profile)' 'delete action removes the selected scene'
Assert-Contains $deleteBody 'store.Save(profiles)' 'delete action persists the remaining scenes'

if ($failures -ne 0) {
    throw "FAILED AudioScene.Safety.Tests: $failures"
}

Write-Output 'PASS AudioScene.Safety.Tests'
