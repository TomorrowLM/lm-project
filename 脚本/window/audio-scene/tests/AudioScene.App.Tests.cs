using System;
using System.Collections;
using System.IO;
using System.Reflection;

internal static class AudioSceneAppTests
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
        Assert(File.Exists(assemblyPath), "AudioScene.Core.dll is built for app tests");
        if (!File.Exists(assemblyPath))
        {
            Console.WriteLine("FAILED AudioScene.App.Tests: " + failures);
            return failures;
        }

        Assembly assembly = Assembly.LoadFrom(assemblyPath);
        Type profileType = assembly.GetType("AudioScene.Core.AudioSceneProfile");
        Type presetType = assembly.GetType("AudioScene.Core.AudioScenePreset");
        Type catalogType = assembly.GetType("AudioScene.Core.AudioScenePresetCatalog");
        Assert(profileType != null, "profile type exists for scene presets");
        Assert(presetType != null, "preset type exists");
        Assert(catalogType != null, "preset catalog exists");

        if (profileType != null)
        {
            Assert(profileType.GetProperty("PresetId") != null, "profile stores the selected preset id");
        }

        if (catalogType != null && presetType != null)
        {
            IList presets = (IList)catalogType.GetMethod("GetPresets").Invoke(null, null);
            Assert(presets.Count >= 4, "catalog contains music and movie presets");
            bool hasMusic = false;
            bool hasMovie = false;
            foreach (object preset in presets)
            {
                string id = (string)presetType.GetProperty("Id").GetValue(preset, null);
                hasMusic |= id == "music-balanced";
                hasMovie |= id == "movie-cinema";
            }

            Assert(hasMusic, "catalog contains the balanced music preset");
            Assert(hasMovie, "catalog contains the cinema movie preset");
        }

        Console.WriteLine(failures == 0 ? "PASS AudioScene.App.Tests" : "FAILED AudioScene.App.Tests: " + failures);
        return failures;
    }
}
