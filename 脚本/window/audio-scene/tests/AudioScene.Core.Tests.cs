using System;
using System.Collections;
using System.IO;
using System.Reflection;

internal static class AudioSceneCoreTests
{
    private static int failures;

    private static void Assert(bool condition, string message)
    {
        if (condition)
        {
            return;
        }

        failures++;
        Console.WriteLine("FAIL " + message);
    }

    public static int Main(string[] args)
    {
        string assemblyPath = args.Length > 0 ? args[0] : string.Empty;
        Assert(File.Exists(assemblyPath), "AudioScene.Core.dll is built");
        if (!File.Exists(assemblyPath))
        {
            Console.WriteLine("FAILED AudioScene.Core.Tests: " + failures);
            return failures;
        }

        Assembly assembly = Assembly.LoadFrom(assemblyPath);
        Type profileType = assembly.GetType("AudioScene.Core.AudioSceneProfile");
        Type storeType = assembly.GetType("AudioScene.Core.AudioSceneStore");
        Type spatialModeType = assembly.GetType("AudioScene.Core.AudioSceneSpatialMode");
        Type rendererType = assembly.GetType("AudioScene.Core.AudioSceneApoRenderer");
        Type detectorType = assembly.GetType("AudioScene.Core.EqualizerApoDetector");
        Type adapterType = assembly.GetType("AudioScene.Core.EqualizerApoAdapter");
        Type deviceType = assembly.GetType("AudioScene.Core.AudioDeviceInfo");
        Type levelSampleType = assembly.GetType("AudioScene.Core.AudioLevelSample");
        Type levelMathType = assembly.GetType("AudioScene.Core.AudioLevelMath");
        Assert(profileType != null, "audio scene profile type exists");
        Assert(storeType != null, "audio scene store type exists");
        Assert(spatialModeType != null, "audio scene spatial mode exists");
        Assert(rendererType != null, "audio scene APO renderer exists");
        Assert(detectorType != null, "audio scene APO detector exists");
        Assert(adapterType != null, "audio scene APO adapter exists");
        Assert(deviceType != null, "audio device info type exists");
        Assert(levelSampleType != null, "audio level sample type exists");
        Assert(levelMathType != null, "audio level math type exists");

        if (levelSampleType != null && levelMathType != null)
        {
            object measured = levelMathType.GetMethod(
                "MeasureInterleaved",
                new Type[] { typeof(float[]), typeof(int) }).Invoke(
                null,
                new object[] { new float[] { 1.0f, -1.0f, 0.5f, -0.5f }, 2 });
            double leftPeak = (double)levelSampleType.GetProperty("LeftPeak").GetValue(measured, null);
            double rightPeak = (double)levelSampleType.GetProperty("RightPeak").GetValue(measured, null);
            double leftRms = (double)levelSampleType.GetProperty("LeftRms").GetValue(measured, null);
            Assert(Math.Abs(leftPeak - 1.0) < 0.001, "audio level math measures left peak");
            Assert(Math.Abs(rightPeak - 1.0) < 0.001, "audio level math measures right peak");
            Assert(Math.Abs(leftRms - Math.Sqrt(0.625)) < 0.001, "audio level math measures left RMS");
            Assert((int)levelMathType.GetMethod(
                "ToPercent",
                new Type[] { typeof(double) }).Invoke(null, new object[] { 0.5 }) == 50,
                "audio level math converts amplitude to percent");
        }

        if (profileType != null)
        {
            object profile = Activator.CreateInstance(profileType);
            profileType.GetProperty("Name").SetValue(profile, "音乐-蓝牙", null);
            profileType.GetProperty("VolumePercent").SetValue(profile, 125, null);
            profileType.GetMethod("Normalize").Invoke(profile, null);
            Assert((int)profileType.GetProperty("VolumePercent").GetValue(profile, null) == 100,
                "profile normalization clamps volume to 100");
            Assert(profile.ToString() == "音乐-蓝牙",
                "scene list text uses the profile name");

            profileType.GetProperty("VolumePercent").SetValue(profile, -20, null);
            profileType.GetMethod("Normalize").Invoke(profile, null);
            Assert((int)profileType.GetProperty("VolumePercent").GetValue(profile, null) == 0,
                "profile normalization clamps volume to zero");

            Assert(profileType.GetProperty("BassDb") != null, "profile stores bass gain");
            Assert(profileType.GetProperty("TrebleDb") != null, "profile stores treble gain");
            Assert(profileType.GetProperty("VoiceClarityDb") != null, "profile stores voice clarity gain");
            Assert(profileType.GetProperty("EqualizerBands") != null, "profile stores graphic EQ bands");
            Assert(profileType.GetProperty("SpatialMode") != null, "profile stores spatial mode");

            profileType.GetProperty("BassDb").SetValue(profile, 30.0, null);
            profileType.GetProperty("TrebleDb").SetValue(profile, -30.0, null);
            profileType.GetProperty("VoiceClarityDb").SetValue(profile, 30.0, null);
            profileType.GetMethod("Normalize").Invoke(profile, null);
            Assert(Math.Abs((double)profileType.GetProperty("BassDb").GetValue(profile, null) - 12.0) < 0.001,
                "profile normalization clamps bass gain");
            Assert(Math.Abs((double)profileType.GetProperty("TrebleDb").GetValue(profile, null) + 12.0) < 0.001,
                "profile normalization clamps treble gain");
            Assert(Math.Abs((double)profileType.GetProperty("VoiceClarityDb").GetValue(profile, null) - 6.0) < 0.001,
                "profile normalization clamps voice clarity gain");
        }

        if (profileType != null && storeType != null)
        {
            string path = Path.Combine(Path.GetTempPath(), "audio-scene-core-tests-" + Guid.NewGuid().ToString("N") + ".xml");
            try
            {
                object profile = Activator.CreateInstance(profileType);
                profileType.GetProperty("Id").SetValue(profile, "music-bluetooth", null);
                profileType.GetProperty("Name").SetValue(profile, "音乐-蓝牙", null);
                profileType.GetProperty("DeviceId").SetValue(profile, "device-1", null);
                profileType.GetProperty("DeviceName").SetValue(profile, "Bluetooth Headset", null);
                profileType.GetProperty("VolumePercent").SetValue(profile, 72, null);
                profileType.GetProperty("Muted").SetValue(profile, false, null);
                profileType.GetProperty("BassDb").SetValue(profile, 3.0, null);
                profileType.GetProperty("TrebleDb").SetValue(profile, 2.0, null);
                profileType.GetProperty("VoiceClarityDb").SetValue(profile, 4.0, null);
                profileType.GetProperty("SpatialMode").SetValue(
                    profile,
                    Enum.Parse(spatialModeType, "StereoWide"),
                    null);
                IList bands = (IList)profileType.GetProperty("EqualizerBands").GetValue(profile, null);
                bands[0] = 2.5;
                bands[9] = -1.5;

                IList profiles = (IList)Activator.CreateInstance(typeof(ArrayList));
                profiles.Add(profile);
                object store = Activator.CreateInstance(storeType, new object[] { path });
                storeType.GetMethod("Save").Invoke(store, new object[] { profiles });
                IList restored = (IList)storeType.GetMethod("Load").Invoke(store, null);
                Assert(restored.Count == 1, "store round-trip preserves one profile");
                object restoredProfile = restored[0];
                Assert((string)profileType.GetProperty("Name").GetValue(restoredProfile, null) == "音乐-蓝牙",
                    "store round-trip preserves profile name");
                Assert((int)profileType.GetProperty("VolumePercent").GetValue(restoredProfile, null) == 72,
                    "store round-trip preserves volume");
                Assert(Math.Abs((double)profileType.GetProperty("BassDb").GetValue(restoredProfile, null) - 3.0) < 0.001,
                    "store round-trip preserves bass gain");
                Assert(profileType.GetProperty("SpatialMode").GetValue(restoredProfile, null).ToString() == "StereoWide",
                    "store round-trip preserves spatial mode");
                IList restoredBands = (IList)profileType.GetProperty("EqualizerBands").GetValue(restoredProfile, null);
                Assert(restoredBands.Count == 10, "store round-trip preserves ten EQ bands");
                Assert(Math.Abs((double)restoredBands[0] - 2.5) < 0.001,
                    "store round-trip preserves EQ band value");
            }
            finally
            {
                if (File.Exists(path))
                {
                    File.Delete(path);
                }
            }
        }

        if (profileType != null && rendererType != null && spatialModeType != null)
        {
            object profile = Activator.CreateInstance(profileType);
            profileType.GetProperty("DeviceName").SetValue(profile, "测试扬声器", null);
            profileType.GetProperty("BassDb").SetValue(profile, 3.0, null);
            profileType.GetProperty("TrebleDb").SetValue(profile, 2.0, null);
            profileType.GetProperty("VoiceClarityDb").SetValue(profile, 4.0, null);
            profileType.GetProperty("SpatialMode").SetValue(
                profile,
                Enum.Parse(spatialModeType, "StereoWide"),
                null);
            IList bands = (IList)profileType.GetProperty("EqualizerBands").GetValue(profile, null);
            bands[0] = 2.0;
            bands[9] = -1.0;

            string config = (string)rendererType.GetMethod("Render").Invoke(null, new object[] { profile });
            Assert(config.IndexOf("Device: 测试扬声器", StringComparison.Ordinal) >= 0,
                "APO config targets the selected device");
            Assert(config.IndexOf("Filter 1: ON LS", StringComparison.Ordinal) >= 0,
                "APO config contains a bass shelf");
            Assert(config.IndexOf("Filter 2: ON HS", StringComparison.Ordinal) >= 0,
                "APO config contains a treble shelf");
            Assert(config.IndexOf("Filter 3: ON PK", StringComparison.Ordinal) >= 0,
                "APO config contains a voice clarity filter");
            Assert(config.IndexOf("GraphicEQ:", StringComparison.Ordinal) >= 0,
                "APO config contains graphic EQ bands");
            Assert(config.IndexOf("Copy: L=L+", StringComparison.Ordinal) >= 0,
                "APO config contains safe stereo widening");
            Assert(config.IndexOf("Preamp: -", StringComparison.Ordinal) >= 0,
                "APO config attenuates positive gains to reduce clipping risk");
        }

        if (profileType != null && catalogTypeExists(assembly))
        {
            Type catalogType = assembly.GetType("AudioScene.Core.AudioScenePresetCatalog");
            Type presetType = assembly.GetType("AudioScene.Core.AudioScenePreset");
            IList presets = (IList)catalogType.GetMethod("GetPresets").Invoke(null, null);
            bool hasRealEffects = false;
            bool moviePresetsDiffer = false;
            object cinema = null;
            object voice = null;
            foreach (object preset in presets)
            {
                double bass = (double)presetType.GetProperty("BassDb").GetValue(preset, null);
                double treble = (double)presetType.GetProperty("TrebleDb").GetValue(preset, null);
                double clarity = (double)presetType.GetProperty("VoiceClarityDb").GetValue(preset, null);
                hasRealEffects |= Math.Abs(bass) > 0.001 || Math.Abs(treble) > 0.001 || Math.Abs(clarity) > 0.001;
                string id = (string)presetType.GetProperty("Id").GetValue(preset, null);
                if (id == "movie-cinema") cinema = preset;
                if (id == "movie-voice") voice = preset;
            }

            if (cinema != null && voice != null)
            {
                moviePresetsDiffer =
                    (double)presetType.GetProperty("VoiceClarityDb").GetValue(cinema, null) !=
                    (double)presetType.GetProperty("VoiceClarityDb").GetValue(voice, null);
            }

            Assert(hasRealEffects, "presets contain real audio effect values");
            Assert(moviePresetsDiffer, "movie presets have different audio effect values");
            bool hasAiVoicePreset = false;
            foreach (object preset in presets)
            {
                string id = (string)presetType.GetProperty("Id").GetValue(preset, null);
                hasAiVoicePreset |= id == "voice-ai";
            }
            Assert(hasAiVoicePreset, "catalog contains an AI voice preset");
        }

        if (deviceType != null)
        {
            object device = Activator.CreateInstance(
                deviceType,
                new object[] { "device-1", "测试扬声器", true, 48000, 2 });
            Assert((int)deviceType.GetProperty("SampleRateHz").GetValue(device, null) == 48000,
                "audio device preserves the output sample rate");
            Assert((int)deviceType.GetProperty("ChannelCount").GetValue(device, null) == 2,
                "audio device preserves the channel count");
            Assert(((string)deviceType.GetProperty("FormatDescription").GetValue(device, null))
                    .IndexOf("48000 Hz", StringComparison.Ordinal) >= 0,
                "audio device exposes a readable sample rate description");
        }

        if (detectorType != null)
        {
            string root = Path.Combine(Path.GetTempPath(), "audio-scene-apo-detect-" + Guid.NewGuid().ToString("N"));
            try
            {
                object installation = detectorType.GetMethod("Detect").Invoke(null, new object[] { root });
                Assert(installation != null, "APO detector returns an installation status");
                Assert(!Directory.Exists(root), "APO detection does not create configuration directories");
            }
            finally
            {
                if (Directory.Exists(root))
                {
                    Directory.Delete(root, true);
                }
            }
        }

        if (profileType != null && adapterType != null)
        {
            string root = Path.Combine(Path.GetTempPath(), "audio-scene-apo-adapter-" + Guid.NewGuid().ToString("N"));
            string fakeInstall = Path.Combine(root, "fake-equalizer-apo");
            string fakeConfig = Path.Combine(fakeInstall, "config");
            try
            {
                Directory.CreateDirectory(fakeConfig);
                File.WriteAllText(Path.Combine(fakeConfig, "config.txt"), "Preamp: 0 dB\r\n");
                File.WriteAllText(Path.Combine(root, "apo-install-path.txt"), fakeInstall);

                object profile = Activator.CreateInstance(profileType);
                profileType.GetProperty("DeviceName").SetValue(profile, "测试扬声器", null);
                profileType.GetProperty("BassDb").SetValue(profile, 2.0, null);
                object adapter = Activator.CreateInstance(adapterType, new object[] { root });
                object installation = adapter.GetType().GetProperty("Installation").GetValue(adapter, null);
                object applyResult = adapterType.GetMethod("Apply").Invoke(adapter, new object[] { profile });
                bool applied = (bool)applyResult.GetType().GetProperty("Applied").GetValue(applyResult, null);
                string ownedPath = (string)installation.GetType().GetProperty("OwnedConfigPath").GetValue(installation, null);
                string mainConfigPath = (string)installation.GetType().GetProperty("MainConfigPath").GetValue(installation, null);
                string backupPath = (string)installation.GetType().GetProperty("BackupPath").GetValue(installation, null);
                string includeLine = (string)installation.GetType().GetProperty("IncludeLine").GetValue(installation, null);
                Assert(applied, "APO adapter writes an owned configuration");
                Assert(File.Exists(ownedPath), "APO adapter writes under the user configuration directory");
                Assert(File.ReadAllText(ownedPath).IndexOf("Filter 1: ON LS", StringComparison.Ordinal) >= 0,
                    "owned APO configuration contains the selected effect");
                string mainConfig = File.ReadAllText(mainConfigPath);
                Assert(mainConfig.IndexOf(includeLine, StringComparison.OrdinalIgnoreCase) >= 0,
                    "APO adapter automatically adds its include line");
                Assert(File.Exists(backupPath), "APO adapter creates a user-owned backup before changing APO config");
                Assert(File.ReadAllText(backupPath).IndexOf("Preamp: 0 dB", StringComparison.Ordinal) >= 0,
                    "APO backup preserves the original main config");

                object secondResult = adapterType.GetMethod("Apply").Invoke(adapter, new object[] { profile });
                bool secondApplied = (bool)secondResult.GetType().GetProperty("Applied").GetValue(secondResult, null);
                int includeCount = mainConfig.Split(new string[] { includeLine }, StringSplitOptions.None).Length - 1;
                int updatedIncludeCount = File.ReadAllText(mainConfigPath)
                    .Split(new string[] { includeLine }, StringSplitOptions.None).Length - 1;
                Assert(secondApplied, "APO adapter can apply a second scene update");
                Assert(includeCount == 1 && updatedIncludeCount == 1,
                    "APO adapter does not duplicate its include line");
            }
            finally
            {
                if (Directory.Exists(root))
                {
                    Directory.Delete(root, true);
                }
            }
        }

        Console.WriteLine(failures == 0 ? "PASS AudioScene.Core.Tests" : "FAILED AudioScene.Core.Tests: " + failures);
        return failures;
    }

    private static bool catalogTypeExists(Assembly assembly)
    {
        return assembly.GetType("AudioScene.Core.AudioScenePresetCatalog") != null &&
            assembly.GetType("AudioScene.Core.AudioScenePreset") != null;
    }
}
