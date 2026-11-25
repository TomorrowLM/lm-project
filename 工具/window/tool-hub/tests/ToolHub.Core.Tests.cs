using System;
using System.Collections;
using System.IO;
using System.Linq;
using System.Reflection;

internal static class ToolHubCoreTests
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
        if (!File.Exists(assemblyPath))
        {
            Assert(false, "ToolHub core library is built");
            return failures;
        }

        Assembly assembly = Assembly.LoadFrom(assemblyPath);
        Type catalogType = assembly.GetType("ToolHub.Core.ToolHubCatalog");
        Type toolType = assembly.GetType("ToolHub.Core.ToolHubTool");
        Type resolverType = assembly.GetType("ToolHub.Core.ToolHubPathResolver");
        Type launcherType = assembly.GetType("ToolHub.Core.ToolHubLauncher");
        Type layoutType = assembly.GetType("ToolHub.Core.ToolHubLayout");
        Type rateCalculatorType = assembly.GetType("ToolHub.Core.NetworkTrafficRateCalculator");

        Assert(catalogType != null, "catalog type exists");
        Assert(toolType != null, "tool type exists");
        Assert(resolverType != null, "path resolver exists");
        Assert(launcherType != null, "launcher exists");
        Assert(layoutType != null, "tool hub layout adapts to the number of tools");
        Assert(rateCalculatorType != null, "network traffic rate calculator exists");

        Type speedDisplayPolicyType = assembly.GetType("ToolHub.Core.NetworkSpeedDisplayPolicy");
        Assert(speedDisplayPolicyType != null, "network speed display policy exists");
        if (speedDisplayPolicyType != null)
        {
            MethodInfo shouldShowNetworkSpeed = speedDisplayPolicyType.GetMethod("ShouldShow", BindingFlags.Public | BindingFlags.Static);
            Assert(shouldShowNetworkSpeed != null, "network speed visibility can be decided from search state");
            if (shouldShowNetworkSpeed != null)
            {
                Assert((bool)shouldShowNetworkSpeed.Invoke(null, new object[] { true, false, false }),
                    "network speed is visible when the expanded search is idle");
                Assert(!(bool)shouldShowNetworkSpeed.Invoke(null, new object[] { false, false, false }),
                    "network speed is hidden while the hub is collapsed");
                Assert(!(bool)shouldShowNetworkSpeed.Invoke(null, new object[] { true, true, false }),
                    "network speed is hidden while the search field is focused");
                Assert(!(bool)shouldShowNetworkSpeed.Invoke(null, new object[] { true, false, true }),
                    "network speed is hidden while the search query has text");
            }
        }

        if (rateCalculatorType != null)
        {
            MethodInfo calculateRates = rateCalculatorType.GetMethod("TryCalculate", BindingFlags.Public | BindingFlags.Static);
            Assert(calculateRates != null, "network traffic rates can be calculated from byte counter deltas");
            if (calculateRates != null)
            {
                object[] validSample =
                {
                    (ulong)1000,
                    (ulong)3000,
                    (ulong)3500,
                    (ulong)4000,
                    TimeSpan.FromSeconds(2),
                    0d,
                    0d
                };
                bool hasRate = (bool)calculateRates.Invoke(null, validSample);
                Assert(hasRate, "network rate is available for increasing counters and a positive interval");
                Assert(Math.Abs((double)validSample[5] - 1250d) < 0.001d,
                    "download rate is calculated from received-byte deltas");
                Assert(Math.Abs((double)validSample[6] - 500d) < 0.001d,
                    "upload rate is calculated from sent-byte deltas");

                object[] resetSample =
                {
                    (ulong)3500,
                    (ulong)4000,
                    (ulong)100,
                    (ulong)5000,
                    TimeSpan.FromSeconds(1),
                    0d,
                    0d
                };
                Assert(!(bool)calculateRates.Invoke(null, resetSample),
                    "counter reset is reported as an unavailable rate instead of a negative speed");

                object[] zeroInterval =
                {
                    (ulong)10,
                    (ulong)20,
                    (ulong)30,
                    (ulong)40,
                    TimeSpan.Zero,
                    0d,
                    0d
                };
                Assert(!(bool)calculateRates.Invoke(null, zeroInterval),
                    "zero-length sample intervals are reported as unavailable");
            }

            MethodInfo formatRate = rateCalculatorType.GetMethod("FormatBytesPerSecond", BindingFlags.Public | BindingFlags.Static);
            Assert(formatRate != null, "network rate values have a compact display formatter");
            if (formatRate != null)
            {
                Assert((string)formatRate.Invoke(null, new object[] { 1024d }) == "1.0 KB/s",
                    "network rate formatter uses kilobytes per second");
                Assert((string)formatRate.Invoke(null, new object[] { 1024d * 1024d }) == "1.0 MB/s",
                    "network rate formatter uses megabytes per second");
            }
        }

        if (resolverType != null)
        {
            string applicationDirectory = Path.GetDirectoryName(Path.GetFullPath(assemblyPath));
            string resolvedRoot = (string)resolverType.GetMethod("FindWindowRoot").Invoke(null, new object[] { applicationDirectory });
            Assert(Directory.Exists(Path.Combine(resolvedRoot, "workspace-switcher")),
                "path resolver finds the existing window tools directory");

            if (catalogType != null && toolType != null)
            {
                IList actualTools = (IList)catalogType.GetMethod("GetTools").Invoke(null, new object[] { resolvedRoot });
                object actualWorkspace = actualTools[0];
                bool workspaceAvailable = (bool)toolType.GetProperty("IsAvailable").GetValue(actualWorkspace, null);
                string actualWorkspacePath = (string)toolType.GetProperty("EntryPath").GetValue(actualWorkspace, null);
                Assert(workspaceAvailable, "workspace tool resolves to an available executable");
                Assert(actualWorkspacePath.IndexOf("WorkspaceSwitcher.exe", StringComparison.OrdinalIgnoreCase) >= 0,
                    "workspace tool resolves an executable from an available build directory");
            }

            string configuredWindowRoot = Path.Combine(Path.GetTempPath(), "tool-hub-config-window");
            string configuredAppDirectory = Path.Combine(Path.GetTempPath(), "tool-hub-config-app", "app");
            Directory.CreateDirectory(Path.Combine(configuredWindowRoot, "workspace-switcher"));
            Directory.CreateDirectory(Path.Combine(configuredWindowRoot, "Wallpaper-GUI"));
            Directory.CreateDirectory(Path.Combine(configuredWindowRoot, "desktop-black-screen-repair"));
            Directory.CreateDirectory(Path.Combine(configuredAppDirectory, "..", "config"));
            File.WriteAllText(
                Path.Combine(configuredAppDirectory, "..", "config", "window-root.txt"),
                configuredWindowRoot);
            string configuredResolvedRoot = (string)resolverType.GetMethod("FindWindowRoot").Invoke(
                null, new object[] { configuredAppDirectory });
            Assert(string.Equals(
                    Path.GetFullPath(configuredResolvedRoot).TrimEnd(Path.DirectorySeparatorChar),
                    Path.GetFullPath(configuredWindowRoot).TrimEnd(Path.DirectorySeparatorChar),
                    StringComparison.OrdinalIgnoreCase),
                "path resolver prefers the deployed window-root configuration");
        }

        if (catalogType != null && toolType != null)
        {
            string fakeWindowRoot = Path.Combine(Path.GetTempPath(), "tool-hub-window");
            object tools = catalogType.GetMethod("GetTools").Invoke(null, new object[] { fakeWindowRoot });
            IList toolList = (IList)tools;
            Assert(toolList.Count == 6, "catalog contains five window tools and the DSH service entry");

            string[] expectedIds = { "workspace", "wallpaper", "desktop-repair", "system-diagnostics", "audio-scene", "dsh" };
            for (int i = 0; i < expectedIds.Length && i < toolList.Count; i++)
            {
                object tool = toolList[i];
                string id = (string)toolType.GetProperty("Id").GetValue(tool, null);
                string entryPath = (string)toolType.GetProperty("EntryPath").GetValue(tool, null);
                Assert(id == expectedIds[i], "catalog order keeps " + expectedIds[i]);
                Assert(entryPath.IndexOf(fakeWindowRoot, StringComparison.OrdinalIgnoreCase) == 0,
                    id + " entry is rooted under the discovered window directory");
            }

            string deployedRoot = Path.Combine(Path.GetTempPath(), "tool-hub-deployed-root");
            string deployedWorkspaceApp = Path.Combine(deployedRoot, "workspace-switcher", "app");
            string deployedWallpaperApp = Path.Combine(deployedRoot, "Wallpaper-GUI", "app");
            string deployedRepairApp = Path.Combine(deployedRoot, "desktop-black-screen-repair", "app");
            string deployedDiagnosticsApp = Path.Combine(deployedRoot, "system-stability-diagnostics", "app");
            string deployedAudioSceneApp = Path.Combine(deployedRoot, "audio-scene", "app");
            Directory.CreateDirectory(deployedWorkspaceApp);
            Directory.CreateDirectory(deployedWallpaperApp);
            Directory.CreateDirectory(deployedRepairApp);
            Directory.CreateDirectory(deployedDiagnosticsApp);
            Directory.CreateDirectory(deployedAudioSceneApp);
            File.WriteAllBytes(Path.Combine(deployedWorkspaceApp, "WorkspaceSwitcher.exe"), new byte[] { 1 });
            File.WriteAllText(Path.Combine(deployedWallpaperApp, "Wallpaper-GUI.cmd"), "@echo off");
            File.WriteAllText(Path.Combine(deployedRepairApp, "Repair-DesktopBlackScreen.cmd"), "@echo off");
            File.WriteAllBytes(Path.Combine(deployedDiagnosticsApp, "SystemStabilityDiagnostics.exe"), new byte[] { 1 });
            File.WriteAllBytes(Path.Combine(deployedAudioSceneApp, "AudioScene.exe"), new byte[] { 1 });

            IList deployedTools = (IList)catalogType.GetMethod("GetTools").Invoke(null, new object[] { deployedRoot });
            Assert(((string)toolType.GetProperty("EntryPath").GetValue(deployedTools[0], null))
                    .Equals(Path.Combine(deployedWorkspaceApp, "WorkspaceSwitcher.exe"), StringComparison.OrdinalIgnoreCase),
                "workspace tool prefers the deployed app directory");
            Assert(((string)toolType.GetProperty("EntryPath").GetValue(deployedTools[1], null))
                    .Equals(Path.Combine(deployedWallpaperApp, "Wallpaper-GUI.cmd"), StringComparison.OrdinalIgnoreCase),
                "wallpaper tool prefers the deployed app directory");
            Assert(((string)toolType.GetProperty("EntryPath").GetValue(deployedTools[2], null))
                    .Equals(Path.Combine(deployedRepairApp, "Repair-DesktopBlackScreen.cmd"), StringComparison.OrdinalIgnoreCase),
                "desktop repair tool prefers the deployed app directory");
            if (deployedTools.Count > 3)
            {
                Assert(((string)toolType.GetProperty("EntryPath").GetValue(deployedTools[3], null))
                        .Equals(Path.Combine(deployedDiagnosticsApp, "SystemStabilityDiagnostics.exe"), StringComparison.OrdinalIgnoreCase),
                    "system diagnostics tool prefers the deployed app directory");
                Assert((bool)toolType.GetProperty("IsAvailable").GetValue(deployedTools[3], null),
                    "system diagnostics tool is enabled when its deployed executable exists");

                if (launcherType != null)
                {
                    object diagnosticsRequest = launcherType.GetMethod("CreateRequest").Invoke(null,
                        new object[] { deployedTools[3], "cmd.exe" });
                    string diagnosticsFileName = (string)diagnosticsRequest.GetType().GetProperty("FileName")
                        .GetValue(diagnosticsRequest, null);
                    Assert(diagnosticsFileName.Equals(Path.Combine(deployedDiagnosticsApp, "SystemStabilityDiagnostics.exe"),
                            StringComparison.OrdinalIgnoreCase),
                        "system diagnostics executable launches directly as an independent app");
                }
            }
            else
            {
                Assert(false, "system diagnostics tool is included in the deployed catalog");
            }

            if (deployedTools.Count > 4)
            {
                Assert(((string)toolType.GetProperty("EntryPath").GetValue(deployedTools[4], null))
                        .Equals(Path.Combine(deployedAudioSceneApp, "AudioScene.exe"), StringComparison.OrdinalIgnoreCase),
                    "audio scene tool prefers the deployed app directory");
                Assert((bool)toolType.GetProperty("IsAvailable").GetValue(deployedTools[4], null),
                    "audio scene tool is enabled when its deployed executable exists");
            }
            else
            {
                Assert(false, "audio scene tool is included in the deployed catalog");
            }

            if (layoutType != null)
            {
                object threeToolLayout = Activator.CreateInstance(layoutType, new object[] { 3 });
                object fourToolLayout = Activator.CreateInstance(layoutType, new object[] { 4 });
                Assert((int)layoutType.GetProperty("MainPanelHeight").GetValue(threeToolLayout, null) == 356,
                    "three-tool panel preserves its established height");
                Assert((int)layoutType.GetProperty("SearchTop").GetValue(threeToolLayout, null) == 382,
                    "three-tool search placement remains unchanged");
                Assert((int)layoutType.GetProperty("MainPanelHeight").GetValue(fourToolLayout, null) > 356,
                    "four-tool panel grows to fit the added row");
                Assert((int)layoutType.GetProperty("SearchTop").GetValue(fourToolLayout, null) > 382,
                    "four-tool search surface stays below the tool rows");
                Assert((int)layoutType.GetProperty("HubHeight").GetValue(fourToolLayout, null) == 602,
                    "expanded fourth row retains the established bottom action geometry");
            }

            var filterMethod = catalogType.GetMethod("Filter");
            IList filtered = (IList)filterMethod.Invoke(null, new object[] { tools, "壁纸" });
            Assert(filtered.Count == 1, "search filters by display text");

            object workspace = toolList[0];
            string workspaceArguments = (string)toolType.GetProperty("Arguments").GetValue(workspace, null);
            Assert(workspaceArguments == "--show", "workspace entry keeps its standalone show argument");

            if (launcherType != null)
            {
                object wallpaper = toolList[1];
                object request = launcherType.GetMethod("CreateRequest").Invoke(null, new object[] { wallpaper, "cmd.exe" });
                Type requestType = request.GetType();
                string launchFileName = (string)requestType.GetProperty("FileName").GetValue(request, null);
                string launchArguments = (string)requestType.GetProperty("Arguments").GetValue(request, null);
                Assert(launchFileName == "cmd.exe", "command-file tools use the Windows command shell");
                Assert(launchArguments.IndexOf("/c call", StringComparison.OrdinalIgnoreCase) >= 0,
                    "command-file tools are invoked through call");
            }
        }

        Console.WriteLine(failures == 0 ? "PASS ToolHub.Core.Tests" : "FAILED ToolHub.Core.Tests: " + failures);
        return failures;
    }
}
