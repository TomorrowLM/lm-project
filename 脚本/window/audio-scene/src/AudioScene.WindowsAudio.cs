using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using AudioScene.Core;

namespace AudioScene.Windows
{
    public sealed class WindowsAudioBackend : IAudioSceneBackend
    {
        private readonly IMMDeviceEnumerator deviceEnumerator;

        public WindowsAudioBackend()
        {
            deviceEnumerator = (IMMDeviceEnumerator)new MMDeviceEnumerator();
        }

        public IList<AudioDeviceInfo> GetRenderDevices()
        {
            List<AudioDeviceInfo> devices = new List<AudioDeviceInfo>();
            IMMDeviceCollection collection = null;
            IMMDevice defaultDevice = null;
            string defaultId = string.Empty;

            try
            {
                TryGetDefaultDevice(out defaultDevice, out defaultId);
                ThrowIfFailed(
                    deviceEnumerator.EnumAudioEndpoints(DataFlow.Render, DeviceState.Active, out collection),
                    "枚举播放设备失败。");

                uint count;
                ThrowIfFailed(collection.GetCount(out count), "读取播放设备数量失败。");
                for (uint index = 0; index < count; index++)
                {
                    IMMDevice device = null;
                    try
                    {
                        ThrowIfFailed(collection.Item(index, out device), "读取播放设备失败。");
                        string id;
                        ThrowIfFailed(device.GetId(out id), "读取播放设备 ID 失败。");
                        string name = ReadFriendlyName(device, id);
                        devices.Add(new AudioDeviceInfo(
                            id,
                            name,
                            string.Equals(id, defaultId, StringComparison.OrdinalIgnoreCase)));
                    }
                    finally
                    {
                        Release(device);
                    }
                }

                return devices;
            }
            finally
            {
                Release(defaultDevice);
                Release(collection);
            }
        }

        public AudioSceneApplyResult Apply(AudioSceneProfile profile)
        {
            if (profile == null)
            {
                return AudioSceneApplyResult.Failed("没有选择声音场景。");
            }

            profile.Normalize();
            if (string.IsNullOrWhiteSpace(profile.DeviceId))
            {
                return AudioSceneApplyResult.Failed("场景没有绑定播放设备，未修改系统声音。");
            }

            IMMDevice device = null;
            IAudioEndpointVolume endpointVolume = null;
            try
            {
                ThrowIfFailed(
                    deviceEnumerator.GetDevice(profile.DeviceId, out device),
                    "目标播放设备不可用，未修改系统声音。");

                Guid endpointVolumeGuid = typeof(IAudioEndpointVolume).GUID;
                object endpointObject;
                ThrowIfFailed(
                    device.Activate(ref endpointVolumeGuid, ClsCtx.InprocServer, IntPtr.Zero, out endpointObject),
                    "无法打开目标播放设备，未修改系统声音。");
                endpointVolume = (IAudioEndpointVolume)endpointObject;

                Guid eventContext = Guid.Empty;
                ThrowIfFailed(
                    endpointVolume.SetMasterVolumeLevelScalar(profile.VolumePercent / 100.0f, ref eventContext),
                    "设置设备音量失败。");
                ThrowIfFailed(
                    endpointVolume.SetMute(profile.Muted, ref eventContext),
                    "设置设备静音状态失败。");

                return AudioSceneApplyResult
                    .Applied("已应用场景：" + (string.IsNullOrWhiteSpace(profile.Name) ? "未命名场景" : profile.Name))
                    .AddWarning("当前版本只应用设备音量和静音；通用均衡器由设备或独立音频驱动提供。");
            }
            catch (Exception ex)
            {
                return AudioSceneApplyResult.Failed("应用声音场景失败，系统声音未完成修改：" + ex.Message);
            }
            finally
            {
                Release(endpointVolume);
                Release(device);
            }
        }

        private void TryGetDefaultDevice(out IMMDevice device, out string id)
        {
            device = null;
            id = string.Empty;
            try
            {
                int result = deviceEnumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia, out device);
                if (result >= 0 && device != null)
                {
                    device.GetId(out id);
                }
            }
            catch
            {
                Release(device);
                device = null;
                id = string.Empty;
            }
        }

        private static string ReadFriendlyName(IMMDevice device, string fallback)
        {
            IPropertyStore propertyStore = null;
            try
            {
                ThrowIfFailed(device.OpenPropertyStore(StorageAccess.Read, out propertyStore), "打开播放设备属性失败。");
                PropertyKey key = new PropertyKey
                {
                    FormatId = new Guid("A45C254E-DF1C-4EFD-8020-67D146A850E0"),
                    PropertyId = 14
                };
                PropVariant value;
                ThrowIfFailed(propertyStore.GetValue(ref key, out value), "读取播放设备名称失败。");
                try
                {
                    string friendlyName = value.GetString();
                    return string.IsNullOrWhiteSpace(friendlyName) ? fallback : friendlyName;
                }
                finally
                {
                    value.Clear();
                }
            }
            catch
            {
                return fallback;
            }
            finally
            {
                Release(propertyStore);
            }
        }

        private static void ThrowIfFailed(int result, string message)
        {
            if (result < 0)
            {
                throw new COMException(message, result);
            }
        }

        private static void Release(object value)
        {
            if (value is IDisposable)
            {
                ((IDisposable)value).Dispose();
                return;
            }

            if (value != null && Marshal.IsComObject(value))
            {
                Marshal.ReleaseComObject(value);
            }
        }

        private enum DataFlow
        {
            Render = 0,
            Capture = 1,
            All = 2
        }

        private enum Role
        {
            Console = 0,
            Multimedia = 1,
            Communications = 2
        }

        private enum DeviceState
        {
            Active = 1,
            Disabled = 2,
            NotPresent = 4,
            Unplugged = 8,
            MaskAll = 15
        }

        private enum StorageAccess
        {
            Read = 0
        }

        private enum ClsCtx
        {
            InprocServer = 1
        }

        [ComImport]
        [Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
        private class MMDeviceEnumerator
        {
        }

        [ComImport]
        [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IMMDeviceEnumerator
        {
            int EnumAudioEndpoints(DataFlow dataFlow, DeviceState stateMask, out IMMDeviceCollection devices);
            int GetDefaultAudioEndpoint(DataFlow dataFlow, Role role, out IMMDevice endpoint);
            int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
            int RegisterEndpointNotificationCallback(IntPtr client);
            int UnregisterEndpointNotificationCallback(IntPtr client);
        }

        [ComImport]
        [Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IMMDeviceCollection
        {
            int GetCount(out uint count);
            int Item(uint index, out IMMDevice device);
        }

        [ComImport]
        [Guid("D666063F-1587-4E43-81F1-B948E807363F")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IMMDevice
        {
            int Activate(ref Guid interfaceId, ClsCtx classContext, IntPtr activationParams, [MarshalAs(UnmanagedType.Interface)] out object interfacePointer);
            int OpenPropertyStore(StorageAccess access, out IPropertyStore propertyStore);
            int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
            int GetState(out DeviceState state);
        }

        [ComImport]
        [Guid("886D8EEB-8CF2-4446-8D02-CD43E6DBE1F4")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IPropertyStore
        {
            int GetCount(out uint count);
            int GetAt(uint index, out PropertyKey key);
            int GetValue(ref PropertyKey key, out PropVariant value);
            int SetValue(ref PropertyKey key, ref PropVariant value);
            int Commit();
        }

        [ComImport]
        [Guid("5CDF2C82-841E-4546-9722-0CF74078229A")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        private interface IAudioEndpointVolume
        {
            int RegisterControlChangeNotify(IntPtr notify);
            int UnregisterControlChangeNotify(IntPtr notify);
            int GetChannelCount(out uint channelCount);
            int SetMasterVolumeLevel(float levelDb, ref Guid eventContext);
            int SetMasterVolumeLevelScalar(float level, ref Guid eventContext);
            int GetMasterVolumeLevel(out float levelDb);
            int GetMasterVolumeLevelScalar(out float level);
            int SetChannelVolumeLevel(uint channelNumber, float levelDb, ref Guid eventContext);
            int SetChannelVolumeLevelScalar(uint channelNumber, float level, ref Guid eventContext);
            int GetChannelVolumeLevel(uint channelNumber, out float levelDb);
            int GetChannelVolumeLevelScalar(uint channelNumber, out float level);
            int SetMute([MarshalAs(UnmanagedType.Bool)] bool isMuted, ref Guid eventContext);
            int GetMute([MarshalAs(UnmanagedType.Bool)] out bool isMuted);
            int GetVolumeStepInfo(out uint step, out uint stepCount);
            int VolumeStepUp(ref Guid eventContext);
            int VolumeStepDown(ref Guid eventContext);
            int QueryHardwareSupport(out uint hardwareSupportMask);
            int GetVolumeRange(out float minDb, out float maxDb, out float incrementDb);
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct PropertyKey
        {
            public Guid FormatId;
            public uint PropertyId;
        }

        [StructLayout(LayoutKind.Explicit)]
        private struct PropVariant
        {
            [FieldOffset(0)]
            public ushort Type;

            [FieldOffset(8)]
            public IntPtr PointerValue;

            public string GetString()
            {
                if (PointerValue == IntPtr.Zero)
                {
                    return string.Empty;
                }

                return Type == 31 || Type == 8
                    ? Marshal.PtrToStringUni(PointerValue)
                    : string.Empty;
            }

            public void Clear()
            {
                PropVariantClear(ref this);
            }
        }

        [DllImport("ole32.dll")]
        private static extern int PropVariantClear(ref PropVariant propertyValue);
    }
}
