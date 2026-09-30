param(
    [switch]$RunTests,
    [string]$OutputDirectory = (Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::UserProfile)) '.lm-exe\workspace-switcher\build')
)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$build = if ([System.IO.Path]::IsPathRooted($OutputDirectory)) {
    $OutputDirectory
} else {
    Join-Path $project $OutputDirectory
}
$csc = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'

if (-not (Test-Path $csc)) {
    throw "C# compiler not found: $csc"
}

New-Item -ItemType Directory -Force -Path $build | Out-Null
$core = Join-Path $build 'WorkspaceSwitcher.Core.dll'
$app = Join-Path $build 'WorkspaceSwitcher.exe'

& $csc /nologo /target:library ('/out:' + $core) (Join-Path $project 'src\WorkspaceSwitcher.Core.cs')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$appSources = @(Get-ChildItem (Join-Path $project 'src') -Filter '*.cs' |
    Where-Object {
        $_.Name -ne 'WorkspaceSwitcher.Core.cs' -and
        $_.Name -ne 'WorkspaceSwitcher.ToolHub.cs' -and
        $_.Name -ne 'WorkspaceSwitcher.ToolHubModel.cs'
    } |
    Sort-Object Name |
    ForEach-Object FullName)
$appArguments = @(
    '/nologo',
    '/target:winexe',
    ('/out:' + $app),
    '/reference:System.dll',
    '/reference:System.Drawing.dll',
    '/reference:System.Windows.Forms.dll',
    '/reference:System.Management.dll',
    ('/reference:' + $core)
) + $appSources
& $csc @appArguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not $RunTests) {
    Write-Output "Built $app"
    exit 0
}

$coreTests = Join-Path $build 'WorkspaceSwitcher.Core.Tests.exe'
$appTests = Join-Path $build 'WorkspaceSwitcher.App.Tests.exe'
& $csc /nologo /target:exe ('/out:' + $coreTests) /reference:System.dll ('/reference:' + $core) (Join-Path $project 'tests\WorkspaceSwitcher.Core.Tests.cs')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $csc /nologo /target:exe ('/out:' + $appTests) /reference:System.dll /reference:System.Drawing.dll /reference:System.Windows.Forms.dll ('/reference:' + $core) (Join-Path $project 'tests\WorkspaceSwitcher.App.Tests.cs')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $coreTests $core
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $appTests $app (Join-Path $project 'src')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$colorTests = Join-Path $build 'WorkspaceSwitcher.ColorField.Tests.exe'
& $csc /nologo /target:exe ('/out:' + $colorTests) /reference:System.dll /reference:System.Drawing.dll (Join-Path $project 'tests\WorkspaceSwitcher.ColorField.Tests.cs')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $colorTests $app (Join-Path $build 'color-glass-preview.png')
exit $LASTEXITCODE
