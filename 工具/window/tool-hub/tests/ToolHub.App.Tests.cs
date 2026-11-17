using System;
using System.IO;
using System.Linq;
using System.Reflection;

internal static class ToolHubAppTests
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
        string sourcePath = args.Length > 1 ? args[1] : string.Empty;
        Assert(File.Exists(assemblyPath), "ToolHub app is built");
        Assert(File.Exists(sourcePath), "ToolHub app source is available for contract checks");
        if (!File.Exists(assemblyPath) || !File.Exists(sourcePath))
        {
            return failures;
        }

        Assembly assembly = Assembly.LoadFrom(assemblyPath);
        Assert(assembly.GetType("ToolHub.App.ToolHubForm") != null, "ToolHubForm exists");
        Assert(assembly.GetType("ToolHub.App.Program") != null, "Program exists");

        string source = File.ReadAllText(sourcePath);
        Assert(source.Contains("向工具中心提问"), "search placeholder is present");
        Assert(source.Contains("Region = new Region"), "rounded floating surface uses a clipped window region");
        Assert(source.Contains("graphics.Clear(Surface)"), "rounded surface does not leak a transparency-key color");
        Assert(source.Contains("ToolHubLauncher.CreateRequest"), "UI launches through the core request builder");
        Assert(source.Contains("Process.Start"), "UI starts tools as external processes");
        Assert(source.Contains("launchedProcesses"), "UI tracks tools launched by this hub instance");
        Assert(source.Contains("OnFormClosing"), "UI handles host shutdown");
        Assert(source.Contains("ShutdownLaunchedTools"), "UI has a child-tool shutdown routine");
        Assert(source.Contains("CloseMainWindow"), "UI requests a graceful child-tool close");
        Assert(source.Contains("WaitForExit"), "UI waits briefly for graceful child-tool shutdown");
        Assert(source.Contains("EnumWindows"), "UI finds child windows when a process has no main window handle");
        Assert(source.Contains("GetWindowThreadProcessId"), "UI filters close requests by child process id");
        Assert(source.Contains("WM_CLOSE"), "UI sends a native close request to child windows");
        Assert(source.Contains("LaunchFirstVisibleTool"), "action button launches the first filtered tool");
        Assert(source.Contains("退出工具中心"), "exit action has an explicit Chinese label");
        Assert(source.Contains("DrawExitRow"), "exit action is rendered as a dedicated row");
        Assert(source.Contains("ToolHubIcon.Draw"), "the floating ToolHub action uses the shared application icon renderer");
        Assert(source.Contains("ExtractAssociatedIcon"), "the ToolHub form adopts the embedded application icon");
        Assert(source.Contains("ExitApplication"), "exit action has a dedicated close handler");
        Assert(source.Contains("Close();"), "exit action closes only the tool hub window");
        Assert(source.Contains("OnMouseDown"), "tool hub handles drag start");
        Assert(source.Contains("isDragging"), "tool hub tracks drag state");
        Assert(source.Contains("dragStartLocation"), "tool hub remembers its starting location");
        Assert(source.Contains("IsDragHandle"), "tool hub uses the bottom-right action button as the drag handle");
        Assert(source.Contains("dragFromActionButton"), "tool hub identifies a drag from the action button");
        Assert(source.Contains("dragMoved"), "tool hub distinguishes a drag from a click");
        Assert(source.Contains("SystemInformation.DragSize"), "tool hub uses a movement threshold for dragging");
        Assert(source.Contains("Capture = true"), "tool hub captures the pointer during dragging");
        Assert(source.Contains("Capture = false"), "tool hub releases the pointer after dragging");
        Assert(source.Contains("EnablePerMonitorDpi"), "tool hub enables DPI awareness before creating the form");
        Assert(source.Contains("SetProcessDpiAwareness"), "tool hub requests per-monitor DPI awareness");
        Assert(source.Contains("AutoScaleMode = AutoScaleMode.None"), "tool hub keeps its pixel layout from being auto-scaled");
        Assert(source.Contains("OnMouseEnter"), "tool hub expands when the icon is hovered");
        Assert(source.Contains("SetExpanded(false)"), "tool hub has a collapsed icon state");
        Assert(source.Contains("searchBox.Visible = expanded"), "tool hub hides the search box while collapsed");
        Assert(source.Contains("ToolHubLayout"), "tool hub sizes its panel from the number of catalog tools");
        Assert(!source.Contains("i < 3"), "tool rows are not capped at the previous three-tool limit");
        Assert(source.Contains("rowIndex < layout.ToolCount"), "the fourth tool row is included in click routing");
        Assert(source.Contains("Math.Min(visibleTools.Count, layout.ToolCount)"), "exit row follows the dynamic tool list");

        int launchStart = source.IndexOf("private void LaunchTool", StringComparison.Ordinal);
        int launchEnd = source.IndexOf("private void PositionNearCursor", launchStart, StringComparison.Ordinal);
        string launchMethod = launchStart >= 0 && launchEnd > launchStart
            ? source.Substring(launchStart, launchEnd - launchStart)
            : string.Empty;
        Assert(launchMethod.IndexOf("Close();", StringComparison.Ordinal) < 0,
            "selecting a tool does not close the tool hub");
        Assert(launchMethod.Contains("TrackLaunchedProcess"),
            "selecting a tool records the launched process for host shutdown");
        Assert(launchMethod.Contains("bool showChildWindow = tool.LaunchKind == ToolHubLaunchKind.Executable"),
            "GUI tools request a visible child window");
        Assert(launchMethod.Contains("CreateNoWindow = !showChildWindow"),
            "command-file tools remain hidden while GUI tools can show");
        Assert(launchMethod.Contains("WindowStyle = showChildWindow ? ProcessWindowStyle.Normal : ProcessWindowStyle.Hidden"),
            "GUI tools do not inherit the hidden startup style");

        Assert(source.Contains("RegisterHotKey"), "tool hub registers a global visibility shortcut");
        Assert(source.Contains("UnregisterHotKey"), "tool hub unregisters the global shortcut");
        Assert(source.Contains("WndProc"), "tool hub handles the global shortcut message");
        Assert(source.Contains("ToggleVisibility"), "tool hub toggles visibility from the shortcut");
        Assert(source.Contains("Keys.F12"), "tool hub uses F12 in the visibility shortcut");
        Assert(source.Contains("IsCursorWithinExpandedBounds"),
            "expanded hub stays open while the cursor crosses the visual gap");
        Assert(source.Contains("RectangleToScreen(ClientRectangle)"),
            "expanded hub checks the full screen-space bounds");

        Console.WriteLine(failures == 0 ? "PASS ToolHub.App.Tests" : "FAILED ToolHub.App.Tests: " + failures);
        return failures;
    }
}
