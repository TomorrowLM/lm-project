Get-Process -Name explorer,dwm -ErrorAction SilentlyContinue |
  Select-Object Name,Id,Responding,StartTime | Format-Table -AutoSize
