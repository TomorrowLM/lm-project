using System;
using System.Diagnostics;
using System.Reflection;
using System.Runtime.InteropServices;

internal static class MeasureWindowScan
{
    private delegate bool EnumProc(IntPtr window, IntPtr data);
    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumProc callback, IntPtr data);
    [DllImport("user32.dll")] private static extern int GetWindowTextLength(IntPtr window);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
    public static void Main(string[] args)
    {
        Type form = Assembly.LoadFrom(args[0]).GetType("WorkspaceSwitcher.App.WorkspaceForm");
        MethodInfo getName = form.GetMethod("GetProcessName", BindingFlags.Static | BindingFlags.NonPublic);
        int count = 0;
        Stopwatch total = Stopwatch.StartNew();
        EnumWindows(delegate(IntPtr window, IntPtr data)
        {
            if (GetWindowTextLength(window) == 0) return true;
            uint process;
            GetWindowThreadProcessId(window, out process);
            Stopwatch timer = Stopwatch.StartNew();
            string name = (string)getName.Invoke(null, new object[] { process });
            if (timer.ElapsedMilliseconds > 50)
                Console.WriteLine("SLOW pid=" + process + " process=" + name + " ms=" + timer.ElapsedMilliseconds);
            count++;
            return true;
        }, IntPtr.Zero);
        Console.WriteLine("SCAN windows=" + count + " ms=" + total.ElapsedMilliseconds);
    }
}
