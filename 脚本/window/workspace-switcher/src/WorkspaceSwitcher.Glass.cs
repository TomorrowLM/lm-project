using System;
using System.IO;
using System.Runtime.InteropServices;

namespace WorkspaceSwitcher.App
{
    internal static class GlassWindowBackdrop
    {
        // Windows 11 system backdrop attributes. TransientWindow is the
        // system-composited Acrylic-like material used for floating surfaces.
        private const int DwmwaUseImmersiveDarkMode = 20;
        private const int DwmwaWindowCornerPreference = 33;
        private const int DwmwaSystemBackdropType = 38;
        private const int DwmstbTransientWindow = 3;
        private const int DwmcpRound = 2;
        private const int WcaWindowCompositionAttribute = 19;
        private const int AccentEnableAcrylicBlurBehind = 4;
        private const uint AcrylicGradientColor = 0x553A2D48;

        [StructLayout(LayoutKind.Sequential)]
        private struct AccentPolicy
        {
            internal int State;
            internal uint Flags;
            internal uint GradientColor;
            internal uint AnimationId;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct WindowCompositionAttributeData
        {
            internal int Attribute;
            internal IntPtr Data;
            internal int Size;
        }

        [DllImport("dwmapi.dll")]
        private static extern int DwmSetWindowAttribute(
            IntPtr window,
            int attribute,
            ref int value,
            int valueSize);

        [DllImport("user32.dll")]
        private static extern int SetWindowCompositionAttribute(
            IntPtr window,
            ref WindowCompositionAttributeData data);

        internal static bool TryApply(IntPtr window)
        {
            if (window == IntPtr.Zero)
            {
                return false;
            }

            try
            {
                bool acrylicApplied = TryApplyWin32Acrylic(window);
                bool cornerApplied = TryApplyRoundedCorners(window);
                bool systemApplied = false;
                if (!acrylicApplied)
                {
                    systemApplied = TryApplySystemAcrylic(window);
                }
                bool applied = (systemApplied || acrylicApplied) && cornerApplied;
                WriteDiagnostic(
                    "TryApply glass window=0x" + window.ToInt64().ToString("X")
                    + " system=" + systemApplied
                    + " win32Acrylic=" + acrylicApplied
                    + " corners=" + cornerApplied
                    + " result=" + applied);
                return applied;
            }
            catch (EntryPointNotFoundException)
            {
                WriteDiagnostic("TryApply EntryPointNotFound window=0x" + window.ToInt64().ToString("X"));
                return false;
            }
            catch (DllNotFoundException)
            {
                WriteDiagnostic("TryApply DllNotFound window=0x" + window.ToInt64().ToString("X"));
                return false;
            }
        }

        private static bool TryApplySystemAcrylic(IntPtr window)
        {
            int darkMode = 1;
            int backdropType = DwmstbTransientWindow;

            // Apply the material first. The window deliberately does not paint
            // its background, so DWM can compose the live desktop behind it.
            bool backdropApplied = SetAttribute(window, DwmwaSystemBackdropType, ref backdropType, "systemBackdropType");
            bool darkModeApplied = SetAttribute(window, DwmwaUseImmersiveDarkMode, ref darkMode, "immersiveDarkMode");
            return backdropApplied && darkModeApplied;
        }

        private static bool TryApplyRoundedCorners(IntPtr window)
        {
            int cornerPreference = DwmcpRound;
            return SetAttribute(window, DwmwaWindowCornerPreference, ref cornerPreference, "cornerPreference");
        }

        private static bool TryApplyWin32Acrylic(IntPtr window)
        {
            AccentPolicy policy = new AccentPolicy
            {
                State = AccentEnableAcrylicBlurBehind,
                Flags = 2,
                GradientColor = AcrylicGradientColor,
                AnimationId = 0
            };
            int policySize = Marshal.SizeOf(typeof(AccentPolicy));
            IntPtr policyPointer = Marshal.AllocHGlobal(policySize);
            try
            {
                Marshal.StructureToPtr(policy, policyPointer, false);
                WindowCompositionAttributeData data = new WindowCompositionAttributeData
                {
                    Attribute = WcaWindowCompositionAttribute,
                    Data = policyPointer,
                    Size = policySize
                };
                int result = SetWindowCompositionAttribute(window, ref data);
                WriteDiagnostic(
                    "SetWindowCompositionAttribute window=0x" + window.ToInt64().ToString("X")
                    + " result=" + result);
                return result != 0;
            }
            catch (EntryPointNotFoundException)
            {
                WriteDiagnostic("SetWindowCompositionAttribute EntryPointNotFound");
                return false;
            }
            catch (DllNotFoundException)
            {
                WriteDiagnostic("SetWindowCompositionAttribute DllNotFound");
                return false;
            }
            finally
            {
                Marshal.FreeHGlobal(policyPointer);
            }
        }

        private static bool SetAttribute(IntPtr window, int attribute, ref int value, string name)
        {
            int result = DwmSetWindowAttribute(window, attribute, ref value, sizeof(int));
            WriteDiagnostic("DwmSetWindowAttribute " + name + " window=0x" + window.ToInt64().ToString("X") + " result=" + result);
            return result == 0;
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
                // Diagnostics must never affect the workspace panel.
            }
        }
    }
}
