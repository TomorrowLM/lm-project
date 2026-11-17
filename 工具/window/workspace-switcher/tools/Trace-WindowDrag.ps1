param([int]$Seconds = 90)
$ErrorActionPreference = 'Stop'
$traceRoot = Join-Path (Split-Path $PSScriptRoot -Parent) 'build-test\drag-trace'
New-Item -ItemType Directory -Force -Path $traceRoot | Out-Null
$tracePath = Join-Path $traceRoot ('drag-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.jsonl')
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class DragProbe {
 public delegate bool EnumProc(IntPtr h,IntPtr data);
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback,IntPtr data);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [StructLayout(LayoutKind.Sequential)] public struct Point { public int X,Y; }
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
 [StructLayout(LayoutKind.Sequential)] public struct Gui { public int Size,Flags; public IntPtr Active,Focus,Capture,MenuOwner,MoveSize,Caret; public Rect CaretRect; }
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool GetCursorPos(out Point p);
 [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int k);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll")] public static extern bool GetGUIThreadInfo(uint t,ref Gui g);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")] public static extern IntPtr SendMessageTimeout(IntPtr h,uint m,IntPtr w,IntPtr l,uint f,uint t,out IntPtr r);
}
'@
Write-Output "TRACE=$tracePath"
$panel=Get-Process WorkspaceSwitcher -ErrorAction SilentlyContinue | Select-Object -First 1
$panelHandle=if($panel){$panel.MainWindowHandle}else{[IntPtr]::Zero}
$watch=[Diagnostics.Stopwatch]::StartNew()
$lastKey=''
$lastSample=0
while ($watch.Elapsed.TotalSeconds -lt $Seconds) {
    $fg=[DragProbe]::GetForegroundWindow()
    [uint32]$fgPid=0
    $thread=[DragProbe]::GetWindowThreadProcessId($fg,[ref]$fgPid)
    $g=New-Object DragProbe+Gui
    $g.Size=[Runtime.InteropServices.Marshal]::SizeOf($g)
    [void][DragProbe]::GetGUIThreadInfo($thread,[ref]$g)
    $p=New-Object DragProbe+Point
    [void][DragProbe]::GetCursorPos([ref]$p)
    $r=New-Object DragProbe+Rect
    [void][DragProbe]::GetWindowRect($fg,[ref]$r)
    $down=([DragProbe]::GetAsyncKeyState(1) -band 0x8000) -ne 0
    $key="$fg/$down/$($g.MoveSize)/$($g.Flags)"
    if ($key -ne $lastKey -or ($down -and $watch.ElapsedMilliseconds-$lastSample -ge 150)) {
        $visibleWindows=[Collections.Generic.List[long]]::new()
        if ($panel) {
            [DragProbe]::EnumWindows({param($h,$unused)
                [uint32]$ownerId=0
                [void][DragProbe]::GetWindowThreadProcessId($h,[ref]$ownerId)
                if ($ownerId -eq $panel.Id -and [DragProbe]::IsWindowVisible($h)) { $visibleWindows.Add($h.ToInt64()) }
                return $true
            },[IntPtr]::Zero) | Out-Null
            if ($visibleWindows.Count -gt 0) { $panelHandle=[IntPtr]$visibleWindows[0] }
        }
        $responsive=$null
        if ($panelHandle -ne [IntPtr]::Zero) {
            $reply=[IntPtr]::Zero
            $responsive=[DragProbe]::SendMessageTimeout($panelHandle,0,[IntPtr]::Zero,[IntPtr]::Zero,2,80,[ref]$reply) -ne [IntPtr]::Zero
        }
        @{ms=$watch.ElapsedMilliseconds;fg=$fg.ToInt64();pid=$fgPid;down=$down;move=$g.MoveSize.ToInt64();capture=$g.Capture.ToInt64();flags=$g.Flags;x=$p.X;y=$p.Y;top=$r.Top;left=$r.Left;responsive=$responsive;visibleWindows=@($visibleWindows.ToArray())} | ConvertTo-Json -Compress | Add-Content -LiteralPath $tracePath
        $lastKey=$key
        $lastSample=$watch.ElapsedMilliseconds
    }
    Start-Sleep -Milliseconds 40
}
Get-Content -LiteralPath $tracePath
