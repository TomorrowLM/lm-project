using System;
using System.Windows.Forms;

namespace WorkspaceSwitcher.App
{
    internal static class WorkspaceDisplayService
    {
        internal static string GetDeviceName(IntPtr window)
        {
            if (window == IntPtr.Zero || !NativeMethods.IsWindow(window))
            {
                return String.Empty;
            }

            return Screen.FromHandle(window).DeviceName;
        }

        internal static string GetLabel(string deviceName)
        {
            Screen[] screens = Screen.AllScreens;
            for (int index = 0; index < screens.Length; index++)
            {
                if (String.Equals(screens[index].DeviceName, deviceName, StringComparison.OrdinalIgnoreCase))
                {
                    return "显示器 " + (index + 1);
                }
            }

            return "显示器";
        }
    }
}
