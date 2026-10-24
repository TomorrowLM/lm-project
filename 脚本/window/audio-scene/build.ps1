param(
    [switch]$RunTests,
    [switch]$RunDeviceTest,
    [string]$OutputDirectory = ''
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$OutputDirectory = if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    if ($RunTests) { 'build-test' } else { 'build' }
} else {
    $OutputDirectory
}
$csc = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'

if ([IO.Path]::IsPathRooted($OutputDirectory)) {
    $buildDirectory = $OutputDirectory
} else {
    $buildDirectory = Join-Path $projectRoot $OutputDirectory
}

New-Item -ItemType Directory -Force -Path $buildDirectory | Out-Null

function Invoke-Csc {
    param([string[]]$Arguments)
    & $csc @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "csc failed with exit code $LASTEXITCODE"
    }
}

$coreAssembly = Join-Path $buildDirectory 'AudioScene.Core.dll'
Invoke-Csc @(
    '/nologo',
    '/target:library',
    "/out:$coreAssembly",
    '/reference:System.Xml.dll',
    (Join-Path $projectRoot 'src\AudioScene.Core.cs')
)

$appAssembly = Join-Path $buildDirectory 'AudioScene.exe'
Invoke-Csc @(
    '/nologo',
    '/target:winexe',
    "/out:$appAssembly",
    '/reference:System.dll',
    '/reference:System.Drawing.dll',
    '/reference:System.Windows.Forms.dll',
    '/reference:System.Xml.dll',
    "/reference:$coreAssembly",
    (Join-Path $projectRoot 'src\AudioScene.WindowsAudio.cs'),
    (Join-Path $projectRoot 'src\AudioScene.App.cs')
)

if ($RunTests) {
    $coreTestAssembly = Join-Path $buildDirectory 'AudioScene.Core.Tests.exe'
    Invoke-Csc @(
        '/nologo',
        '/target:exe',
        "/out:$coreTestAssembly",
        (Join-Path $projectRoot 'tests\AudioScene.Core.Tests.cs')
    )
    & $coreTestAssembly $coreAssembly
    if ($LASTEXITCODE -ne 0) {
        throw "AudioScene.Core.Tests failed with exit code $LASTEXITCODE"
    }

    $appTestAssembly = Join-Path $buildDirectory 'AudioScene.App.Tests.exe'
    Invoke-Csc @(
        '/nologo',
        '/target:exe',
        "/out:$appTestAssembly",
        (Join-Path $projectRoot 'tests\AudioScene.App.Tests.cs')
    )
    & $appTestAssembly $coreAssembly
    if ($LASTEXITCODE -ne 0) {
        throw "AudioScene.App.Tests failed with exit code $LASTEXITCODE"
    }

    $safetyTest = Join-Path $projectRoot 'tests\AudioScene.Safety.Tests.ps1'
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $safetyTest -ProjectRoot $projectRoot
    if ($LASTEXITCODE -ne 0) {
        throw "AudioScene.Safety.Tests failed with exit code $LASTEXITCODE"
    }

    if ($RunDeviceTest) {
        $deviceTest = Join-Path $projectRoot 'tests\AudioScene.Device.Tests.ps1'
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $deviceTest -ExecutablePath $appAssembly
        if ($LASTEXITCODE -ne 0) {
            throw "AudioScene.Device.Tests failed with exit code $LASTEXITCODE"
        }
    }
}

Write-Output "AudioScene built: $appAssembly"
