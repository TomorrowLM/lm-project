param(
    [string]$ExecutablePath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'build\AudioScene.exe')
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $ExecutablePath)) {
    throw "AudioScene executable not found: $ExecutablePath"
}

$assembly = [Reflection.Assembly]::LoadFrom((Resolve-Path -LiteralPath $ExecutablePath).Path)
$backendType = $assembly.GetType('AudioScene.Windows.WindowsAudioBackend', $true)
$backend = [Activator]::CreateInstance($backendType)
try {
    $devices = $backendType.GetMethod('GetRenderDevices').Invoke($backend, $null)
} catch {
    $inner = $_.Exception.InnerException
    if ($inner) {
        throw ('GetRenderDevices failed: ' + $inner.ToString())
    }
    throw
}

if ($devices.Count -lt 1) {
    throw 'GetRenderDevices returned no render devices.'
}

foreach ($device in $devices) {
    if ($device.SampleRateHz -le 0) {
        throw ('Render device has no readable output sample rate: ' + $device.Name)
    }
    Write-Output ('PASS render device: ' + $device.Name + ' (' + $device.FormatDescription + ')')
}
Write-Output ('PASS AudioScene.Device.Tests: ' + $devices.Count + ' render devices')
