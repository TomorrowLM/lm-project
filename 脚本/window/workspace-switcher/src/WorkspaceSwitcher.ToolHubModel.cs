using System;
using System.Collections.Generic;
using System.IO;

namespace WorkspaceSwitcher.Core
{
    public enum ToolHubLaunchKind
    {
        WorkspacePanel,
        CommandFile
    }

    public sealed class ToolHubItem
    {
        public ToolHubItem(
            string id,
            string label,
            string description,
            ToolHubLaunchKind launchKind,
            string entryPath,
            string workingDirectory)
        {
            Id = id;
            Label = label;
            Description = description;
            LaunchKind = launchKind;
            EntryPath = entryPath;
            WorkingDirectory = workingDirectory;
            IsAvailable = File.Exists(entryPath);
        }

        public string Id { get; private set; }

        public string Label { get; private set; }

        public string Description { get; private set; }

        public ToolHubLaunchKind LaunchKind { get; private set; }

        public string EntryPath { get; private set; }

        public string WorkingDirectory { get; private set; }

        public bool IsAvailable { get; private set; }
    }

    public static class ToolHubCatalog
    {
        public static IList<ToolHubItem> GetTools(string windowRoot)
        {
            string root = Path.GetFullPath(windowRoot ?? String.Empty);
            string workspaceDirectory = Path.Combine(root, "workspace-switcher");
            string wallpaperDirectory = Path.Combine(root, "Wallpaper-GUI");
            string repairDirectory = Path.Combine(root, "desktop-black-screen-repair");

            return new List<ToolHubItem>
            {
                new ToolHubItem(
                    "workspace",
                    "工作区切换",
                    "管理应用窗口和显示器",
                    ToolHubLaunchKind.WorkspacePanel,
                    Path.Combine(workspaceDirectory, "build", "WorkspaceSwitcher.exe"),
                    workspaceDirectory),
                new ToolHubItem(
                    "wallpaper",
                    "壁纸中心",
                    "浏览、切换和同步桌面壁纸",
                    ToolHubLaunchKind.CommandFile,
                    Path.Combine(wallpaperDirectory, "Wallpaper-GUI.cmd"),
                    wallpaperDirectory),
                new ToolHubItem(
                    "desktop-repair",
                    "桌面修复",
                    "诊断和恢复 Windows 桌面",
                    ToolHubLaunchKind.CommandFile,
                    Path.Combine(repairDirectory, "Repair-DesktopBlackScreen.cmd"),
                    repairDirectory)
            };
        }

        public static IList<ToolHubItem> Filter(IEnumerable<ToolHubItem> tools, string query)
        {
            List<ToolHubItem> result = new List<ToolHubItem>();
            string normalizedQuery = (query ?? String.Empty).Trim();
            foreach (ToolHubItem tool in tools)
            {
                if (normalizedQuery.Length == 0
                    || tool.Label.IndexOf(normalizedQuery, StringComparison.OrdinalIgnoreCase) >= 0
                    || tool.Description.IndexOf(normalizedQuery, StringComparison.OrdinalIgnoreCase) >= 0
                    || tool.Id.IndexOf(normalizedQuery, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    result.Add(tool);
                }
            }

            return result;
        }
    }
}
