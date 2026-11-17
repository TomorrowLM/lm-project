using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using AudioScene.Core;

namespace AudioScene.Windows
{
    public sealed class WindowsAudioBackend : IAudioSceneBackend, IAudioSceneBackendStatus, IAudioSceneLevelBackend
    {
        private readonly IMMDeviceEnumerator deviceEnumerator;
        private readonly EqualizerApoAdapter apoAdapter;
        private readonly Dictionary<string, AudioLevelLoopbackReader> levelReaders =
            new Dictionary<string, AudioLevelLoopbackReader>(StringComparer.OrdinalIgnoreCase);

        public WindowsAudioBackend()
            : this(string.Empty)
        {
        }

        public WindowsAudioBackend(string userConfigDirectory)
        {
            deviceEnumerator = (IMMDeviceEnumerator)new MMDeviceEnumerator();
            apoAdapter = new EqualizerApoAdapter(userConfigDirectory);
        }

        public string EffectsStatus
        {
            get { return apoAdapter.StatusMessage; }
        }

        public bool TryReadOutputLevel(string deviceId, out AudioLevelSample sample, out string message)
        {
            sample = AudioLevelSample.Silent;
            message = "请选择一个播放设备。";
            if (string.IsNullOrWhiteSpace(deviceId))
            {
                return false;
            }

            AudioLevelLoopbackReader reader = null;
            try
            {
                if (!levelReaders.TryGetValue(deviceId, out reader))
                {
                    reader = new AudioLevelLoopbackReader(deviceId);
                    levelReaders.Add(deviceId, reader);
                }

                return reader.TryRead(out sample, out message);
            }
            catch (Exception ex)
            {
                if (reader != null)
                {
                    levelReaders.Remove(deviceId);
                    reader.Dispose();
                }

                message = "无法开启播放设备回环：" + ex.Message;
                return false;
            }
        }

        public void StopOutputLevel()
        {
            foreach (AudioLevelLoopbackReader reader in levelReaders.Values)
            {
                reader.Dispose();
            }

            levelReaders.Clear();
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
                        int sampleRateHz;
                        int channelCount;
                        ReadMixFormat(device, out sampleRateHz, out channelCount);
                        devices.Add(new AudioDeviceInfo(
                            id,
                            name,
                            string.Equals(id, defaultId, StringComparison.OrdinalIgnoreCase),
                            sampleRateHz,
                            channelCount));
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

                AudioSceneApplyResult result = AudioSceneApplyResult
                    .Applied("已应用场景：" + (string.IsNullOrWhiteSpace(profile.Name) ? "未命名场景" : profile.Name))
                    .AddWarning("设备音量和静音已应用。");
                AudioSceneApoApplyResult apoResult = apoAdapter.Apply(profile);
                if (!apoResult.Applied)
                {
                    result.AddWarning(apoResult.Message);
                }
                else
                {
                    result.AddWarning(apoResult.Message);
                }

                return result;
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

        private static void ReadMixFormat(IMMDevice device, out int sampleRateHz, out int channelCount)
        {
            sampleRateHz = 0;
            channelCount = 0;
            IAudioClient audioClient = null;
            IntPtr formatPointer = IntPtr.Zero;
            try
            {
                Guid audioClientGuid = typeof(IAudioClient).GUID;
                object audioClientObject;
                ThrowIfFailed(
                    device.Activate(ref audioClientGuid, ClsCtx.InprocServer, IntPtr.Zero, out audioClientObject),
                    "打开音频格式接口失败。");
                audioClient = (IAudioClient)audioClientObject;
                ThrowIfFailed(audioClient.GetMixFormat(out formatPointer), "读取输出采样率失败。");
                if (formatPointer == IntPtr.Zero)
                {
                    return;
                }

                WaveFormatEx format = (WaveFormatEx)Marshal.PtrToStructure(
                    formatPointer, typeof(WaveFormatEx));
                sampleRateHz = format.SamplesPerSec > Int32.MaxValue
                    ? Int32.MaxValue
                    : (int)format.SamplesPerSec;
                channelCount = format.Channels;
            }
            catch
            {
                sampleRateHz = 0;
                channelCount = 0;
            }
            finally
            {
                if (formatPointer != IntPtr.Zero)
                {
                    Marshal.FreeCoTaskMem(formatPointer);
                }

                Release(audioClient);
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

        internal enum DataFlow
        {
            Render = 0,
            Capture = 1,
            All = 2
        }

        internal enum Role
        {
            Console = 0,
            Multimedia = 1,
            Communications = 2
        }

        internal enum DeviceState
        {
            Active = 1,
            Disabled = 2,
            NotPresent = 4,
            Unplugged = 8,
            MaskAll = 15
        }

        internal enum StorageAccess
        {
            Read = 0
        }

        internal enum ClsCtx
        {
            InprocServer = 1
        }

        [ComImport]
        [Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
        internal class MMDeviceEnumerator
        {
        }

        [ComImport]
        [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        internal interface IMMDeviceEnumerator
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
        internal interface IMMDeviceCollection
        {
            int GetCount(out uint count);
            int Item(uint index, out IMMDevice device);
        }

        [ComImport]
        [Guid("D666063F-1587-4E43-81F1-B948E807363F")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        internal interface IMMDevice
        {
            int Activate(ref Guid interfaceId, ClsCtx classContext, IntPtr activationParams, [MarshalAs(UnmanagedType.Interface)] out object interfacePointer);
            int OpenPropertyStore(StorageAccess access, out IPropertyStore propertyStore);
            int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
            int GetState(out DeviceState state);
        }

        [ComImport]
        [Guid("886D8EEB-8CF2-4446-8D02-CD43E6DBE1F4")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        internal interface IPropertyStore
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

        [ComImport]
        [Guid("1CB9AD4C-DBFA-4C32-B178-C2F568A703B2")]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        internal interface IAudioClient
        {
            int Initialize(
                int shareMode,
                uint streamFlags,
                long bufferDuration,
                long periodicity,
                IntPtr format,
                IntPtr audioSessionGuid);
            int GetBufferSize(out uint bufferSize);
            int GetStreamLatency(out long latency);
            int GetCurrentPadding(out uint padding);
            int IsFormatSupported(int shareMode, IntPtr format, out IntPtr closestMatch);
            int GetMixFormat(out IntPtr format);
            int GetDevicePeriod(out long defaultDevicePeriod, out long minimumDevicePeriod);
            int Start();
            int Stop();
            int Reset();
            int SetEventHandle(IntPtr eventHandle);
            int GetService(
                ref Guid interfaceId,
                [MarshalAs(UnmanagedType.IUnknown)] out object service);
        }

        [StructLayout(LayoutKind.Sequential)]
        internal struct PropertyKey
        {
            public Guid FormatId;
            public uint PropertyId;
        }

        [StructLayout(LayoutKind.Sequential, Pack = 2)]
        private struct WaveFormatEx
        {
            public ushort FormatTag;
            public ushort Channels;
            public uint SamplesPerSec;
            public uint AverageBytesPerSec;
            public ushort BlockAlign;
            public ushort BitsPerSample;
            public ushort ExtraSize;
        }

        [StructLayout(LayoutKind.Explicit)]
        internal struct PropVariant
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
