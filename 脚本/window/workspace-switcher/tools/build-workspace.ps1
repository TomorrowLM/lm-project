$ErrorActionPreference = 'Stop'
$script = Get-ChildItem -Path 'D:\LM\lm-project\*\window\workspace-switcher\build.ps1' -File | Select-Object -First 1
if ($null -eq $script) { throw 'workspace build script not found' }

$artifactRoot = Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::UserProfile)) '.lm-exe\workspace-switcher'
$buildDirectory = Join-Path $artifactRoot 'build'
$logDirectory = Join-Path $artifactRoot 'logs'
New-Item -ItemType Directory -Force -Path $buildDirectory, $logDirectory | Out-Null

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logPath = Join-Path $logDirectory ("build-$stamp.log")
& $script.FullName -RunTests -OutputDirectory $buildDirectory 2>&1 | Tee-Object -FilePath $logPath
$exitCode = $LASTEXITCODE

[ordered]@{
    Timestamp = (Get-Date).ToString('o')
    Source = $script.Directory.FullName
    Output = $buildDirectory
    Log = $logPath
    ExitCode = $exitCode
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logDirectory 'last-build.json') -Encoding UTF8

exit $exitCode
