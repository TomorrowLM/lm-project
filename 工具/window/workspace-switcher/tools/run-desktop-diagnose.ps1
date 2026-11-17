$scriptPath = Get-ChildItem -Path 'D:\LM\lm-project' -Recurse -Filter 'Repair-DesktopBlackScreen.ps1' | Select-Object -First 1 -ExpandProperty FullName
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath -Mode Diagnose
exit $LASTEXITCODE
