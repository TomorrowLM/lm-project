using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Xml.Serialization;

namespace AudioScene.Core
{
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
        }

        public string Id { get; set; }
        public string Name { get; set; }
        public string DeviceId { get; set; }
        public string DeviceName { get; set; }
        public string PresetId { get; set; }
        public int VolumePercent { get; set; }
        public bool Muted { get; set; }

        public void Normalize()
        {
            Id = Id ?? string.Empty;
            Name = Name ?? string.Empty;
            DeviceId = DeviceId ?? string.Empty;
            DeviceName = DeviceName ?? string.Empty;
            PresetId = PresetId ?? string.Empty;
            VolumePercent = Math.Max(0, Math.Min(100, VolumePercent));
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
                Muted = Muted
            };
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
        }

        public AudioScenePreset(string id, string name, string description, int recommendedVolumePercent)
        {
            Id = id ?? string.Empty;
            Name = name ?? string.Empty;
            Description = description ?? string.Empty;
            RecommendedVolumePercent = Math.Max(0, Math.Min(100, recommendedVolumePercent));
        }

        public string Id { get; private set; }
        public string Name { get; private set; }
        public string Description { get; private set; }
        public int RecommendedVolumePercent { get; private set; }

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
                new AudioScenePreset("music-balanced", "音乐·均衡自然", "人声清晰，音量平稳，适合日常听歌。", 65),
                new AudioScenePreset("music-detail", "音乐·清晰细节", "降低音量，减少长时间聆听的疲劳感。", 60),
                new AudioScenePreset("movie-cinema", "电影·影院沉浸", "适度提高音量，适合电影和视频内容。", 72),
                new AudioScenePreset("movie-voice", "电影·人声清晰", "保持适中音量，优先保证对白可听清。", 68)
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
