param([int]$ThreadId,[int]$Seconds=90)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class WaitProbe {
 [DllImport("advapi32.dll",SetLastError=true)] static extern IntPtr OpenThreadWaitChainSession(uint f,IntPtr c);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool GetThreadWaitChain(IntPtr s,IntPtr c,uint flags,uint tid,ref uint n,IntPtr nodes,out bool cycle);
 [DllImport("advapi32.dll")] static extern void CloseThreadWaitChainSession(IntPtr s);
 public static string Read(uint tid) {
  var s=OpenThreadWaitChainSession(0,IntPtr.Zero);var b=Marshal.AllocHGlobal(280*16);
  try { uint n=16;bool cycle;bool ok=GetThreadWaitChain(s,IntPtr.Zero,7,tid,ref n,b,out cycle);
   string result="ok="+ok+" error="+Marshal.GetLastWin32Error()+" count="+n+" cycle="+cycle;
   if(ok)for(int i=0;i<n;i++){var p=IntPtr.Add(b,280*i);int type=Marshal.ReadInt32(p);result+=" | type="+type+" status="+Marshal.ReadInt32(p,4)+(type==8?" pid="+Marshal.ReadInt32(p,8)+" tid="+Marshal.ReadInt32(p,12):"");}
   return result;
  } finally {Marshal.FreeHGlobal(b);CloseThreadWaitChainSession(s);}
 }
}
'@
$watch=[Diagnostics.Stopwatch]::StartNew()
$previous=''
while($watch.Elapsed.TotalSeconds -lt $Seconds) {
 $chain=[WaitProbe]::Read($ThreadId)
 if($chain -ne $previous) { Write-Output ($watch.ElapsedMilliseconds.ToString()+' '+$chain);$previous=$chain }
 Start-Sleep -Milliseconds 150
}
