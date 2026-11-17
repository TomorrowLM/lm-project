using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

namespace WorkspaceSwitcher.App
{
    // Reads the wallpaper-rendering Shell window without capturing the
    // composited desktop and without changing Explorer or DWM state.
    internal static class DesktopShellWallpaper
    {
        private const uint PrintWindowRenderFullContent = 2;
        private const uint RasterOperationSourceCopy = 0x00CC0020;
        private const int WindowNext = 2;

        [StructLayout(LayoutKind.Sequential)]
        private struct NativeRect
        {
            internal int Left;
            internal int Top;
            internal int Right;
            internal int Bottom;
        }

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr FindWindow(string className, string windowName);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string className, string windowName);

        [DllImport("user32.dll")]
        private static extern IntPtr GetWindow(IntPtr window, uint command);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern int GetClassName(IntPtr window, System.Text.StringBuilder text, int max);

        [DllImport("user32.dll")]
        private static extern bool GetWindowRect(IntPtr window, out NativeRect rect);

        [DllImport("user32.dll")]
        private static extern bool PrintWindow(IntPtr window, IntPtr destination, uint flags);

        [DllImport("user32.dll")]
        private static extern IntPtr GetWindowDC(IntPtr window);

        [DllImport("user32.dll")]
        private static extern int ReleaseDC(IntPtr window, IntPtr dc);

        [DllImport("gdi32.dll")]
        private static extern bool BitBlt(
            IntPtr destination,
            int x,
            int y,
            int width,
            int height,
            IntPtr source,
            int sourceX,
            int sourceY,
            uint operation);

        internal static Bitmap Capture(Rectangle virtualScreen)
        {
            if (virtualScreen.Width < 2 || virtualScreen.Height < 2)
            {
                return null;
            }

            IntPtr wallpaperWindow = FindWallpaperWindow();
            if (wallpaperWindow == IntPtr.Zero)
            {
                WriteDiagnostic("shellCapture noWallpaperWindow");
                return null;
            }

            NativeRect nativeBounds;
            if (!GetWindowRect(wallpaperWindow, out nativeBounds))
            {
                WriteDiagnostic("shellCapture GetWindowRectFailed window=0x" + wallpaperWindow.ToInt64().ToString("X"));
                return null;
            }

            int width = nativeBounds.Right - nativeBounds.Left;
            int height = nativeBounds.Bottom - nativeBounds.Top;
            if (width < 2 || height < 2)
            {
                WriteDiagnostic("shellCapture invalidBounds window=0x" + wallpaperWindow.ToInt64().ToString("X"));
                return null;
            }

            WriteDiagnostic(
                "shellCapture window=0x" + wallpaperWindow.ToInt64().ToString("X")
                + " bounds=" + nativeBounds.Left + "," + nativeBounds.Top + " " + width + "x" + height);

            using (Bitmap windowImage = new Bitmap(width, height, PixelFormat.Format32bppPArgb))
            {
                if (!RenderWindow(wallpaperWindow, windowImage))
                {
                    WriteDiagnostic("shellCapture RenderWindowFailed window=0x" + wallpaperWindow.ToInt64().ToString("X"));
                    return null;
                }

                Bitmap result = new Bitmap(virtualScreen.Width, virtualScreen.Height, PixelFormat.Format32bppPArgb);
                using (Graphics graphics = Graphics.FromImage(result))
                {
                    graphics.Clear(Color.Black);
                    graphics.DrawImageUnscaled(
                        windowImage,
                        nativeBounds.Left - virtualScreen.Left,
                        nativeBounds.Top - virtualScreen.Top);
                }

                if (!HasVisiblePixels(result))
                {
                    WriteDiagnostic("shellCapture RenderedPixelsWereEmpty window=0x" + wallpaperWindow.ToInt64().ToString("X"));
                    result.Dispose();
                    return null;
                }

                return result;
            }
        }

        private static bool RenderWindow(IntPtr window, Bitmap target)
        {
            using (Graphics graphics = Graphics.FromImage(target))
            {
                IntPtr destination = graphics.GetHdc();
                bool printed;
                try
                {
                    printed = PrintWindow(window, destination, PrintWindowRenderFullContent);
                }
                finally
                {
                    graphics.ReleaseHdc(destination);
                }

                if (printed && HasVisiblePixels(target))
                {
                    return true;
                }
            }

            using (Graphics graphics = Graphics.FromImage(target))
            {
                IntPtr destination = graphics.GetHdc();
                IntPtr source = GetWindowDC(window);
                try
                {
                    return source != IntPtr.Zero
                        && BitBlt(destination, 0, 0, target.Width, target.Height, source, 0, 0, RasterOperationSourceCopy)
                        && HasVisiblePixels(target);
                }
                finally
                {
                    if (source != IntPtr.Zero)
                    {
                        ReleaseDC(window, source);
                    }
                    graphics.ReleaseHdc(destination);
                }
            }
        }

        private static bool HasVisiblePixels(Bitmap image)
        {
            int visible = 0;
            int samples = 0;
            for (int y = 0; y < image.Height; y += Math.Max(1, image.Height / 12))
            for (int x = 0; x < image.Width; x += Math.Max(1, image.Width / 12))
            {
                Color color = image.GetPixel(x, y);
                samples++;
                if (color.R > 8 || color.G > 8 || color.B > 8)
                {
                    visible++;
                }
            }

            return samples > 0 && visible * 100 >= samples * 5;
        }

        private static IntPtr FindWallpaperWindow()
        {
            IntPtr worker = FindWindowEx(IntPtr.Zero, IntPtr.Zero, "WorkerW", null);
            while (worker != IntPtr.Zero)
            {
                IntPtr shellView = FindWindowEx(worker, IntPtr.Zero, "SHELLDLL_DefView", null);
                if (shellView != IntPtr.Zero)
                {
                    IntPtr next = GetWindow(worker, WindowNext);
                    if (String.Equals(GetClassNameValue(next), "WorkerW", StringComparison.Ordinal))
                    {
                        return next;
                    }
                }

                worker = FindWindowEx(IntPtr.Zero, worker, "WorkerW", null);
            }

            IntPtr progman = FindWindow("Progman", null);
            return progman;
        }

        private static string GetClassNameValue(IntPtr window)
        {
            if (window == IntPtr.Zero)
            {
                return String.Empty;
            }

            System.Text.StringBuilder value = new System.Text.StringBuilder(128);
            return GetClassName(window, value, value.Capacity) > 0 ? value.ToString() : String.Empty;
        }

        private static void WriteDiagnostic(string message)
        {
            try
            {
                string path = Path.Combine(Path.GetTempPath(), "WorkspaceSwitcher-glass-runtime.log");
                File.AppendAllText(path, DateTime.Now.ToString("O") + " " + message + Environment.NewLine);
            }
            catch (Exception)
            {
            }
        }
    }
}
