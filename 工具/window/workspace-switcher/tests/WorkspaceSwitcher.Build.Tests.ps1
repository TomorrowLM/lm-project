param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
$buildScript = Get-Content -LiteralPath (Join-Path $ProjectRoot 'build.ps1') -Raw

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

Assert-Contains $buildScript "'build'" 'WorkspaceSwitcher defaults local builds to the source build directory'
Assert-Contains $buildScript "'build-test'" 'WorkspaceSwitcher defaults test builds to the source test directory'
Assert-Contains $buildScript '$RunTests' 'WorkspaceSwitcher chooses the test directory when tests are requested'
Assert-NotContains $buildScript '.lm-exe\workspace-switcher\build' 'WorkspaceSwitcher does not default development output to the runtime directory'

