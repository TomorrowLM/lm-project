using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;

namespace AudioScene.Core
{
    public sealed class EqualizerApoInstallation
    {
        internal EqualizerApoInstallation(
            bool isInstalled,
            string installDirectory,
            string configDirectory,
            string mainConfigPath,
            string ownedConfigPath,
            string backupPath)
        {
            IsInstalled = isInstalled;
            InstallDirectory = installDirectory ?? string.Empty;
            ConfigDirectory = configDirectory ?? string.Empty;
            MainConfigPath = mainConfigPath ?? string.Empty;
            OwnedConfigPath = ownedConfigPath ?? string.Empty;
            BackupPath = backupPath ?? string.Empty;
        }

        public bool IsInstalled { get; private set; }
        public string InstallDirectory { get; private set; }
        public string ConfigDirectory { get; private set; }
        public string MainConfigPath { get; private set; }
        public string OwnedConfigPath { get; private set; }
        public string BackupPath { get; private set; }

        public string IncludeLine
        {
            get { return "Include: " + OwnedConfigPath; }
        }
    }

    public static class EqualizerApoDetector
    {
        public static EqualizerApoInstallation Detect(string userConfigDirectory)
        {
            string ownedConfigPath = Path.Combine(
                GetUserConfigDirectory(userConfigDirectory),
                "apo",
                "active.txt");
            string backupPath = Path.Combine(
                GetUserConfigDirectory(userConfigDirectory),
                "apo",
                "config.txt.backup");

            foreach (string installDirectory in GetCandidateInstallDirectories(userConfigDirectory))
            {
                string configDirectory = Path.Combine(installDirectory, "config");
                string mainConfigPath = Path.Combine(configDirectory, "config.txt");
                if (Directory.Exists(configDirectory) && File.Exists(mainConfigPath))
                {
                    return new EqualizerApoInstallation(
                        true,
                        installDirectory,
                        configDirectory,
                        mainConfigPath,
                        ownedConfigPath,
                        backupPath);
                }
            }

            return new EqualizerApoInstallation(
                false,
                string.Empty,
                string.Empty,
                string.Empty,
                ownedConfigPath,
                backupPath);
        }

        private static string GetUserConfigDirectory(string userConfigDirectory)
        {
            if (!string.IsNullOrWhiteSpace(userConfigDirectory))
            {
                return Path.GetFullPath(userConfigDirectory);
            }

            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                ".lm-exe",
                "audio-scene",
                "config");
        }

        private static IList<string> GetCandidateInstallDirectories(string userConfigDirectory)
        {
            List<string> candidates = new List<string>();
            string configuredPath = Path.Combine(GetUserConfigDirectory(userConfigDirectory), "apo-install-path.txt");
            if (File.Exists(configuredPath))
            {
                string configuredInstallDirectory = File.ReadAllText(configuredPath).Trim();
                AddCandidate(candidates, configuredInstallDirectory);
            }

            string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            AddCandidate(candidates, Path.Combine(programFiles, "EqualizerAPO"));
            AddCandidate(candidates, Path.Combine(programFilesX86, "EqualizerAPO"));

            string environmentPath = Environment.GetEnvironmentVariable("LM_AUDIO_SCENE_APO_PATH");
            AddCandidate(candidates, environmentPath);

            // Support a shallow custom layout such as D:\software\windows\equalizerAPO
            // without recursively scanning disks or adding a background watcher.
            try
            {
                foreach (DriveInfo drive in DriveInfo.GetDrives())
                {
                    if (!drive.IsReady)
                    {
                        continue;
                    }

                    AddCandidate(candidates, Path.Combine(drive.RootDirectory.FullName, "software", "windows", "equalizerAPO"));
                }
            }
            catch
            {
                // A failed optional custom-path probe must not prevent standard detection.
            }

            return candidates;
        }

        private static void AddCandidate(IList<string> candidates, string path)
        {
            if (!string.IsNullOrWhiteSpace(path) && !candidates.Contains(path))
            {
                candidates.Add(path);
            }
        }
    }

    public sealed class AudioSceneApoApplyResult
    {
        private AudioSceneApoApplyResult(bool applied, string message)
        {
            Applied = applied;
            Message = message ?? string.Empty;
        }

        public bool Applied { get; private set; }
        public string Message { get; private set; }

        public static AudioSceneApoApplyResult Written(string message)
        {
            return new AudioSceneApoApplyResult(true, message);
        }

        public static AudioSceneApoApplyResult Skipped(string message)
        {
            return new AudioSceneApoApplyResult(false, message);
        }
    }

    public sealed class EqualizerApoAdapter
    {
        private readonly EqualizerApoInstallation installation;

        public EqualizerApoAdapter(string userConfigDirectory)
        {
            installation = EqualizerApoDetector.Detect(userConfigDirectory);
        }

        public EqualizerApoInstallation Installation
        {
            get { return installation; }
        }

        public string StatusMessage
        {
            get
            {
                if (!installation.IsInstalled)
                {
                    return "未检测到 Equalizer APO；高级音效暂不可用。工具仍可管理场景和设备音量。";
                }

                return "已检测到 Equalizer APO；首次应用时会自动添加 Include，并备份原配置。";
            }
        }

        public AudioSceneApoApplyResult Apply(AudioSceneProfile profile)
        {
            if (profile == null)
            {
                return AudioSceneApoApplyResult.Skipped("没有可写入的音效场景。");
            }

            if (!installation.IsInstalled)
            {
                return AudioSceneApoApplyResult.Skipped(
                    "未检测到 Equalizer APO，未写入高级音效配置；设备音量仍可应用。");
            }

            string directory = Path.GetDirectoryName(installation.OwnedConfigPath);
            string temporaryPath = installation.OwnedConfigPath + ".tmp";
            try
            {
                Directory.CreateDirectory(directory);
                File.WriteAllText(
                    temporaryPath,
                    AudioSceneApoRenderer.Render(profile),
                    new UTF8Encoding(false));

                if (File.Exists(installation.OwnedConfigPath))
                {
                    File.Replace(temporaryPath, installation.OwnedConfigPath, null);
                }
                else
                {
                    File.Move(temporaryPath, installation.OwnedConfigPath);
                }

                bool includeAdded = EnsureIncludeLine();
                return AudioSceneApoApplyResult.Written(
                    includeAdded
                        ? "高级音效已应用，并已自动接入 APO。原配置已备份。"
                        : "高级音效已应用，APO 接入配置已存在。");
            }
            catch (Exception ex)
            {
                if (File.Exists(temporaryPath))
                {
                    File.Delete(temporaryPath);
                }

                return AudioSceneApoApplyResult.Skipped("写入高级音效配置失败：" + ex.Message);
            }
        }

        private bool EnsureIncludeLine()
        {
            string current = File.ReadAllText(installation.MainConfigPath, Encoding.UTF8);
            if (current.IndexOf(installation.IncludeLine, StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return false;
            }

            if (!File.Exists(installation.BackupPath))
            {
                File.Copy(installation.MainConfigPath, installation.BackupPath, false);
            }

            string newline = current.IndexOf("\r\n", StringComparison.Ordinal) >= 0 ? "\r\n" : "\n";
            string updated = current;
            if (updated.Length > 0 && !updated.EndsWith("\r\n", StringComparison.Ordinal) &&
                !updated.EndsWith("\n", StringComparison.Ordinal))
            {
                updated += newline;
            }

            updated += installation.IncludeLine + newline;
            string temporaryPath = installation.MainConfigPath + ".lm-audio-scene.tmp";
            try
            {
                File.WriteAllText(temporaryPath, updated, new UTF8Encoding(false));
                File.Replace(temporaryPath, installation.MainConfigPath, null);
                return true;
            }
            catch
            {
                if (File.Exists(temporaryPath))
                {
                    File.Delete(temporaryPath);
                }

                throw;
            }
        }
    }

    public static class AudioSceneApoRenderer
    {
        public static string Render(AudioSceneProfile profile)
        {
            if (profile == null)
            {
                throw new ArgumentNullException("profile");
            }

            AudioSceneProfile normalized = profile.Clone();
            normalized.Normalize();
            StringBuilder builder = new StringBuilder();
            builder.AppendLine("# Generated by LM AudioScene. Do not edit this file manually.");
            builder.AppendLine("# The scene tool owns this file and rewrites it only when Apply is clicked.");
            builder.AppendLine("Device: " + SanitizeDevicePattern(normalized.DeviceName));

            double peak = CalculatePositivePeak(normalized);
            if (peak > 0.01)
            {
                builder.AppendLine("Preamp: -" + Format(peak) + " dB");
            }

            int filterNumber = 1;
            if (Math.Abs(normalized.BassDb) > 0.01)
            {
                builder.AppendLine(
                    "Filter " + filterNumber++ + ": ON LS Fc 100 Hz Gain " +
                    Format(normalized.BassDb) + " dB Q 0.707");
            }

            if (Math.Abs(normalized.TrebleDb) > 0.01)
            {
                builder.AppendLine(
                    "Filter " + filterNumber++ + ": ON HS Fc 8000 Hz Gain " +
                    Format(normalized.TrebleDb) + " dB Q 0.707");
            }

            if (Math.Abs(normalized.VoiceClarityDb) > 0.01)
            {
                builder.AppendLine(
                    "Filter " + filterNumber++ + ": ON PK Fc 2500 Hz Gain " +
                    Format(normalized.VoiceClarityDb) + " dB Q 1.000");
            }

            if (HasGraphicEq(normalized.EqualizerBands))
            {
                builder.Append("GraphicEQ: ");
                for (int index = 0; index < AudioSceneEffectDefaults.EqualizerFrequencies.Length; index++)
                {
                    if (index > 0)
                    {
                        builder.Append("; ");
                    }

                    builder.Append(AudioSceneEffectDefaults.EqualizerFrequencies[index].ToString(CultureInfo.InvariantCulture));
                    builder.Append(" ");
                    builder.Append(Format(normalized.EqualizerBands[index]));
                }

                builder.AppendLine();
            }

            AppendSpatialMode(builder, normalized.SpatialMode);
            return builder.ToString();
        }

        private static void AppendSpatialMode(StringBuilder builder, AudioSceneSpatialMode spatialMode)
        {
            if (spatialMode == AudioSceneSpatialMode.StereoWide)
            {
                builder.AppendLine("If: outputChannelCount == 2");
                builder.AppendLine("Copy: L=L+-0.125*R R=R+-0.125*L");
                builder.AppendLine("EndIf:");
            }
            else if (spatialMode == AudioSceneSpatialMode.StereoCinema)
            {
                builder.AppendLine("If: outputChannelCount == 2");
                builder.AppendLine("Copy: L=L+-0.250*R R=R+-0.250*L");
                builder.AppendLine("EndIf:");
            }
        }

        private static double CalculatePositivePeak(AudioSceneProfile profile)
        {
            double peak = Math.Max(0.0, Math.Max(profile.BassDb, profile.TrebleDb));
            peak = Math.Max(peak, Math.Max(0.0, profile.VoiceClarityDb));
            for (int index = 0; index < profile.EqualizerBands.Length; index++)
            {
                peak = Math.Max(peak, Math.Max(0.0, profile.EqualizerBands[index]));
            }

            if (profile.SpatialMode == AudioSceneSpatialMode.StereoWide)
            {
                peak = Math.Max(peak, 1.0);
            }
            else if (profile.SpatialMode == AudioSceneSpatialMode.StereoCinema)
            {
                peak = Math.Max(peak, 2.0);
            }

            return peak;
        }

        private static bool HasGraphicEq(IList<double> bands)
        {
            if (bands == null)
            {
                return false;
            }

            for (int index = 0; index < bands.Count; index++)
            {
                if (Math.Abs(bands[index]) > 0.01)
                {
                    return true;
                }
            }

            return false;
        }

        private static string SanitizeDevicePattern(string deviceName)
        {
            if (string.IsNullOrWhiteSpace(deviceName))
            {
                return "all";
            }

            return deviceName
                .Replace("\r", " ")
                .Replace("\n", " ")
                .Replace(";", " ")
                .Trim();
        }

        private static string Format(double value)
        {
            return value.ToString("0.00", CultureInfo.InvariantCulture);
        }
    }
}
