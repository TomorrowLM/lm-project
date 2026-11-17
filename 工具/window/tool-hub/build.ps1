param(
    [switch]$RunTests,
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

$coreAssembly = Join-Path $buildDirectory 'ToolHub.Core.dll'
$appAssembly = Join-Path $buildDirectory 'ToolHub.exe'
$iconAssembly = Join-Path $buildDirectory 'CreateToolHubIcon.exe'
$iconPath = Join-Path $buildDirectory 'ToolHub.ico'

Invoke-Csc @(
    '/nologo',
    '/target:library',
    "/out:$coreAssembly",
    (Join-Path $projectRoot 'src\ToolHub.Core.cs')
)

Invoke-Csc @(
    '/nologo',
    '/target:exe',
    "/out:$iconAssembly",
    '/reference:System.Drawing.dll',
    (Join-Path $projectRoot 'src\ToolHubIcon.cs'),
    (Join-Path $projectRoot 'tools\CreateToolHubIcon.cs')
)
& $iconAssembly $iconPath
if ($LASTEXITCODE -ne 0) {
    throw "CreateToolHubIcon failed with exit code $LASTEXITCODE"
}

Invoke-Csc @(
    '/nologo',
    '/target:winexe',
    "/out:$appAssembly",
    "/win32icon:$iconPath",
    '/reference:System.dll',
    '/reference:System.Drawing.dll',
    '/reference:System.Windows.Forms.dll',
    "/reference:$coreAssembly",
    (Join-Path $projectRoot 'src\ToolHub.App.cs'),
    (Join-Path $projectRoot 'src\ToolHubIcon.cs')
)

$installerAssembly = Join-Path $buildDirectory 'ToolHubInstaller.exe'
Invoke-Csc @(
    '/nologo',
    '/target:winexe',
    "/out:$installerAssembly",
    "/win32icon:$iconPath",
    '/reference:System.dll',
    '/reference:System.Drawing.dll',
    '/reference:System.Windows.Forms.dll',
    (Join-Path $projectRoot 'src\ToolHubInstaller.cs')
)

$launcherAssembly = Join-Path $buildDirectory 'ToolHubLauncher.exe'
Invoke-Csc @(
    '/nologo',
    '/target:winexe',
    "/out:$launcherAssembly",
    "/win32icon:$iconPath",
    '/reference:System.dll',
    '/reference:System.Windows.Forms.dll',
    (Join-Path $projectRoot 'src\ToolHubLauncher.cs')
)

if ($RunTests) {
    $coreTestAssembly = Join-Path $buildDirectory 'ToolHub.Core.Tests.exe'
    $appTestAssembly = Join-Path $buildDirectory 'ToolHub.App.Tests.exe'

    Invoke-Csc @(
        '/nologo',
        '/target:exe',
        "/out:$coreTestAssembly",
        (Join-Path $projectRoot 'tests\ToolHub.Core.Tests.cs'),
        "/reference:$coreAssembly"
    )
    & $coreTestAssembly $coreAssembly
    if ($LASTEXITCODE -ne 0) {
        throw "ToolHub.Core.Tests failed with exit code $LASTEXITCODE"
    }

    Invoke-Csc @(
        '/nologo',
        '/target:exe',
        "/out:$appTestAssembly",
        (Join-Path $projectRoot 'tests\ToolHub.App.Tests.cs'),
        '/reference:System.dll',
        "/reference:$coreAssembly"
    )
    & $appTestAssembly $appAssembly (Join-Path $projectRoot 'src\ToolHub.App.cs')
    if ($LASTEXITCODE -ne 0) {
        throw "ToolHub.App.Tests failed with exit code $LASTEXITCODE"
    }
}

Write-Output "ToolHub built: $appAssembly"
