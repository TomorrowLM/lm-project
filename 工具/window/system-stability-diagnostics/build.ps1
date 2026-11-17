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
$webExtensions = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\System.Web.Extensions.dll'

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

$coreAssembly = Join-Path $buildDirectory 'SystemStabilityDiagnostics.Core.dll'
$appAssembly = Join-Path $buildDirectory 'SystemStabilityDiagnostics.exe'
Invoke-Csc @(
    '/nologo',
    '/target:library',
    "/out:$coreAssembly",
    '/reference:System.dll',
    "/reference:$webExtensions",
    (Join-Path $projectRoot 'src\Diagnostics.Core.cs')
)

Invoke-Csc @(
    '/nologo',
    '/target:winexe',
    "/out:$appAssembly",
    '/reference:System.dll',
    '/reference:System.Core.dll',
    '/reference:System.Drawing.dll',
    '/reference:System.Windows.Forms.dll',
    "/reference:$coreAssembly",
    (Join-Path $projectRoot 'src\Diagnostics.App.cs')
)

if ($RunTests) {
    $testAssembly = Join-Path $buildDirectory 'SystemStabilityDiagnostics.Tests.exe'
    Invoke-Csc @(
        '/nologo',
        '/target:exe',
        "/out:$testAssembly",
        '/reference:System.dll',
        "/reference:$coreAssembly",
        (Join-Path $projectRoot 'tests\SystemStabilityDiagnostics.Tests.cs')
    )
    & $testAssembly
    if ($LASTEXITCODE -ne 0) {
        throw "SystemStabilityDiagnostics.Tests failed with exit code $LASTEXITCODE"
    }
}

Write-Output "System stability diagnostics built: $appAssembly"
