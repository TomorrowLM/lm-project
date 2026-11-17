$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class DesktopWindowProbe {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int index);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int maxCount);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@

$screen = [System.Windows.Forms.SystemInformation]::VirtualScreen
$minimumWidth = [math]::Floor($screen.Width * 0.90)
$minimumHeight = [math]::Floor($screen.Height * 0.75)
$windows = [System.Collections.Generic.List[object]]::new()

[DesktopWindowProbe]::EnumWindows({
    param($hWnd, $lParam)
    if (-not [DesktopWindowProbe]::IsWindowVisible($hWnd) -or [DesktopWindowProbe]::IsIconic($hWnd)) {
        return $true
    }

    $rect = [DesktopWindowProbe+RECT]::new()
    if (-not [DesktopWindowProbe]::GetWindowRect($hWnd, [ref]$rect)) {
        return $true
    }

    $width = $rect.Right - $rect.Left
    $height = $rect.Bottom - $rect.Top
    if ($width -lt 1200 -and $height -lt 800) {
        return $true
    }

    $titleBuilder = [Text.StringBuilder]::new(256)
    [DesktopWindowProbe]::GetWindowText($hWnd, $titleBuilder, 256) | Out-Null
    [uint32]$pid = 0
    [DesktopWindowProbe]::GetWindowThreadProcessId($hWnd, [ref]$pid) | Out-Null
    try {
        $process = Get-Process -Id $pid -ErrorAction Stop
        $processName = $process.ProcessName
    } catch {
        $processName = '?'
    }

    $windows.Add([pscustomobject]@{
        Handle = ('0x{0:X}' -f $hWnd.ToInt64())
        Pid = $pid
        Process = $processName
        Title = $titleBuilder.ToString()
        Bounds = "$($rect.Left),$($rect.Top) $($width)x$($height)"
        FullScreenLike = ($width -ge $minimumWidth -and $height -ge $minimumHeight)
        ExtendedStyle = ('0x{0:X8}' -f ([DesktopWindowProbe]::GetWindowLong($hWnd, -20)))
    }) | Out-Null
    return $true
}, [IntPtr]::Zero) | Out-Null

$windows |
    Sort-Object @{Expression = 'FullScreenLike'; Descending = $true}, @{Expression = 'Pid'; Descending = $false} |
    ConvertTo-Json -Depth 3
