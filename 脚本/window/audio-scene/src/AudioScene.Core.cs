using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Xml.Serialization;

namespace AudioScene.Core
{
    public enum AudioSceneSpatialMode
    {
        Off = 0,
        StereoWide = 1,
        StereoCinema = 2
    }

    public static class AudioSceneEffectDefaults
    {
        public static readonly int[] EqualizerFrequencies =
        {
            31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000
        };

        public static double[] CreateFlatBands()
        {
            return new double[EqualizerFrequencies.Length];
        }
    }

    public sealed class AudioSceneProfile
    {
        public AudioSceneProfile()
        {
            Id = string.Empty;
            Name = string.Empty;
            DeviceId = string.Empty;
            DeviceName = string.Empty;
            PresetId = string.Empty;
            VolumePercent = 70;
            EqualizerBands = AudioSceneEffectDefaults.CreateFlatBands();
            SpatialMode = AudioSceneSpatialMode.Off;
        }

        public string Id { get; set; }
        public string Name { get; set; }
        public string DeviceId { get; set; }
        public string DeviceName { get; set; }
        public string PresetId { get; set; }
        public int VolumePercent { get; set; }
        public bool Muted { get; set; }
        public double BassDb { get; set; }
        public double TrebleDb { get; set; }
        public double VoiceClarityDb { get; set; }
        public AudioSceneSpatialMode SpatialMode { get; set; }
        public double[] EqualizerBands { get; set; }

        public void Normalize()
        {
            Id = Id ?? string.Empty;
            Name = Name ?? string.Empty;
            DeviceId = DeviceId ?? string.Empty;
            DeviceName = DeviceName ?? string.Empty;
            PresetId = PresetId ?? string.Empty;
            VolumePercent = Math.Max(0, Math.Min(100, VolumePercent));
            BassDb = ClampGain(BassDb, -12.0, 12.0);
            TrebleDb = ClampGain(TrebleDb, -12.0, 12.0);
            VoiceClarityDb = ClampGain(VoiceClarityDb, 0.0, 6.0);
            if (!Enum.IsDefined(typeof(AudioSceneSpatialMode), SpatialMode))
            {
                SpatialMode = AudioSceneSpatialMode.Off;
            }

            double[] normalizedBands = AudioSceneEffectDefaults.CreateFlatBands();
            if (EqualizerBands != null)
            {
                int count = Math.Min(EqualizerBands.Length, normalizedBands.Length);
                for (int index = 0; index < count; index++)
                {
                    normalizedBands[index] = ClampGain(EqualizerBands[index], -12.0, 12.0);
                }
            }

            EqualizerBands = normalizedBands;
        }

        public AudioSceneProfile Clone()
        {
            return new AudioSceneProfile
            {
                Id = Id,
                Name = Name,
                DeviceId = DeviceId,
                DeviceName = DeviceName,
                PresetId = PresetId,
                VolumePercent = VolumePercent,
                Muted = Muted,
                BassDb = BassDb,
                TrebleDb = TrebleDb,
                VoiceClarityDb = VoiceClarityDb,
                SpatialMode = SpatialMode,
                EqualizerBands = EqualizerBands == null
                    ? AudioSceneEffectDefaults.CreateFlatBands()
                    : (double[])EqualizerBands.Clone()
            };
        }

        private static double ClampGain(double value, double minimum, double maximum)
        {
            if (double.IsNaN(value) || double.IsInfinity(value))
            {
                return 0.0;
            }

            return Math.Max(minimum, Math.Min(maximum, value));
        }

        public override string ToString()
        {
            return string.IsNullOrWhiteSpace(Name) ? "未命名场景" : Name;
        }
    }

    public sealed class AudioScenePreset
    {
        public AudioScenePreset()
        {
            Id = string.Empty;
            Name = string.Empty;
            Description = string.Empty;
            RecommendedVolumePercent = 70;
            EqualizerBands = AudioSceneEffectDefaults.CreateFlatBands();
            SpatialMode = AudioSceneSpatialMode.Off;
        }

        public AudioScenePreset(string id, string name, string description, int recommendedVolumePercent)
            : this(id, name, description, recommendedVolumePercent, 0.0, 0.0, 0.0,
                AudioSceneSpatialMode.Off, null)
        {
        }

        public AudioScenePreset(
            string id,
            string name,
            string description,
            int recommendedVolumePercent,
            double bassDb,
            double trebleDb,
            double voiceClarityDb,
            AudioSceneSpatialMode spatialMode,
            IList<double> equalizerBands)
        {
            Id = id ?? string.Empty;
            Name = name ?? string.Empty;
            Description = description ?? string.Empty;
            RecommendedVolumePercent = Math.Max(0, Math.Min(100, recommendedVolumePercent));
            BassDb = bassDb;
            TrebleDb = trebleDb;
            VoiceClarityDb = voiceClarityDb;
            SpatialMode = spatialMode;
            EqualizerBands = AudioSceneEffectDefaults.CreateFlatBands();
            if (equalizerBands != null)
            {
                int count = Math.Min(equalizerBands.Count, EqualizerBands.Length);
                for (int index = 0; index < count; index++)
                {
                    EqualizerBands[index] = equalizerBands[index];
                }
            }
        }

        public string Id { get; private set; }
        public string Name { get; private set; }
        public string Description { get; private set; }
        public int RecommendedVolumePercent { get; private set; }
        public double BassDb { get; private set; }
        public double TrebleDb { get; private set; }
        public double VoiceClarityDb { get; private set; }
        public AudioSceneSpatialMode SpatialMode { get; private set; }
        public double[] EqualizerBands { get; private set; }

        public override string ToString()
        {
            return Name;
        }
    }

    public static class AudioScenePresetCatalog
    {
        public static IList<AudioScenePreset> GetPresets()
        {
            return new List<AudioScenePreset>
            {
                new AudioScenePreset(
                    "music-balanced", "音乐·均衡自然", "低音有弹性，高音自然，适合日常听歌。", 65,
                    2.0, 1.0, 1.0, AudioSceneSpatialMode.Off,
                    new double[] { 2, 1, 0, 0, 0, 0, 0, 1, 2, 1 }),
                new AudioScenePreset(
                    "music-detail", "音乐·清晰细节", "收紧低频，提升细节，适合器乐和轻音乐。", 60,
                    0.5, 3.0, 1.0, AudioSceneSpatialMode.Off,
                    new double[] { 0, 0, 1, 1, 1, 1, 2, 3, 3, 2 }),
                new AudioScenePreset(
                    "movie-cinema", "电影·影院沉浸", "增强低频和声场，适合电影和视频内容。", 72,
                    4.0, 1.5, 0.0, AudioSceneSpatialMode.StereoCinema,
                    new double[] { 3, 2, 1, 0, 0, 0, 0, 1, 2, 2 }),
                new AudioScenePreset(
                    "movie-voice", "电影·人声清晰", "压低轰鸣，突出对白和人声。", 68,
                    -1.0, 2.0, 4.0, AudioSceneSpatialMode.Off,
                    new double[] { -1, -1, 0, 1, 2, 3, 4, 3, 2, 1 })
            };
        }

        public static bool ApplyTo(AudioSceneProfile profile, string presetId)
        {
            if (profile == null || string.IsNullOrWhiteSpace(presetId))
            {
                return false;
            }

            foreach (AudioScenePreset preset in GetPresets())
            {
                if (!string.Equals(preset.Id, presetId, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                profile.PresetId = preset.Id;
                profile.VolumePercent = preset.RecommendedVolumePercent;
                profile.BassDb = preset.BassDb;
                profile.TrebleDb = preset.TrebleDb;
                profile.VoiceClarityDb = preset.VoiceClarityDb;
                profile.SpatialMode = preset.SpatialMode;
                profile.EqualizerBands = (double[])preset.EqualizerBands.Clone();
                profile.Normalize();
                return true;
            }

            return false;
        }
    }

    public sealed class AudioDeviceInfo
    {
        public AudioDeviceInfo()
        {
            Id = string.Empty;
            Name = string.Empty;
        }

        public AudioDeviceInfo(string id, string name, bool isDefault)
        {
            Id = id ?? string.Empty;
            Name = name ?? string.Empty;
            IsDefault = isDefault;
        }

        public string Id { get; private set; }
        public string Name { get; private set; }
        public bool IsDefault { get; private set; }

        public override string ToString()
        {
            return IsDefault ? Name + "（当前默认）" : Name;
        }
    }

    public sealed class AudioSceneApplyResult
    {
        private AudioSceneApplyResult(bool success, string message)
        {
            Success = success;
            Message = message ?? string.Empty;
            Warnings = new List<string>();
        }

        public bool Success { get; private set; }
        public string Message { get; private set; }
        public IList<string> Warnings { get; private set; }

        public static AudioSceneApplyResult Applied(string message)
        {
            return new AudioSceneApplyResult(true, message);
        }

        public static AudioSceneApplyResult Failed(string message)
        {
            return new AudioSceneApplyResult(false, message);
        }

        public AudioSceneApplyResult AddWarning(string warning)
        {
            if (!string.IsNullOrWhiteSpace(warning))
            {
                Warnings.Add(warning);
            }

            return this;
        }
    }

    public interface IAudioSceneBackend
    {
        IList<AudioDeviceInfo> GetRenderDevices();
        AudioSceneApplyResult Apply(AudioSceneProfile profile);
    }

    public interface IAudioSceneBackendStatus
    {
        string EffectsStatus { get; }
    }

    public sealed class AudioSceneStore
    {
        private readonly string filePath;

        public AudioSceneStore(string filePath)
        {
            if (string.IsNullOrWhiteSpace(filePath))
            {
                throw new ArgumentException("场景配置路径不能为空。", "filePath");
            }

            this.filePath = Path.GetFullPath(filePath);
        }

        public string FilePath
        {
            get { return filePath; }
        }

        public IList<AudioSceneProfile> Load()
        {
            if (!File.Exists(filePath))
            {
                return new List<AudioSceneProfile>();
            }

            try
            {
                XmlSerializer serializer = new XmlSerializer(typeof(List<AudioSceneProfile>));
                using (FileStream stream = File.OpenRead(filePath))
                {
                    List<AudioSceneProfile> profiles = (List<AudioSceneProfile>)serializer.Deserialize(stream);
                    if (profiles == null)
                    {
                        return new List<AudioSceneProfile>();
                    }

                    foreach (AudioSceneProfile profile in profiles)
                    {
                        if (profile != null)
                        {
                            profile.Normalize();
                        }
                    }

                    return profiles;
                }
            }
            catch (Exception ex)
            {
                throw new AudioSceneStorageException("读取声音场景配置失败。", ex);
            }
        }

        public void Save(IEnumerable profiles)
        {
            if (profiles == null)
            {
                throw new ArgumentNullException("profiles");
            }

            List<AudioSceneProfile> normalized = new List<AudioSceneProfile>();
            foreach (object value in profiles)
            {
                AudioSceneProfile profile = value as AudioSceneProfile;
                if (profile == null)
                {
                    continue;
                }

                profile.Normalize();
                normalized.Add(profile.Clone());
            }

            string directory = Path.GetDirectoryName(filePath);
            if (!string.IsNullOrWhiteSpace(directory))
            {
                Directory.CreateDirectory(directory);
            }

            string temporaryPath = filePath + ".tmp";
            try
            {
                XmlSerializer serializer = new XmlSerializer(typeof(List<AudioSceneProfile>));
                using (FileStream stream = File.Create(temporaryPath))
                {
                    serializer.Serialize(stream, normalized);
                }

                if (File.Exists(filePath))
                {
                    File.Replace(temporaryPath, filePath, null);
                }
                else
                {
                    File.Move(temporaryPath, filePath);
                }
            }
            catch (Exception ex)
            {
                if (File.Exists(temporaryPath))
                {
                    File.Delete(temporaryPath);
                }

                throw new AudioSceneStorageException("保存声音场景配置失败。", ex);
            }
        }
    }

    public sealed class AudioSceneStorageException : Exception
    {
        public AudioSceneStorageException(string message, Exception innerException)
            : base(message, innerException)
        {
        }
    }
}
