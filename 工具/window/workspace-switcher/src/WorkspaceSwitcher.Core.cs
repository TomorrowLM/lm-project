using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;

namespace WorkspaceSwitcher.Core
{
    public static class WorkspaceVisibilityPolicy
    {
        public static bool ShouldHide(int windowWorkspaceId, int activeWorkspaceId)
        {
            return windowWorkspaceId != activeWorkspaceId;
        }
    }

    public static class ForegroundActivationPolicy
    {
        public static bool ShouldSwitchToWorkspace(int activeWorkspaceId, int activatedWindowWorkspaceId, bool isProgrammaticActivation)
        {
            return !isProgrammaticActivation && activatedWindowWorkspaceId != 0 && activatedWindowWorkspaceId != activeWorkspaceId;
        }

        public static bool ShouldProcessWindowEvent(long eventWindowHandle, long foregroundWindowHandle)
        {
            return eventWindowHandle != 0 && foregroundWindowHandle != 0 && eventWindowHandle == foregroundWindowHandle;
        }
    }

    public static class ForegroundWindowRecoveryPolicy
    {
        public static bool ShouldUseOnlyProcessMatch(int processMatchCount, int savedItemCount, int liveWindowCount)
        {
            return processMatchCount == 1 && savedItemCount == 1 && liveWindowCount == 1;
        }
    }

    public static class WorkspaceWindowRecoveryPolicy
    {
        public static bool ShouldUseUniqueCandidate(int candidateMatchCount)
        {
            return candidateMatchCount == 1;
        }

        public static bool ShouldScanLaunchProfile(int titleMatchCount)
        {
            return titleMatchCount != 1;
        }
    }

    public static class WorkspaceFocusPolicy
    {
        public static bool ShouldMinimizePeer(int selectedWorkspaceId, int itemWorkspaceId, long selectedWindowHandle, long itemWindowHandle)
        {
            // Keep this public policy compatible with existing callers, but
            // focusing an application no longer minimizes any peer window.
            return false;
        }

        public static bool ShouldMinimizePeerForApplicationFocus(int selectedWorkspaceId, int itemWorkspaceId, long selectedWindowHandle, long itemWindowHandle)
        {
            return false;
        }

        public static bool ShouldMinimizeAllForWorkspaceClick(int clickedWorkspaceId, int itemWorkspaceId, long itemWindowHandle)
        {
            return clickedWorkspaceId > 0
                && clickedWorkspaceId == itemWorkspaceId
                && itemWindowHandle != 0;
        }

        public static bool ShouldMinimizePeerOnDisplay(
            int selectedWorkspaceId,
            int itemWorkspaceId,
            long selectedWindowHandle,
            long itemWindowHandle,
            string selectedDisplayId,
            string itemDisplayId)
        {
            return ShouldMinimizePeer(selectedWorkspaceId, itemWorkspaceId, selectedWindowHandle, itemWindowHandle)
                && !String.IsNullOrEmpty(selectedDisplayId)
                && !String.IsNullOrEmpty(itemDisplayId)
                && String.Equals(selectedDisplayId, itemDisplayId, StringComparison.OrdinalIgnoreCase);
        }
    }

    public static class DisplayFilterPolicy
    {
        public static bool ShouldHighlight(string selectedDisplayId, string itemDisplayId)
        {
            return String.IsNullOrEmpty(selectedDisplayId)
                || String.Equals(selectedDisplayId, itemDisplayId, StringComparison.OrdinalIgnoreCase);
        }
    }

    public static class WorkspaceCardClickPolicy
    {
        public static bool ShouldMinimize(int pressedWorkspaceId, int clickedWorkspaceId, int clickCount)
        {
            return clickCount == 2 && ShouldActivate(pressedWorkspaceId, clickedWorkspaceId);
        }

        public static bool ShouldActivate(int pressedWorkspaceId, int clickedWorkspaceId)
        {
            return pressedWorkspaceId != 0 && pressedWorkspaceId == clickedWorkspaceId;
        }
    }

    public static class WorkspaceHotKeyPolicy
    {
        public static int ResolveWorkspaceId(int hotKeyId, int firstWorkspaceHotKeyId, IList<int> workspaceIds)
        {
            int workspaceIndex = hotKeyId - firstWorkspaceHotKeyId;
            if (workspaceIndex < 0
                || workspaceIndex >= WorkspaceLayout.MaximumWorkspaceCount
                || workspaceIds == null
                || workspaceIndex >= workspaceIds.Count)
            {
                return 0;
            }

            return workspaceIds[workspaceIndex];
        }
    }

    public sealed class WorkspaceLayout
    {
        public const int MaximumWorkspaceCount = 9;

        private readonly List<int> workspaceIds = new List<int> { 1 };

        public int Count
        {
            get { return workspaceIds.Count; }
        }

        public IList<int> GetWorkspaceIds()
        {
            return new List<int>(workspaceIds);
        }

        public int CreateWorkspace()
        {
            if (workspaceIds.Count >= MaximumWorkspaceCount)
            {
                return 0;
            }

            int workspaceId = 0;
            for (int candidate = 2; candidate <= MaximumWorkspaceCount; candidate++)
            {
                if (!workspaceIds.Contains(candidate))
                {
                    workspaceId = candidate;
                    break;
                }
            }

            if (workspaceId == 0)
            {
                return 0;
            }

            workspaceIds.Add(workspaceId);
            return workspaceId;
        }

        public bool RemoveWorkspace(int workspaceId)
        {
            if (workspaceId <= 1)
            {
                return false;
            }

            return workspaceIds.Remove(workspaceId);
        }

        public void MoveWorkspaceToIndex(int workspaceId, int index)
        {
            if (workspaceId == 1 || !workspaceIds.Contains(workspaceId))
            {
                return;
            }

            int boundedIndex = Math.Max(1, Math.Min(index, workspaceIds.Count - 1));
            workspaceIds.Remove(workspaceId);
            workspaceIds.Insert(boundedIndex, workspaceId);
        }

        public void Restore(IList<int> savedOrder)
        {
            workspaceIds.Clear();
            workspaceIds.Add(1);
            if (savedOrder == null)
            {
                return;
            }

            foreach (int workspaceId in savedOrder)
            {
                if (workspaceId > 1 && workspaceId <= MaximumWorkspaceCount && !workspaceIds.Contains(workspaceId))
                {
                    workspaceIds.Add(workspaceId);
                }
            }
        }
    }

    public static class WorkspaceDragPolicy
    {
        public static bool ShouldStartReorder(int workspaceId, int deltaX, int deltaY)
        {
            return workspaceId > 1 && Math.Abs(deltaX) + Math.Abs(deltaY) >= 8;
        }
    }

    public static class WorkspaceResizePolicy
    {
        public const int MinimumHeight = 76;
        public const int MaximumHeight = 240;

        public static int ClampHeight(int height)
        {
            return Math.Max(MinimumHeight, Math.Min(MaximumHeight, height));
        }
    }

    public static class DpiLayoutPolicy
    {
        public const int BaseDpi = 96;

        public static int ScaleValue(int logicalValue, int dpi)
        {
            int safeDpi = Math.Max(BaseDpi, dpi);
            return Math.Max(1, (int)Math.Round(logicalValue * (double)safeDpi / BaseDpi));
        }

        public static int UnscaleValue(int deviceValue, int dpi)
        {
            int safeDpi = Math.Max(BaseDpi, dpi);
            return Math.Max(1, (int)Math.Round(deviceValue * (double)BaseDpi / safeDpi));
        }

        public static float ScaleFontSize(float logicalFontSize, int dpi)
        {
            int safeDpi = Math.Max(BaseDpi, dpi);
            return logicalFontSize * BaseDpi / safeDpi;
        }
    }

    public static class DragPreviewPolicy
    {
        private const int CustomTitleBarHeight = 48;
        private const int ChromeTitleBarHeight = 96;

        public static bool IsTitleBarPoint(int cursorY, int windowTop, int clientTop)
        {
            return IsTitleBarPoint(cursorY, windowTop, clientTop, CustomTitleBarHeight);
        }

        public static bool IsChromeTitleBarPoint(int cursorY, int windowTop, int clientTop)
        {
            return IsTitleBarPoint(cursorY, windowTop, clientTop, ChromeTitleBarHeight);
        }

        private static bool IsTitleBarPoint(int cursorY, int windowTop, int clientTop, int titleBarHeight)
        {
            int titleBarBottom = Math.Max(clientTop, windowTop + titleBarHeight);
            return cursorY >= windowTop && cursorY < titleBarBottom;
        }

        public static int GetPreviewLeft(int cursorX, int previewWidth)
        {
            return cursorX - previewWidth / 2;
        }

        public static int GetPreviewTop(int cursorY, int previewHeight)
        {
            return cursorY - previewHeight / 2;
        }

        public static bool HasMovedEnough(int startX, int startY, int cursorX, int cursorY)
        {
            return Math.Abs(cursorX - startX) + Math.Abs(cursorY - startY) >= 6;
        }
    }

    public sealed class WorkspaceItem
    {
        public long WindowHandle { get; internal set; }
        public int WorkspaceId { get; internal set; }
        public string Title { get; internal set; }
        public string ProcessName { get; internal set; }
        public string ExecutablePath { get; internal set; }
        public string LaunchArguments { get; internal set; }
        public string WorkingDirectory { get; internal set; }
        public string DisplayName { get; internal set; }
        public bool IsAvailable { get; internal set; }
        public bool IsMaximized { get; internal set; }
        public bool IsUserMinimized { get; internal set; }
    }

    public static class WorkspaceWindowStatePolicy
    {
        public static bool ApplyMinimizeEvent(bool wasUserMinimized, bool isMinimizeStart, bool isWorkspaceSwitcherAction)
        {
            return isWorkspaceSwitcherAction ? wasUserMinimized : isMinimizeStart;
        }

        public static bool ShouldShowMinimized(bool isUserMinimized, bool isExplicitFocus)
        {
            return isUserMinimized && !isExplicitFocus;
        }
    }

    public static class WorkspaceLaunchProfileParser
    {
        public static string ExtractArguments(string commandLine, string executablePath)
        {
            string source = (commandLine ?? String.Empty).Trim();
            if (String.IsNullOrEmpty(source))
            {
                return String.Empty;
            }

            int tokenEnd;
            if (source[0] == '"')
            {
                tokenEnd = source.IndexOf('"', 1);
                if (tokenEnd < 0)
                {
                    return String.Empty;
                }
                tokenEnd++;
            }
            else
            {
                tokenEnd = source.IndexOfAny(new char[] { ' ', '\t' });
                if (tokenEnd < 0)
                {
                    return String.Empty;
                }
            }

            return source.Substring(tokenEnd).TrimStart();
        }

        public static string GetWorkingDirectory(string executablePath)
        {
            if (String.IsNullOrWhiteSpace(executablePath))
            {
                return String.Empty;
            }

            try
            {
                return Path.GetDirectoryName(executablePath) ?? String.Empty;
            }
            catch (ArgumentException)
            {
                return String.Empty;
            }
        }
    }

    public sealed class WorkspaceCatalog
    {
        private readonly Dictionary<long, WorkspaceItem> items = new Dictionary<long, WorkspaceItem>();

        public void AssignWindow(int workspaceId, long windowHandle, string title, string processName, string commandLine)
        {
            ValidateWorkspace(workspaceId);
            items[windowHandle] = new WorkspaceItem
            {
                WorkspaceId = workspaceId,
                WindowHandle = windowHandle,
                Title = title ?? String.Empty,
                ProcessName = processName ?? String.Empty,
                ExecutablePath = String.Empty,
                LaunchArguments = String.Empty,
                WorkingDirectory = String.Empty,
                DisplayName = CreateDisplayName(title, processName, commandLine),
                IsAvailable = true
            };
        }

        public IList<WorkspaceItem> GetWorkspaceItems(int workspaceId)
        {
            ValidateWorkspace(workspaceId);
            List<WorkspaceItem> result = new List<WorkspaceItem>();
            foreach (WorkspaceItem item in items.Values)
            {
                if (item.WorkspaceId == workspaceId)
                {
                    result.Add(item);
                }
            }

            result.Sort(delegate(WorkspaceItem left, WorkspaceItem right)
            {
                return String.Compare(left.DisplayName, right.DisplayName, StringComparison.OrdinalIgnoreCase);
            });
            return result;
        }

        public void MoveWindow(long windowHandle, int workspaceId)
        {
            ValidateWorkspace(workspaceId);
            WorkspaceItem item;
            if (items.TryGetValue(windowHandle, out item))
            {
                item.WorkspaceId = workspaceId;
            }
        }

        public int MoveWorkspaceItems(int sourceWorkspaceId, int targetWorkspaceId)
        {
            ValidateWorkspace(sourceWorkspaceId);
            ValidateWorkspace(targetWorkspaceId);
            if (sourceWorkspaceId == targetWorkspaceId)
            {
                return 0;
            }

            int moved = 0;
            foreach (WorkspaceItem item in items.Values)
            {
                if (item.WorkspaceId == sourceWorkspaceId)
                {
                    item.WorkspaceId = targetWorkspaceId;
                    moved++;
                }
            }

            return moved;
        }

        public void RemoveWindow(long windowHandle)
        {
            items.Remove(windowHandle);
        }

        public bool RebindWindow(long oldWindowHandle, long newWindowHandle)
        {
            if (oldWindowHandle == 0 || newWindowHandle == 0)
            {
                return false;
            }

            WorkspaceItem item;
            if (!items.TryGetValue(oldWindowHandle, out item))
            {
                return false;
            }

            if (oldWindowHandle == newWindowHandle)
            {
                return true;
            }

            if (items.ContainsKey(newWindowHandle))
            {
                return false;
            }

            items.Remove(oldWindowHandle);
            item.WindowHandle = newWindowHandle;
            items[newWindowHandle] = item;
            return true;
        }

        public void SetWindowMaximized(long windowHandle, bool isMaximized)
        {
            WorkspaceItem item;
            if (items.TryGetValue(windowHandle, out item))
            {
                item.IsMaximized = isMaximized;
            }
        }

        public void SetWindowUserMinimized(long windowHandle, bool isUserMinimized)
        {
            WorkspaceItem item;
            if (items.TryGetValue(windowHandle, out item))
            {
                item.IsUserMinimized = isUserMinimized;
            }
        }

        public void SetExecutablePath(long windowHandle, string executablePath)
        {
            WorkspaceItem item;
            if (items.TryGetValue(windowHandle, out item))
            {
                item.ExecutablePath = executablePath ?? String.Empty;
            }
        }

        public void SetLaunchProfile(long windowHandle, string launchArguments, string workingDirectory)
        {
            WorkspaceItem item;
            if (items.TryGetValue(windowHandle, out item))
            {
                item.LaunchArguments = launchArguments ?? String.Empty;
                item.WorkingDirectory = workingDirectory ?? String.Empty;
            }
        }

        public void SetWindowAvailable(long windowHandle, bool isAvailable)
        {
            WorkspaceItem item;
            if (items.TryGetValue(windowHandle, out item))
            {
                item.IsAvailable = isAvailable;
            }
        }

        public int GetWindowWorkspaceId(long windowHandle)
        {
            WorkspaceItem item;
            return items.TryGetValue(windowHandle, out item) ? item.WorkspaceId : 0;
        }

        public IList<WorkspaceItem> GetAllItems()
        {
            return new List<WorkspaceItem>(items.Values);
        }

        public void RestoreItem(WorkspaceItemSnapshot snapshot)
        {
            if (snapshot == null || snapshot.WindowHandle == 0)
            {
                return;
            }

            ValidateWorkspace(snapshot.WorkspaceId);
            items[snapshot.WindowHandle] = new WorkspaceItem
            {
                WindowHandle = snapshot.WindowHandle,
                WorkspaceId = snapshot.WorkspaceId,
                Title = snapshot.Title ?? String.Empty,
                ProcessName = snapshot.ProcessName ?? String.Empty,
                ExecutablePath = snapshot.ExecutablePath ?? String.Empty,
                LaunchArguments = snapshot.LaunchArguments ?? String.Empty,
                WorkingDirectory = snapshot.WorkingDirectory ?? String.Empty,
                DisplayName = snapshot.DisplayName ?? String.Empty,
                IsAvailable = true,
                IsMaximized = snapshot.IsMaximized,
                IsUserMinimized = snapshot.IsUserMinimized
            };
        }

        private static void ValidateWorkspace(int workspaceId)
        {
            if (workspaceId < 1 || workspaceId > 9)
            {
                throw new ArgumentOutOfRangeException("workspaceId", "Workspace IDs must be between 1 and 9.");
            }
        }

        private static string CreateDisplayName(string title, string processName, string commandLine)
        {
            if (String.Equals(processName, "Code.exe", StringComparison.OrdinalIgnoreCase) ||
                String.Equals(processName, "Visual Studio Code", StringComparison.OrdinalIgnoreCase))
            {
                string folderName = TryGetFolderName(commandLine);
                if (!String.IsNullOrEmpty(folderName))
                {
                    return "VS Code — " + folderName;
                }

                string fallbackTitle = String.IsNullOrWhiteSpace(title) ? "Visual Studio Code" : title.Trim();
                return Regex.Replace(fallbackTitle, "Visual Studio Code", "VS Code", RegexOptions.IgnoreCase);
            }

            string applicationName = GetApplicationName(processName);
            string content = String.IsNullOrWhiteSpace(title) ? String.Empty : title.Trim();
            if (String.Equals(applicationName, "Google Chrome", StringComparison.OrdinalIgnoreCase))
            {
                content = Regex.Replace(content, "\\s+-\\s+Google Chrome$", String.Empty, RegexOptions.IgnoreCase).Trim();
            }

            if (String.IsNullOrEmpty(content) || String.Equals(content, applicationName, StringComparison.OrdinalIgnoreCase))
            {
                return applicationName;
            }

            return applicationName + " — " + content;
        }

        private static string GetApplicationName(string processName)
        {
            string normalized = (processName ?? String.Empty).Trim();
            if (normalized.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
            {
                normalized = normalized.Substring(0, normalized.Length - 4);
            }

            if (String.Equals(normalized, "chrome", StringComparison.OrdinalIgnoreCase))
            {
                return "Google Chrome";
            }
            if (String.Equals(normalized, "msedge", StringComparison.OrdinalIgnoreCase))
            {
                return "Microsoft Edge";
            }
            if (String.Equals(normalized, "explorer", StringComparison.OrdinalIgnoreCase))
            {
                return "文件资源管理器";
            }
            if (String.Equals(normalized, "Code", StringComparison.OrdinalIgnoreCase))
            {
                return "VS Code";
            }

            return String.IsNullOrEmpty(normalized) ? "应用" : normalized;
        }

        private static string TryGetFolderName(string commandLine)
        {
            if (String.IsNullOrWhiteSpace(commandLine))
            {
                return null;
            }

            Match match = Regex.Match(commandLine, @"[A-Za-z]:\\(?:[^\\\""\s]+\\)*[^\\\""\s]+", RegexOptions.IgnoreCase);
            if (!match.Success)
            {
                return null;
            }

            string path = match.Value.TrimEnd('\\');
            return Path.GetFileName(path);
        }
    }

    public sealed class WorkspaceItemSnapshot
    {
        public long WindowHandle { get; set; }
        public int WorkspaceId { get; set; }
        public string Title { get; set; }
        public string ProcessName { get; set; }
        public string ExecutablePath { get; set; }
        public string LaunchArguments { get; set; }
        public string WorkingDirectory { get; set; }
        public string DisplayName { get; set; }
        public bool IsMaximized { get; set; }
        public bool IsUserMinimized { get; set; }
    }

    public sealed class WorkspaceStateSnapshot
    {
        public IList<int> WorkspaceIds { get; private set; }
        public IList<WorkspaceItemSnapshot> Items { get; private set; }
        public IList<WorkspaceHeightSnapshot> Heights { get; private set; }
        public int PanelX { get; set; }
        public int PanelY { get; set; }
        public int PanelWidth { get; set; }
        public int PanelHeight { get; set; }

        public WorkspaceStateSnapshot()
        {
            WorkspaceIds = new List<int>();
            Items = new List<WorkspaceItemSnapshot>();
            Heights = new List<WorkspaceHeightSnapshot>();
        }
    }

    public sealed class WorkspaceHeightSnapshot
    {
        public int WorkspaceId { get; set; }
        public int Height { get; set; }
    }

    public static class WorkspaceStateStore
    {
        public static string Serialize(WorkspaceStateSnapshot snapshot)
        {
            if (snapshot == null)
            {
                throw new ArgumentNullException("snapshot");
            }

            StringBuilder output = new StringBuilder();
            XmlWriterSettings settings = new XmlWriterSettings { OmitXmlDeclaration = true, Indent = false };
            using (XmlWriter writer = XmlWriter.Create(output, settings))
            {
                writer.WriteStartElement("workspaceState");
                writer.WriteStartElement("workspaces");
                foreach (int workspaceId in snapshot.WorkspaceIds)
                {
                    writer.WriteStartElement("workspace");
                    writer.WriteAttributeString("id", workspaceId.ToString());
                    writer.WriteEndElement();
                }
                writer.WriteEndElement();
                writer.WriteStartElement("items");
                foreach (WorkspaceItemSnapshot item in snapshot.Items)
                {
                    writer.WriteStartElement("item");
                    writer.WriteAttributeString("handle", item.WindowHandle.ToString());
                    writer.WriteAttributeString("workspace", item.WorkspaceId.ToString());
                    writer.WriteAttributeString("maximized", item.IsMaximized ? "true" : "false");
                    writer.WriteAttributeString("minimized", item.IsUserMinimized ? "true" : "false");
                    writer.WriteElementString("title", item.Title ?? String.Empty);
                    writer.WriteElementString("process", item.ProcessName ?? String.Empty);
                    writer.WriteElementString("path", item.ExecutablePath ?? String.Empty);
                    writer.WriteElementString("args", item.LaunchArguments ?? String.Empty);
                    writer.WriteElementString("workingDirectory", item.WorkingDirectory ?? String.Empty);
                    writer.WriteElementString("display", item.DisplayName ?? String.Empty);
                    writer.WriteEndElement();
                }
                writer.WriteEndElement();
                writer.WriteStartElement("heights");
                foreach (WorkspaceHeightSnapshot height in snapshot.Heights)
                {
                    writer.WriteStartElement("height");
                    writer.WriteAttributeString("workspace", height.WorkspaceId.ToString());
                    writer.WriteAttributeString("value", height.Height.ToString());
                    writer.WriteEndElement();
                }
                writer.WriteEndElement();
                if (snapshot.PanelWidth > 0 && snapshot.PanelHeight > 0)
                {
                    writer.WriteStartElement("panel");
                    writer.WriteAttributeString("x", snapshot.PanelX.ToString());
                    writer.WriteAttributeString("y", snapshot.PanelY.ToString());
                    writer.WriteAttributeString("width", snapshot.PanelWidth.ToString());
                    writer.WriteAttributeString("height", snapshot.PanelHeight.ToString());
                    writer.WriteEndElement();
                }
                writer.WriteEndElement();
            }

            return output.ToString();
        }

        public static WorkspaceStateSnapshot Deserialize(string serialized)
        {
            WorkspaceStateSnapshot snapshot = new WorkspaceStateSnapshot();
            if (String.IsNullOrWhiteSpace(serialized))
            {
                return snapshot;
            }

            XmlDocument document = new XmlDocument();
            document.LoadXml(serialized);
            XmlNode workspaces = document.SelectSingleNode("/workspaceState/workspaces");
            if (workspaces != null)
            {
                foreach (XmlNode node in workspaces.SelectNodes("workspace"))
                {
                    int workspaceId;
                    if (Int32.TryParse(node.Attributes["id"].Value, out workspaceId))
                    {
                        snapshot.WorkspaceIds.Add(workspaceId);
                    }
                }
            }

            XmlNode items = document.SelectSingleNode("/workspaceState/items");
            if (items != null)
            {
                foreach (XmlNode node in items.SelectNodes("item"))
                {
                    long windowHandle;
                    int workspaceId;
                    if (!Int64.TryParse(node.Attributes["handle"].Value, out windowHandle) ||
                        !Int32.TryParse(node.Attributes["workspace"].Value, out workspaceId))
                    {
                        continue;
                    }

                    XmlAttribute minimizedAttribute = node.Attributes["minimized"];
                    snapshot.Items.Add(new WorkspaceItemSnapshot
                    {
                        WindowHandle = windowHandle,
                        WorkspaceId = workspaceId,
                        IsMaximized = String.Equals(node.Attributes["maximized"].Value, "true", StringComparison.OrdinalIgnoreCase),
                        IsUserMinimized = minimizedAttribute != null && String.Equals(minimizedAttribute.Value, "true", StringComparison.OrdinalIgnoreCase),
                        Title = ReadElement(node, "title"),
                        ProcessName = ReadElement(node, "process"),
                        ExecutablePath = ReadElement(node, "path"),
                        LaunchArguments = ReadElement(node, "args"),
                        WorkingDirectory = ReadElement(node, "workingDirectory"),
                        DisplayName = ReadElement(node, "display")
                    });
                }
            }

            XmlNode heights = document.SelectSingleNode("/workspaceState/heights");
            if (heights != null)
            {
                foreach (XmlNode node in heights.SelectNodes("height"))
                {
                    int workspaceId;
                    int height;
                    if (Int32.TryParse(node.Attributes["workspace"].Value, out workspaceId) &&
                        Int32.TryParse(node.Attributes["value"].Value, out height))
                    {
                        snapshot.Heights.Add(new WorkspaceHeightSnapshot { WorkspaceId = workspaceId, Height = height });
                    }
                }
            }

            XmlNode panel = document.SelectSingleNode("/workspaceState/panel");
            if (panel != null)
            {
                int panelX;
                int panelY;
                int panelWidth;
                int panelHeight;
                if (Int32.TryParse(panel.Attributes["x"].Value, out panelX)) snapshot.PanelX = panelX;
                if (Int32.TryParse(panel.Attributes["y"].Value, out panelY)) snapshot.PanelY = panelY;
                if (Int32.TryParse(panel.Attributes["width"].Value, out panelWidth)) snapshot.PanelWidth = panelWidth;
                if (Int32.TryParse(panel.Attributes["height"].Value, out panelHeight)) snapshot.PanelHeight = panelHeight;
            }

            return snapshot;
        }

        private static string ReadElement(XmlNode parent, string name)
        {
            XmlNode node = parent.SelectSingleNode(name);
            return node == null ? String.Empty : node.InnerText;
        }
    }
}
