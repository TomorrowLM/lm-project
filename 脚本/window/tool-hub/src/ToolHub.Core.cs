using System;
using System.Collections.Generic;
using System.IO;

namespace ToolHub.Core
{
    public enum ToolHubLaunchKind
    {
        Executable,
        CommandFile
    }

    public sealed class ToolHubTool
    {
        public ToolHubTool(
            string id,
            string label,
            string description,
            string entryPath,
            string arguments,
            string workingDirectory,
            ToolHubLaunchKind launchKind)
        {
            Id = id;
            Label = label;
            Description = description;
            EntryPath = entryPath;
            Arguments = arguments ?? string.Empty;
            WorkingDirectory = workingDirectory;
            LaunchKind = launchKind;
            IsAvailable = File.Exists(entryPath);
        }

        public string Id { get; private set; }
        public string Label { get; private set; }
        public string Description { get; private set; }
        public string EntryPath { get; private set; }
        public string Arguments { get; private set; }
        public string WorkingDirectory { get; private set; }
        public ToolHubLaunchKind LaunchKind { get; private set; }
        public bool IsAvailable { get; private set; }
    }

    public sealed class ToolHubLaunchRequest
    {
        public ToolHubLaunchRequest(string fileName, string arguments, string workingDirectory, bool useShellExecute)
        {
            FileName = fileName;
            Arguments = arguments ?? string.Empty;
            WorkingDirectory = workingDirectory;
            UseShellExecute = useShellExecute;
        }

        public string FileName { get; private set; }
        public string Arguments { get; private set; }
        public string WorkingDirectory { get; private set; }
        public bool UseShellExecute { get; private set; }
    }

    public sealed class ToolHubLayout
    {
        private const int RowTop = 18;
        private const int RowHeight = 76;
        private const int SearchHeight = 72;

        public ToolHubLayout(int toolCount)
        {
            ToolCount = Math.Max(0, toolCount);
            MainPanelHeight = RowTop + (ToolCount + 1) * RowHeight + 34;
            SearchTop = MainPanelHeight + 26;
            HubHeight = SearchTop + SearchHeight + 72;
        }

        public int ToolCount { get; private set; }
        public int MainPanelHeight { get; private set; }
        public int SearchTop { get; private set; }
        public int HubHeight { get; private set; }
    }

    public static class ToolHubCatalog
    {
        public static IList<ToolHubTool> GetTools(string windowRoot)
        {
            string root = Path.GetFullPath(windowRoot ?? string.Empty);
            string workspaceDirectory = Path.Combine(root, "workspace-switcher");
            string wallpaperDirectory = Path.Combine(root, "Wallpaper-GUI");
            string repairDirectory = Path.Combine(root, "desktop-black-screen-repair");
            string diagnosticsDirectory = Path.Combine(root, "system-stability-diagnostics");
            string audioSceneDirectory = Path.Combine(root, "audio-scene");
            string workspaceEntry = FindWorkspaceExecutable(workspaceDirectory);
            string wallpaperEntry = FindEntryPoint(wallpaperDirectory, "Wallpaper-GUI.cmd");
            string repairEntry = FindEntryPoint(repairDirectory, "Repair-DesktopBlackScreen.cmd");
            string diagnosticsEntry = FindExecutable(diagnosticsDirectory, "SystemStabilityDiagnostics.exe");
            string audioSceneEntry = FindExecutable(audioSceneDirectory, "AudioScene.exe");

            return new List<ToolHubTool>
            {
                new ToolHubTool(
                    "workspace",
                    "工作区切换",
                    "管理应用窗口和显示器布局",
                    workspaceEntry,
                    "--show",
                    Path.GetDirectoryName(workspaceEntry),
                    ToolHubLaunchKind.Executable),
                new ToolHubTool(
                    "wallpaper",
                    "壁纸中心",
                    "按显示器管理和切换壁纸",
                    wallpaperEntry,
                    string.Empty,
                    Path.GetDirectoryName(wallpaperEntry),
                    ToolHubLaunchKind.CommandFile),
                new ToolHubTool(
                    "desktop-repair",
                    "桌面修复",
                    "诊断并修复桌面黑屏问题",
                    repairEntry,
                    string.Empty,
                    Path.GetDirectoryName(repairEntry),
                    ToolHubLaunchKind.CommandFile),
                new ToolHubTool(
                    "system-diagnostics",
                    "系统稳定性诊断",
                    "记录系统卡顿、鼠标卡顿和应用无响应时的资源状态",
                    diagnosticsEntry,
                    string.Empty,
                    Path.GetDirectoryName(diagnosticsEntry),
                    ToolHubLaunchKind.Executable),
                new ToolHubTool(
                    "audio-scene",
                    "声音场景",
                    "按设备和当前场景切换安全的音量与静音预设",
                    audioSceneEntry,
                    string.Empty,
                    Path.GetDirectoryName(audioSceneEntry),
                    ToolHubLaunchKind.Executable)
            };
        }

        private static string FindExecutable(string toolDirectory, string fileName)
        {
            string[] buildDirectories = { "app", "build", "build-test" };
            foreach (string buildDirectory in buildDirectories)
            {
                string candidate = Path.Combine(toolDirectory, buildDirectory, fileName);
                if (File.Exists(candidate))
                {
                    return candidate;
                }
            }

            return Path.Combine(toolDirectory, "app", fileName);
        }

        private static string FindWorkspaceExecutable(string workspaceDirectory)
        {
            string[] preferredBuildDirectories =
            {
                "app",
                "build",
                "build-color-glass",
                "build-v1.9.23"
            };

            foreach (string buildDirectory in preferredBuildDirectories)
            {
                string candidate = Path.Combine(workspaceDirectory, buildDirectory, "WorkspaceSwitcher.exe");
                if (File.Exists(candidate))
                {
                    return candidate;
                }
            }

            if (Directory.Exists(workspaceDirectory))
            {
                string[] buildDirectories = Directory.GetDirectories(workspaceDirectory, "build*", SearchOption.TopDirectoryOnly);
                string newestExecutable = null;
                DateTime newestWriteTime = DateTime.MinValue;
                foreach (string buildDirectory in buildDirectories)
                {
                    string candidate = Path.Combine(buildDirectory, "WorkspaceSwitcher.exe");
                    if (!File.Exists(candidate))
                    {
                        continue;
                    }

                    DateTime writeTime = File.GetLastWriteTimeUtc(candidate);
                    if (newestExecutable == null || writeTime > newestWriteTime)
                    {
                        newestExecutable = candidate;
                        newestWriteTime = writeTime;
                    }
                }

                if (newestExecutable != null)
                {
                    return newestExecutable;
                }
            }

            return Path.Combine(workspaceDirectory, "build", "WorkspaceSwitcher.exe");
        }

        private static string FindEntryPoint(string toolDirectory, string fileName)
        {
            string deployedEntry = Path.Combine(toolDirectory, "app", fileName);
            return File.Exists(deployedEntry)
                ? deployedEntry
                : Path.Combine(toolDirectory, fileName);
        }

        public static IList<ToolHubTool> Filter(IEnumerable<ToolHubTool> tools, string query)
        {
            var result = new List<ToolHubTool>();
            string normalizedQuery = (query ?? string.Empty).Trim();
            if (normalizedQuery.Length == 0)
            {
                result.AddRange(tools);
                return result;
            }

            foreach (ToolHubTool tool in tools)
            {
                if (tool.Id.IndexOf(normalizedQuery, StringComparison.OrdinalIgnoreCase) >= 0 ||
                    tool.Label.IndexOf(normalizedQuery, StringComparison.OrdinalIgnoreCase) >= 0 ||
                    tool.Description.IndexOf(normalizedQuery, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    result.Add(tool);
                }
            }

            return result;
        }
    }

    public static class ToolHubLauncher
    {
        public static ToolHubLaunchRequest CreateRequest(ToolHubTool tool, string commandShell)
        {
            if (tool == null)
            {
                throw new ArgumentNullException("tool");
            }

            if (tool.LaunchKind == ToolHubLaunchKind.Executable)
            {
                return new ToolHubLaunchRequest(tool.EntryPath, tool.Arguments, tool.WorkingDirectory, false);
            }

            string shell = string.IsNullOrWhiteSpace(commandShell) ? "cmd.exe" : commandShell;
            string arguments = "/c call \"" + tool.EntryPath + "\"";
            if (!string.IsNullOrWhiteSpace(tool.Arguments))
            {
                arguments += " " + tool.Arguments;
            }

            return new ToolHubLaunchRequest(shell, arguments, tool.WorkingDirectory, false);
        }
    }

    public static class ToolHubPathResolver
    {
        public static string FindWindowRoot(string applicationDirectory)
        {
            string start = Path.GetFullPath(applicationDirectory ?? AppDomain.CurrentDomain.BaseDirectory);
            string configuredRoot = ReadConfiguredWindowRoot(start);
            if (!string.IsNullOrWhiteSpace(configuredRoot) && LooksLikeWindowRoot(configuredRoot))
            {
                return configuredRoot;
            }

            string current = start;
            for (int i = 0; i < 8 && !string.IsNullOrEmpty(current); i++)
            {
                if (LooksLikeWindowRoot(current))
                {
                    return current;
                }

                DirectoryInfo parent = Directory.GetParent(current.TrimEnd(Path.DirectorySeparatorChar));
                current = parent == null ? string.Empty : parent.FullName;
            }

            string[] candidateRoots =
            {
                Path.Combine(start, "..", "lm-project", "脚本", "window"),
                Path.Combine(start, "..", "..", "lm-project", "脚本", "window"),
                Path.Combine(start, "..", "..", "..", "lm-project", "脚本", "window")
            };
            foreach (string candidate in candidateRoots)
            {
                string fullCandidate = Path.GetFullPath(candidate);
                if (LooksLikeWindowRoot(fullCandidate))
                {
                    return fullCandidate;
                }
            }

            return Path.GetFullPath(Path.Combine(start, "..", "lm-project", "脚本", "window"));
        }

        private static string ReadConfiguredWindowRoot(string applicationDirectory)
        {
            string[] configPaths =
            {
                Path.Combine(applicationDirectory, "..", "config", "window-root.txt"),
                Path.Combine(applicationDirectory, "config", "window-root.txt")
            };

            foreach (string configPath in configPaths)
            {
                if (!File.Exists(configPath))
                {
                    continue;
                }

                string configuredRoot = File.ReadAllText(configPath).Trim();
                if (!string.IsNullOrWhiteSpace(configuredRoot))
                {
                    return Path.GetFullPath(configuredRoot);
                }
            }

            string environmentRoot = Environment.GetEnvironmentVariable("TOOLHUB_WINDOW_ROOT");
            return string.IsNullOrWhiteSpace(environmentRoot)
                ? string.Empty
                : Path.GetFullPath(environmentRoot.Trim());
        }

        private static bool LooksLikeWindowRoot(string directory)
        {
            return Directory.Exists(Path.Combine(directory, "workspace-switcher")) &&
                   Directory.Exists(Path.Combine(directory, "Wallpaper-GUI")) &&
                   Directory.Exists(Path.Combine(directory, "desktop-black-screen-repair"));
        }
    }
}
