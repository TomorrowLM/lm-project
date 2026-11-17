param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$buildScript = Get-Content -LiteralPath (Join-Path $ProjectRoot 'build.ps1') -Raw
$syncTestScript = Get-Content -LiteralPath (Join-Path $ProjectRoot 'tests\ToolHub.Sync.Tests.ps1') -Raw

function Assert-Contains {
    param(
        [string]$Text,
        [string]$Expected,
        [string]$Message
    )

    if (-not $Text.Contains($Expected)) {
        throw "FAIL $Message`nExpected to find: $Expected"
    }
    Write-Output "PASS $Message"
}

function Assert-NotContains {
    param(
        [string]$Text,
        [string]$Unexpected,
        [string]$Message
    )

    if ($Text.Contains($Unexpected)) {
        throw "FAIL $Message`nDid not expect to find: $Unexpected"
    }
    Write-Output "PASS $Message"
}

Assert-Contains $buildScript "'build'" 'ToolHub defaults local builds to the source build directory'
Assert-Contains $buildScript "'build-test'" 'ToolHub defaults test builds to the source test directory'
Assert-Contains $buildScript '$RunTests' 'ToolHub chooses the test directory when tests are requested'
Assert-NotContains $buildScript '.lm-exe\tool-hub\build' 'ToolHub does not default development output to the runtime directory'
Assert-Contains $syncTestScript 'build-test\sync' 'ToolHub sync tests default to the source test directory'
Assert-NotContains $syncTestScript '$env:TEMP' 'ToolHub sync tests do not default to the system temp directory'

