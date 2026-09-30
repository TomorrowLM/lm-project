Get-Process -Name WorkspaceSwitcher -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Output 'WorkspaceSwitcher stop requested.'
