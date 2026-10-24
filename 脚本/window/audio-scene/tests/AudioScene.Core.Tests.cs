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
        Assert(profileType != null, "audio scene profile type exists");
        Assert(storeType != null, "audio scene store type exists");

        if (profileType != null)
        {
            object profile = Activator.CreateInstance(profileType);
            profileType.GetProperty("Name").SetValue(profile, "音乐-蓝牙", null);
            profileType.GetProperty("VolumePercent").SetValue(profile, 125, null);
            profileType.GetMethod("Normalize").Invoke(profile, null);
            Assert((int)profileType.GetProperty("VolumePercent").GetValue(profile, null) == 100,
                "profile normalization clamps volume to 100");

            profileType.GetProperty("VolumePercent").SetValue(profile, -20, null);
            profileType.GetMethod("Normalize").Invoke(profile, null);
            Assert((int)profileType.GetProperty("VolumePercent").GetValue(profile, null) == 0,
                "profile normalization clamps volume to zero");
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
            }
            finally
            {
                if (File.Exists(path))
                {
                    File.Delete(path);
                }
            }
        }

        Console.WriteLine(failures == 0 ? "PASS AudioScene.Core.Tests" : "FAILED AudioScene.Core.Tests: " + failures);
        return failures;
    }
}
