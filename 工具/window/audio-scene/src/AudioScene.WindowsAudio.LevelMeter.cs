using System;
using System.Runtime.InteropServices;
using AudioScene.Core;

namespace AudioScene.Windows
{
    internal sealed class AudioLevelLoopbackReader : IDisposable
    {
        private const int SharedMode = 0;
        private const uint AudioClientStreamFlagsLoopback = 0x00020000;
        private const uint AudioClientBufferFlagSilent = 0x00000002;
        private const ushort WaveFormatPcm = 1;
        private const ushort WaveFormatIeeeFloat = 3;
        private const ushort WaveFormatExtensible = 0xFFFE;
        private readonly WindowsAudioBackend.IAudioClient audioClient;
        private IntPtr captureClientPointer;
        private readonly GetBufferDelegate getBuffer;
        private readonly ReleaseBufferDelegate releaseBuffer;
        private readonly GetNextPacketSizeDelegate getNextPacketSize;
        private readonly int channelCount;
        private readonly int bitsPerSample;
        private readonly int blockAlign;
        private readonly bool isFloat;
        private byte[] rawBuffer = new byte[0];
        private float[] sampleBuffer = new float[0];
        private bool disposed;

        public AudioLevelLoopbackReader(string deviceId)
        {
            WindowsAudioBackend.IMMDeviceEnumerator enumerator = null;
            WindowsAudioBackend.IMMDevice device = null;
            IntPtr formatPointer = IntPtr.Zero;
            IntPtr servicePointer = IntPtr.Zero;
            IntPtr audioClientInterfacePointer = IntPtr.Zero;
            string stage = "创建播放设备枚举器";
            try
            {
                enumerator = (WindowsAudioBackend.IMMDeviceEnumerator)new WindowsAudioBackend.MMDeviceEnumerator();
                stage = "打开播放设备";
                ThrowIfFailed(enumerator.GetDevice(deviceId, out device), "打开播放设备失败。");

                stage = "打开音频客户端";
                Guid audioClientGuid = typeof(WindowsAudioBackend.IAudioClient).GUID;
                object audioClientObject;
                ThrowIfFailed(
                    device.Activate(ref audioClientGuid, WindowsAudioBackend.ClsCtx.InprocServer, IntPtr.Zero, out audioClientObject),
                    "打开回环音频接口失败。");
                audioClient = (WindowsAudioBackend.IAudioClient)audioClientObject;
                audioClientInterfacePointer = Marshal.GetComInterfaceForObject(
                    audioClient,
                    typeof(WindowsAudioBackend.IAudioClient));

                stage = "读取回环格式";
                ThrowIfFailed(audioClient.GetMixFormat(out formatPointer), "读取回环音频格式失败。");
                if (formatPointer == IntPtr.Zero)
                {
                    throw new InvalidOperationException("播放设备没有可用的混音格式。");
                }

                WaveFormatInfo format = WaveFormatInfo.Read(formatPointer);
                channelCount = format.Channels;
                bitsPerSample = format.BitsPerSample;
                blockAlign = format.BlockAlign;
                isFloat = format.IsFloat;
                if (channelCount <= 0 || blockAlign <= 0 || (bitsPerSample != 16 && bitsPerSample != 24 && bitsPerSample != 32))
                {
                    throw new InvalidOperationException("播放设备的回环格式暂不支持。");
                }

                stage = "初始化回环客户端";
                ThrowIfFailed(
                    audioClient.Initialize(
                        SharedMode,
                        AudioClientStreamFlagsLoopback,
                        0,
                        0,
                        formatPointer,
                        IntPtr.Zero),
                    "初始化播放回环失败。");

                stage = "打开回环缓冲服务";
                Guid captureClientGuid = new Guid("C8ADBD64-E71E-48A0-A4DE-185C395CD317");
                int serviceResult = GetAudioClientService(
                    audioClientInterfacePointer,
                    ref captureClientGuid,
                    out servicePointer);
                if (serviceResult < 0)
                {
                    throw new COMException(
                        "打开播放回环缓冲失败（HRESULT=0x" + serviceResult.ToString("X8") + "）。",
                        serviceResult);
                }
                captureClientPointer = servicePointer;
                servicePointer = IntPtr.Zero;
                stage = "绑定回环读取函数";
                getBuffer = CreateGetBufferDelegate(captureClientPointer);
                stage = "绑定回环释放函数";
                releaseBuffer = CreateReleaseBufferDelegate(captureClientPointer);
                stage = "绑定回环取包函数";
                getNextPacketSize = CreateGetNextPacketSizeDelegate(captureClientPointer);
                stage = "启动回环客户端";
                ThrowIfFailed(audioClient.Start(), "启动播放回环失败。");
            }
            catch (Exception ex)
            {
                if (servicePointer != IntPtr.Zero)
                {
                    Marshal.Release(servicePointer);
                }
                ReleaseServicePointer();
                Release(audioClient);
                throw new InvalidOperationException(
                    stage + "失败（" + ex.GetType().FullName + "）：" + ex.Message,
                    ex);
            }
            finally
            {
                if (formatPointer != IntPtr.Zero)
                {
                    Marshal.FreeCoTaskMem(formatPointer);
                }

                Release(device);
                Release(enumerator);
                if (audioClientInterfacePointer != IntPtr.Zero)
                {
                    Marshal.Release(audioClientInterfacePointer);
                }
            }
        }

        public bool TryRead(out AudioLevelSample sample, out string message)
        {
            sample = AudioLevelSample.Silent;
            message = "已开启，当前没有可用播放声音。";
            if (disposed)
            {
                message = "声音动态监测已停止。";
                return false;
            }

            try
            {
                int totalSamples = 0;
                uint packetFrames;
                ThrowIfFailed(getNextPacketSize(captureClientPointer, out packetFrames), "读取播放回环缓冲失败。");
                while (packetFrames > 0)
                {
                    if (packetFrames > 1000000)
                    {
                        throw new InvalidOperationException("播放回环缓冲过大，已安全停止本次读取。");
                    }

                    int frameCount = checked((int)packetFrames);
                    int byteCount = checked(frameCount * blockAlign);
                    int packetSampleCount = checked(frameCount * channelCount);
                    EnsureRawBuffer(byteCount);
                    EnsureSampleBuffer(totalSamples + packetSampleCount);

                    IntPtr data = IntPtr.Zero;
                    uint framesRead = 0;
                    uint flags = 0;
                    ulong devicePosition = 0;
                    ulong qpcPosition = 0;
                    bool acquired = false;
                    try
                    {
                        ThrowIfFailed(
                            getBuffer(
                                captureClientPointer,
                                out data,
                                out framesRead,
                                out flags,
                                out devicePosition,
                                out qpcPosition),
                            "读取播放回环数据失败。");
                        acquired = true;
                        if ((flags & AudioClientBufferFlagSilent) != 0 || data == IntPtr.Zero)
                        {
                            Array.Clear(sampleBuffer, totalSamples, packetSampleCount);
                        }
                        else
                        {
                            Marshal.Copy(data, rawBuffer, 0, byteCount);
                            for (int frame = 0; frame < frameCount; frame++)
                            {
                                int sourceFrameOffset = frame * blockAlign;
                                int targetFrameOffset = totalSamples + frame * channelCount;
                                for (int channel = 0; channel < channelCount; channel++)
                                {
                                    int sourceOffset = sourceFrameOffset + channel * (bitsPerSample / 8);
                                    sampleBuffer[targetFrameOffset + channel] = ReadSample(rawBuffer, sourceOffset);
                                }
                            }
                        }

                        totalSamples += packetSampleCount;
                    }
                    finally
                    {
                        if (acquired)
                        {
                            ThrowIfFailed(releaseBuffer(captureClientPointer, framesRead), "释放播放回环缓冲失败。");
                        }
                    }

                    ThrowIfFailed(getNextPacketSize(captureClientPointer, out packetFrames), "读取播放回环缓冲失败。");
                }

                if (totalSamples > 0)
                {
                    sample = AudioLevelMath.MeasureInterleaved(sampleBuffer, totalSamples, channelCount);
                    message = sample.HasSignal
                        ? "正在监测选定播放设备输出。"
                        : "已开启，当前没有可用播放声音。";
                }

                return true;
            }
            catch (Exception ex)
            {
                message = "读取播放声音失败：" + ex.Message;
                return false;
            }
        }

        public void Dispose()
        {
            if (disposed)
            {
                return;
            }

            disposed = true;
            try
            {
                audioClient.Stop();
            }
            catch
            {
            }

            ReleaseServicePointer();
            Release(audioClient);
        }

        private void ReleaseServicePointer()
        {
            if (captureClientPointer != IntPtr.Zero)
            {
                Marshal.Release(captureClientPointer);
                captureClientPointer = IntPtr.Zero;
            }
        }

        private void EnsureRawBuffer(int requiredLength)
        {
            if (rawBuffer.Length < requiredLength)
            {
                rawBuffer = new byte[requiredLength];
            }
        }

        private void EnsureSampleBuffer(int requiredLength)
        {
            if (sampleBuffer.Length < requiredLength)
            {
                sampleBuffer = new float[requiredLength];
            }
        }

        private float ReadSample(byte[] bytes, int offset)
        {
            if (isFloat && bitsPerSample == 32)
            {
                return BitConverter.ToSingle(bytes, offset);
            }

            if (bitsPerSample == 16)
            {
                return BitConverter.ToInt16(bytes, offset) / 32768.0f;
            }

            if (bitsPerSample == 24)
            {
                int value = bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
                if ((value & 0x00800000) != 0)
                {
                    value |= unchecked((int)0xFF000000);
                }

                return value / 8388608.0f;
            }

            return BitConverter.ToInt32(bytes, offset) / 2147483648.0f;
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
            if (value != null && Marshal.IsComObject(value))
            {
                Marshal.ReleaseComObject(value);
            }
        }

        private static int GetAudioClientService(
            IntPtr audioClientInterface,
            ref Guid interfaceId,
            out IntPtr service)
        {
            GetServiceDelegate getService = (GetServiceDelegate)Marshal.GetDelegateForFunctionPointer(
                ReadVtableFunction(audioClientInterface, 14),
                typeof(GetServiceDelegate));
            return getService(audioClientInterface, ref interfaceId, out service);
        }

        private static GetBufferDelegate CreateGetBufferDelegate(IntPtr comObject)
        {
            return (GetBufferDelegate)Marshal.GetDelegateForFunctionPointer(
                ReadVtableFunction(comObject, 3),
                typeof(GetBufferDelegate));
        }

        private static ReleaseBufferDelegate CreateReleaseBufferDelegate(IntPtr comObject)
        {
            return (ReleaseBufferDelegate)Marshal.GetDelegateForFunctionPointer(
                ReadVtableFunction(comObject, 4),
                typeof(ReleaseBufferDelegate));
        }

        private static GetNextPacketSizeDelegate CreateGetNextPacketSizeDelegate(IntPtr comObject)
        {
            return (GetNextPacketSizeDelegate)Marshal.GetDelegateForFunctionPointer(
                ReadVtableFunction(comObject, 5),
                typeof(GetNextPacketSizeDelegate));
        }

        private static IntPtr ReadVtableFunction(IntPtr comObject, int vtableIndex)
        {
            IntPtr vtable = Marshal.ReadIntPtr(comObject);
            return Marshal.ReadIntPtr(vtable, vtableIndex * IntPtr.Size);
        }

        private enum ClsCtx
        {
            InprocServer = 1
        }

        

        [UnmanagedFunctionPointer(CallingConvention.StdCall)]
        private delegate int GetBufferDelegate(
            IntPtr @this,
            out IntPtr dataToRead,
            out uint numFramesToRead,
            out uint flags,
            out ulong devicePosition,
            out ulong qpcPosition);

        [UnmanagedFunctionPointer(CallingConvention.StdCall)]
        private delegate int ReleaseBufferDelegate(IntPtr @this, uint numFramesRead);

        [UnmanagedFunctionPointer(CallingConvention.StdCall)]
        private delegate int GetNextPacketSizeDelegate(IntPtr @this, out uint numFramesInNextPacket);

        [UnmanagedFunctionPointer(CallingConvention.StdCall)]
        private delegate int GetServiceDelegate(
            IntPtr @this,
            ref Guid interfaceId,
            out IntPtr service);

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

        private sealed class WaveFormatInfo
        {
            private static readonly Guid FloatSubFormat = new Guid("00000003-0000-0010-8000-00AA00389B71");

            public int Channels;
            public int BitsPerSample;
            public int BlockAlign;
            public bool IsFloat;

            public static WaveFormatInfo Read(IntPtr pointer)
            {
                WaveFormatEx format = (WaveFormatEx)Marshal.PtrToStructure(pointer, typeof(WaveFormatEx));
                bool isFloat = format.FormatTag == WaveFormatIeeeFloat;
                if (format.FormatTag == WaveFormatExtensible && format.ExtraSize >= 22)
                {
                    Guid subFormat = (Guid)Marshal.PtrToStructure(
                        IntPtr.Add(pointer, 24),
                        typeof(Guid));
                    isFloat = subFormat == FloatSubFormat;
                }

                if (format.FormatTag != WaveFormatPcm && format.FormatTag != WaveFormatIeeeFloat &&
                    format.FormatTag != WaveFormatExtensible)
                {
                    throw new InvalidOperationException("播放设备返回了不支持的音频格式。");
                }

                return new WaveFormatInfo
                {
                    Channels = format.Channels,
                    BitsPerSample = format.BitsPerSample,
                    BlockAlign = format.BlockAlign,
                    IsFloat = isFloat
                };
            }
        }
    }
}
