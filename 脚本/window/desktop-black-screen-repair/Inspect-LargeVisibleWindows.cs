using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

internal static class InspectLargeVisibleWindows
{
    private const int GwlExstyle = -20;
    private const int WsExTopmost = 0x00000008;

    [UnmanagedFunctionPointer(CallingConvention.Winapi)]
    private delegate bool EnumWindowsProc(IntPtr window, IntPtr parameter);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr parameter);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr window);

    [DllImport("user32.dll")]
    private static extern bool IsIconic(IntPtr window);

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr window, out Rect rect);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);

    [DllImport("user32.dll")]
    private static extern int GetWindowLong(IntPtr window, int index);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr window, StringBuilder text, int length);

    [StructLayout(LayoutKind.Sequential)]
    private struct Rect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    private sealed class WindowInfo
    {
        public IntPtr Handle;
        public uint ProcessId;
        public string ProcessName;
        public string Title;
        public Rectangle Bounds;
        public int ExtendedStyle;
    }

    private static int Main()
    {
        Rectangle virtualScreen = SystemInformation.VirtualScreen;
        List<WindowInfo> windows = new List<WindowInfo>();
        EnumWindows(delegate(IntPtr window, IntPtr parameter)
        {
            if (!IsWindowVisible(window) || IsIconic(window))
            {
                return true;
            }

            Rect rect;
            if (!GetWindowRect(window, out rect))
            {
                return true;
            }

            Rectangle bounds = Rectangle.FromLTRB(rect.Left, rect.Top, rect.Right, rect.Bottom);
            if (bounds.Width < 1200 && bounds.Height < 800)
            {
                return true;
            }

            uint processId;
            GetWindowThreadProcessId(window, out processId);
            string processName = "?";
            try
            {
                using (Process process = Process.GetProcessById((int)processId))
                {
                    processName = process.ProcessName;
                }
            }
            catch
            {
            }

            StringBuilder title = new StringBuilder(256);
            GetWindowText(window, title, title.Capacity);
            windows.Add(new WindowInfo
            {
                Handle = window,
                ProcessId = processId,
                ProcessName = processName,
                Title = title.ToString(),
                Bounds = bounds,
                ExtendedStyle = GetWindowLong(window, GwlExstyle)
            });
            return true;
        }, IntPtr.Zero);

        windows.Sort(delegate(WindowInfo left, WindowInfo right)
        {
            bool leftFull = left.Bounds.Width >= virtualScreen.Width * 0.9 && left.Bounds.Height >= virtualScreen.Height * 0.75;
            bool rightFull = right.Bounds.Width >= virtualScreen.Width * 0.9 && right.Bounds.Height >= virtualScreen.Height * 0.75;
            return rightFull.CompareTo(leftFull);
        });

        Console.WriteLine("VirtualScreen={0},{1} {2}x{3}", virtualScreen.Left, virtualScreen.Top, virtualScreen.Width, virtualScreen.Height);
        foreach (WindowInfo window in windows)
        {
            bool full = window.Bounds.Width >= virtualScreen.Width * 0.9 && window.Bounds.Height >= virtualScreen.Height * 0.75;
            bool topMost = (window.ExtendedStyle & WsExTopmost) != 0;
            Console.WriteLine("{0} pid={1} process={2} bounds={3},{4} {5}x{6} topmost={7} title=<{8}>",
                full ? "FULL" : "LARGE",
                window.ProcessId,
                window.ProcessName,
                window.Bounds.Left,
                window.Bounds.Top,
                window.Bounds.Width,
                window.Bounds.Height,
                topMost,
                window.Title);
        }

        return 0;
    }
}
