using System;
using System.Collections;
using System.IO;
using System.Reflection;
using System.Collections.Generic;

internal static class WorkspaceSwitcherCoreTests
{
    private static int failures;

    private static void Assert(bool condition, string name)
    {
        if (condition)
        {
            Console.WriteLine("PASS " + name);
            return;
        }

        failures++;
        Console.WriteLine("FAIL " + name);
    }

    private static MethodInfo RequireMethod(Type type, string name, int parameterCount)
    {
        foreach (MethodInfo method in type.GetMethods())
        {
            if (method.Name == name && method.GetParameters().Length == parameterCount)
            {
                return method;
            }
        }

        return null;
    }

    private static object First(IEnumerable values)
    {
        foreach (object value in values)
        {
            return value;
        }

        return null;
    }

    public static int Main(string[] args)
    {
        string libraryPath = args.Length == 1
            ? args[0]
            : Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "WorkspaceSwitcher.Core.dll");

        Assert(File.Exists(libraryPath), "Core library is built");
        if (!File.Exists(libraryPath))
        {
            return 1;
        }

        Assembly assembly = Assembly.LoadFrom(libraryPath);
        Type memoryGateType = assembly.GetType("WorkspaceSwitcher.Core.MemorySafetyGate");
        Assert(memoryGateType == null, "Automatic memory stop is not included");
        if (memoryGateType != null)
        {
            return 1;
        }

        Type visibilityPolicyType = assembly.GetType("WorkspaceSwitcher.Core.WorkspaceVisibilityPolicy");
        Assert(visibilityPolicyType != null, "Workspace visibility policy type exists");
        if (visibilityPolicyType == null)
        {
            return 1;
        }

        MethodInfo shouldHide = visibilityPolicyType.GetMethod("ShouldHide");
        Assert(shouldHide != null, "Workspace visibility policy API exists");
        if (shouldHide == null)
        {
            return 1;
        }

        Assert(!(bool)shouldHide.Invoke(null, new object[] { 2, 2 }), "Current workspace windows remain visible");
        Assert((bool)shouldHide.Invoke(null, new object[] { 1, 2 }), "Inactive workspace windows are hidden from docks");

        Type dragPreviewPolicyType = assembly.GetType("WorkspaceSwitcher.Core.DragPreviewPolicy");
        Assert(dragPreviewPolicyType != null, "Drag preview policy type exists");
        if (dragPreviewPolicyType == null)
        {
            return 1;
        }

        MethodInfo isTitleBarPoint = dragPreviewPolicyType.GetMethod("IsTitleBarPoint");
        MethodInfo getPreviewLeft = dragPreviewPolicyType.GetMethod("GetPreviewLeft");
        MethodInfo getPreviewTop = dragPreviewPolicyType.GetMethod("GetPreviewTop");
        Assert(isTitleBarPoint != null && getPreviewLeft != null && getPreviewTop != null, "Drag preview policy APIs exist");
        if (isTitleBarPoint == null || getPreviewLeft == null || getPreviewTop == null)
        {
            return 1;
        }

        Assert((bool)isTitleBarPoint.Invoke(null, new object[] { 112, 100, 138 }), "Only a title-bar drag starts the preview");
        Assert(!(bool)isTitleBarPoint.Invoke(null, new object[] { 150, 100, 138 }), "A client-area click does not start the preview");
        Assert((bool)isTitleBarPoint.Invoke(null, new object[] { 125, 100, 100 }), "Custom title bars use the top drag zone");
        Assert(!(bool)isTitleBarPoint.Invoke(null, new object[] { 155, 100, 100 }), "Custom title-bar drag zone has a fixed lower bound");
        Assert((int)getPreviewLeft.Invoke(null, new object[] { 500, 240 }) == 380, "Preview centers under the pointer horizontally");
        Assert((int)getPreviewTop.Invoke(null, new object[] { 400, 120 }) == 340, "Preview centers under the pointer vertically");
        MethodInfo hasMovedEnough = dragPreviewPolicyType.GetMethod("HasMovedEnough");
        Assert(hasMovedEnough != null, "Drag preview policy has a movement threshold");
        if (hasMovedEnough != null)
        {
            Assert(!(bool)hasMovedEnough.Invoke(null, new object[] { 100, 100, 103, 102 }), "A title-bar click does not immediately create a drag preview");
            Assert((bool)hasMovedEnough.Invoke(null, new object[] { 100, 100, 106, 101 }), "Moving beyond the threshold creates a drag preview");
        }

        Type foregroundPolicyType = assembly.GetType("WorkspaceSwitcher.Core.ForegroundActivationPolicy");
        Assert(foregroundPolicyType != null, "Foreground activation policy type exists");
        if (foregroundPolicyType == null)
        {
            return 1;
        }

        MethodInfo shouldSwitchForForeground = foregroundPolicyType.GetMethod("ShouldSwitchToWorkspace");
        Assert(shouldSwitchForForeground != null, "Foreground activation policy API exists");
        if (shouldSwitchForForeground == null)
        {
            return 1;
        }

        Assert((bool)shouldSwitchForForeground.Invoke(null, new object[] { 1, 2, false }), "Dock activation switches to the assigned workspace");
        Assert(!(bool)shouldSwitchForForeground.Invoke(null, new object[] { 2, 2, false }), "Activation in the current workspace does not switch again");
        Assert(!(bool)shouldSwitchForForeground.Invoke(null, new object[] { 1, 2, true }), "Programmatic activation does not recurse");

        Type focusPolicyType = assembly.GetType("WorkspaceSwitcher.Core.WorkspaceFocusPolicy");
        Assert(focusPolicyType != null, "Workspace focus policy type exists");
        if (focusPolicyType == null)
        {
            return 1;
        }

        MethodInfo shouldMinimizePeer = focusPolicyType.GetMethod("ShouldMinimizePeer");
        Assert(shouldMinimizePeer != null, "Workspace focus policy API exists");
        if (shouldMinimizePeer == null)
        {
            return 1;
        }

        Assert((bool)shouldMinimizePeer.Invoke(null, new object[] { 2, 2, (long)101, (long)202 }), "Clicking an app minimizes other apps in the same workspace");
        Assert(!(bool)shouldMinimizePeer.Invoke(null, new object[] { 1, 2, (long)101, (long)202 }), "Clicking an app does not minimize apps in another workspace");
        Assert(!(bool)shouldMinimizePeer.Invoke(null, new object[] { 2, 2, (long)101, (long)101 }), "Clicking an app does not minimize itself");

        MethodInfo shouldMinimizePeerForFocus = focusPolicyType.GetMethod("ShouldMinimizePeerForApplicationFocus");
        Assert(shouldMinimizePeerForFocus != null, "Workspace focus policy exposes double-click peer minimization");
        if (shouldMinimizePeerForFocus == null)
        {
            return 1;
        }

        Assert((bool)shouldMinimizePeerForFocus.Invoke(null, new object[] { 2, 2, (long)101, (long)202 }), "Double-clicking an app keeps its workspace peers minimized");
        Assert(!(bool)shouldMinimizePeerForFocus.Invoke(null, new object[] { 2, 2, (long)101, (long)101 }), "Double-clicking an app keeps the selected app visible");
        Assert(!(bool)shouldMinimizePeerForFocus.Invoke(null, new object[] { 1, 2, (long)101, (long)202 }), "Double-clicking an app does not minimize another workspace");

        MethodInfo shouldMinimizeWorkspace = focusPolicyType.GetMethod("ShouldMinimizeAllForWorkspaceClick");
        Assert(shouldMinimizeWorkspace != null, "Workspace focus policy exposes the batch minimize decision");
        if (shouldMinimizeWorkspace == null)
        {
            return 1;
        }

        Assert((bool)shouldMinimizeWorkspace.Invoke(null, new object[] { 2, 2, (long)202 }), "Clicking a workspace minimizes every app in that workspace");
        Assert(!(bool)shouldMinimizeWorkspace.Invoke(null, new object[] { 1, 2, (long)202 }), "Clicking a workspace does not minimize apps in another workspace");
        Assert(!(bool)shouldMinimizeWorkspace.Invoke(null, new object[] { 2, 2, (long)0 }), "Batch minimize ignores an unassigned window handle");

        MethodInfo shouldMinimizePeerOnDisplay = focusPolicyType.GetMethod("ShouldMinimizePeerOnDisplay");
        Assert(shouldMinimizePeerOnDisplay != null, "Workspace focus policy exposes the same-display decision");
        if (shouldMinimizePeerOnDisplay == null)
        {
            return 1;
        }

        Assert((bool)shouldMinimizePeerOnDisplay.Invoke(null, new object[] { 2, 2, (long)101, (long)202, "\\\\.\\DISPLAY1", "\\\\.\\DISPLAY1" }), "Clicking an app minimizes peers on the same display");
        Assert(!(bool)shouldMinimizePeerOnDisplay.Invoke(null, new object[] { 2, 2, (long)101, (long)202, "\\\\.\\DISPLAY1", "\\\\.\\DISPLAY2" }), "Clicking an app leaves peers on another display unchanged");
        Assert(!(bool)shouldMinimizePeerOnDisplay.Invoke(null, new object[] { 2, 2, (long)101, (long)202, "", "\\\\.\\DISPLAY1" }), "Unknown display identity does not trigger extra minimization");

        Type displayFilterPolicyType = assembly.GetType("WorkspaceSwitcher.Core.DisplayFilterPolicy");
        Assert(displayFilterPolicyType != null, "Display filter policy type exists");
        if (displayFilterPolicyType == null)
        {
            return 1;
        }

        MethodInfo shouldHighlightForDisplay = displayFilterPolicyType.GetMethod("ShouldHighlight");
        Assert(shouldHighlightForDisplay != null, "Display filter policy exposes the highlight decision");
        if (shouldHighlightForDisplay == null)
        {
            return 1;
        }

        Assert((bool)shouldHighlightForDisplay.Invoke(null, new object[] { "", "\\\\.\\DISPLAY1" }), "All displays keeps each app highlighted");
        Assert((bool)shouldHighlightForDisplay.Invoke(null, new object[] { "\\\\.\\DISPLAY1", "\\\\.\\DISPLAY1" }), "Selected display highlights matching apps");
        Assert(!(bool)shouldHighlightForDisplay.Invoke(null, new object[] { "\\\\.\\DISPLAY1", "\\\\.\\DISPLAY2" }), "Selected display dims apps from another display");

        Type workspaceCardClickPolicyType = assembly.GetType("WorkspaceSwitcher.Core.WorkspaceCardClickPolicy");
        Assert(workspaceCardClickPolicyType != null, "Workspace card click policy type exists");
        if (workspaceCardClickPolicyType == null)
        {
            return 1;
        }

        MethodInfo shouldActivateWorkspaceCard = workspaceCardClickPolicyType.GetMethod("ShouldActivate");
        Assert(shouldActivateWorkspaceCard != null, "Workspace card click policy exposes the activation decision");
        if (shouldActivateWorkspaceCard == null)
        {
            return 1;
        }

        Assert((bool)shouldActivateWorkspaceCard.Invoke(null, new object[] { 3, 3 }), "A complete click on the pressed workspace activates it once");
        Assert(!(bool)shouldActivateWorkspaceCard.Invoke(null, new object[] { 3, 4 }), "Releasing over another workspace does not activate either workspace");
        Assert(!(bool)shouldActivateWorkspaceCard.Invoke(null, new object[] { 0, 3 }), "A click without a recorded workspace press does not activate a workspace");

        Type layoutType = assembly.GetType("WorkspaceSwitcher.Core.WorkspaceLayout");
        Assert(layoutType != null, "Dynamic workspace layout type exists");
        if (layoutType == null)
        {
            return 1;
        }

        MethodInfo createWorkspace = RequireMethod(layoutType, "CreateWorkspace", 0);
        MethodInfo getWorkspaceIds = RequireMethod(layoutType, "GetWorkspaceIds", 0);
        MethodInfo moveWorkspaceToIndex = RequireMethod(layoutType, "MoveWorkspaceToIndex", 2);
        MethodInfo removeWorkspace = RequireMethod(layoutType, "RemoveWorkspace", 1);
        PropertyInfo workspaceCount = layoutType.GetProperty("Count");
        Assert(createWorkspace != null && getWorkspaceIds != null && moveWorkspaceToIndex != null && removeWorkspace != null && workspaceCount != null, "Dynamic workspace layout APIs exist");
        if (createWorkspace == null || getWorkspaceIds == null || moveWorkspaceToIndex == null || removeWorkspace == null || workspaceCount == null)
        {
            return 1;
        }

        object layout = Activator.CreateInstance(layoutType);
        Assert((int)workspaceCount.GetValue(layout, null) == 1, "Only the default workspace exists initially");
        Assert((int)createWorkspace.Invoke(layout, null) == 2, "First new workspace follows the default workspace");
        Assert((int)createWorkspace.Invoke(layout, null) == 3, "Additional workspaces can be created");
        IList orderedWorkspaces = (IList)getWorkspaceIds.Invoke(layout, null);
        Assert((int)orderedWorkspaces[0] == 1 && (int)orderedWorkspaces[1] == 2 && (int)orderedWorkspaces[2] == 3, "New workspaces use the expected vertical order");
        moveWorkspaceToIndex.Invoke(layout, new object[] { 3, 1 });
        orderedWorkspaces = (IList)getWorkspaceIds.Invoke(layout, null);
        Assert((int)orderedWorkspaces[0] == 1 && (int)orderedWorkspaces[1] == 3 && (int)orderedWorkspaces[2] == 2, "Later workspaces can be reordered after the default workspace");
        for (int workspaceId = 4; workspaceId <= 9; workspaceId++)
        {
            createWorkspace.Invoke(layout, null);
        }
        Assert((int)workspaceCount.GetValue(layout, null) == 9 && (int)createWorkspace.Invoke(layout, null) == 0, "Workspace creation stops at nine workspaces");

        object deletionLayout = Activator.CreateInstance(layoutType);
        createWorkspace.Invoke(deletionLayout, null);
        createWorkspace.Invoke(deletionLayout, null);
        Assert(!(bool)removeWorkspace.Invoke(deletionLayout, new object[] { 1 }), "Default workspace cannot be deleted");
        Assert((bool)removeWorkspace.Invoke(deletionLayout, new object[] { 2 }), "A non-default workspace can be deleted");
        IList deletionIds = (IList)getWorkspaceIds.Invoke(deletionLayout, null);
        Assert(deletionIds.Count == 2 && (int)deletionIds[0] == 1 && (int)deletionIds[1] == 3, "Deleting a workspace preserves the remaining workspace order");
        Assert((int)createWorkspace.Invoke(deletionLayout, null) == 2, "Creating after deletion reuses the available workspace ID");

        Type workspaceDragPolicyType = assembly.GetType("WorkspaceSwitcher.Core.WorkspaceDragPolicy");
        Assert(workspaceDragPolicyType != null, "Workspace drag policy type exists");
        if (workspaceDragPolicyType == null)
        {
            return 1;
        }

        MethodInfo shouldStartReorder = workspaceDragPolicyType.GetMethod("ShouldStartReorder");
        Assert(shouldStartReorder != null, "Workspace drag threshold API exists");
        if (shouldStartReorder == null)
        {
            return 1;
        }

        Assert(!(bool)shouldStartReorder.Invoke(null, new object[] { 2, 3, 3 }), "Small pointer movement does not start card dragging");
        Assert((bool)shouldStartReorder.Invoke(null, new object[] { 2, 8, 0 }), "Card dragging starts after the pointer threshold");
        Assert(!(bool)shouldStartReorder.Invoke(null, new object[] { 1, 12, 0 }), "Default workspace is not draggable");

        Type catalogType = assembly.GetType("WorkspaceSwitcher.Core.WorkspaceCatalog");
        Assert(catalogType != null, "WorkspaceCatalog type exists");
        if (catalogType == null)
        {
            return 1;
        }

        object catalog = Activator.CreateInstance(catalogType);
        MethodInfo assignWindow = RequireMethod(catalogType, "AssignWindow", 5);
        MethodInfo getItems = RequireMethod(catalogType, "GetWorkspaceItems", 1);
        MethodInfo moveWindow = RequireMethod(catalogType, "MoveWindow", 2);
        MethodInfo moveWorkspaceItems = RequireMethod(catalogType, "MoveWorkspaceItems", 2);
        MethodInfo removeWindow = RequireMethod(catalogType, "RemoveWindow", 1);
        MethodInfo rebindWindow = RequireMethod(catalogType, "RebindWindow", 2);
        MethodInfo setWindowMaximized = RequireMethod(catalogType, "SetWindowMaximized", 2);
        MethodInfo getWindowWorkspaceId = RequireMethod(catalogType, "GetWindowWorkspaceId", 1);
        Assert(assignWindow != null, "AssignWindow API exists");
        Assert(getItems != null, "GetWorkspaceItems API exists");
        Assert(moveWindow != null, "MoveWindow API exists");
        Assert(moveWorkspaceItems != null, "Workspace items can be moved in one operation");
        Assert(removeWindow != null, "RemoveWindow API exists");
        Assert(rebindWindow != null, "RebindWindow API exists for restarted applications");
        Assert(setWindowMaximized != null, "SetWindowMaximized API exists");
        Assert(getWindowWorkspaceId != null, "Window workspace lookup API exists");
        if (assignWindow == null || getItems == null || moveWindow == null || moveWorkspaceItems == null || removeWindow == null || rebindWindow == null || setWindowMaximized == null || getWindowWorkspaceId == null)
        {
            return 1;
        }

        assignWindow.Invoke(catalog, new object[] { 2, (long)101, "FrontStore - Visual Studio Code", "Code.exe", "code C:\\Work\\FrontStore" });
        Assert((int)getWindowWorkspaceId.Invoke(catalog, new object[] { (long)101 }) == 2, "Assigned window resolves to its workspace");
        Assert((int)getWindowWorkspaceId.Invoke(catalog, new object[] { (long)999 }) == 0, "Unassigned window has no workspace");
        IEnumerable workspaceTwo = (IEnumerable)getItems.Invoke(catalog, new object[] { 2 });
        object item = First(workspaceTwo);
        Assert(item != null, "Assigned window appears in selected workspace");
        if (item != null)
        {
            PropertyInfo displayName = item.GetType().GetProperty("DisplayName");
            Assert(displayName != null && (string)displayName.GetValue(item, null) == "VS Code — FrontStore", "VS Code shows the project folder name beside the app name");
            setWindowMaximized.Invoke(catalog, new object[] { (long)101, true });
            PropertyInfo isMaximized = item.GetType().GetProperty("IsMaximized");
            Assert(isMaximized != null && (bool)isMaximized.GetValue(item, null), "Workspace records a maximized window state");
        }

        moveWindow.Invoke(catalog, new object[] { (long)101, 1 });
        Assert(First((IEnumerable)getItems.Invoke(catalog, new object[] { 2 })) == null, "Moving removes window from old workspace");
        Assert(First((IEnumerable)getItems.Invoke(catalog, new object[] { 1 })) != null, "Moving adds window to new workspace");

        removeWindow.Invoke(catalog, new object[] { (long)101 });
        Assert(First((IEnumerable)getItems.Invoke(catalog, new object[] { 1 })) == null, "Removing clears the window assignment");

        assignWindow.Invoke(catalog, new object[] { 2, (long)707, "重启后的窗口", "sample.exe", "" });
        Assert((bool)rebindWindow.Invoke(catalog, new object[] { (long)707, (long)708 }), "A restarted application can rebind its saved window handle");
        Assert((int)getWindowWorkspaceId.Invoke(catalog, new object[] { (long)707 }) == 0 && (int)getWindowWorkspaceId.Invoke(catalog, new object[] { (long)708 }) == 2, "Rebinding replaces the stale handle without losing the workspace");

        assignWindow.Invoke(catalog, new object[] { 2, (long)202, "项目看板 - Google Chrome", "chrome.exe", "" });
        object browserItem = First((IEnumerable)getItems.Invoke(catalog, new object[] { 2 }));
        Assert(browserItem != null && (string)browserItem.GetType().GetProperty("DisplayName").GetValue(browserItem, null) == "Google Chrome — 项目看板", "Browser puts the app name before the page title");

        assignWindow.Invoke(catalog, new object[] { 3, (long)303, "项目资料", "explorer.exe", "" });
        object explorerItem = First((IEnumerable)getItems.Invoke(catalog, new object[] { 3 }));
        Assert(explorerItem != null && (string)explorerItem.GetType().GetProperty("DisplayName").GetValue(explorerItem, null) == "文件资源管理器 — 项目资料", "File Explorer puts the app name before the folder title");

        assignWindow.Invoke(catalog, new object[] { 3, (long)304, "另一个窗口", "notepad.exe", "" });
        Assert((int)moveWorkspaceItems.Invoke(catalog, new object[] { 3, 1 }) == 2, "Deleting a workspace can transfer every app to the default workspace");
        Assert(First((IEnumerable)getItems.Invoke(catalog, new object[] { 3 })) == null, "Transferred apps leave the deleted workspace");
        Assert((int)getWindowWorkspaceId.Invoke(catalog, new object[] { (long)303 }) == 1 && (int)getWindowWorkspaceId.Invoke(catalog, new object[] { (long)304 }) == 1, "Transferred apps retain assignments in the default workspace");

        Type stateStoreType = assembly.GetType("WorkspaceSwitcher.Core.WorkspaceStateStore");
        Type snapshotType = assembly.GetType("WorkspaceSwitcher.Core.WorkspaceStateSnapshot");
        Type itemSnapshotType = assembly.GetType("WorkspaceSwitcher.Core.WorkspaceItemSnapshot");
        Assert(stateStoreType != null && snapshotType != null && itemSnapshotType != null, "Workspace state persistence types exist");
        if (stateStoreType != null && snapshotType != null && itemSnapshotType != null)
        {
            MethodInfo serialize = stateStoreType.GetMethod("Serialize", BindingFlags.Public | BindingFlags.Static);
            MethodInfo deserialize = stateStoreType.GetMethod("Deserialize", BindingFlags.Public | BindingFlags.Static);
            Assert(serialize != null && deserialize != null, "Workspace state can be serialized and restored");
            if (serialize != null && deserialize != null)
            {
                object snapshot = Activator.CreateInstance(snapshotType);
                IList<int> snapshotIds = (IList<int>)snapshotType.GetProperty("WorkspaceIds").GetValue(snapshot, null);
                snapshotIds.Add(1);
                snapshotIds.Add(2);
                Type heightSnapshotType = assembly.GetType("WorkspaceSwitcher.Core.WorkspaceHeightSnapshot");
                Assert(heightSnapshotType != null, "Workspace height state type exists");
                if (heightSnapshotType != null)
                {
                    object heightSnapshot = Activator.CreateInstance(heightSnapshotType);
                    heightSnapshotType.GetProperty("WorkspaceId").SetValue(heightSnapshot, 2, null);
                    heightSnapshotType.GetProperty("Height").SetValue(heightSnapshot, 140, null);
                    System.Collections.IList snapshotHeights = (System.Collections.IList)snapshotType.GetProperty("Heights").GetValue(snapshot, null);
                    snapshotHeights.Add(heightSnapshot);
                }
                object itemSnapshot = Activator.CreateInstance(itemSnapshotType);
                itemSnapshotType.GetProperty("WindowHandle").SetValue(itemSnapshot, 1234L, null);
                itemSnapshotType.GetProperty("WorkspaceId").SetValue(itemSnapshot, 2, null);
                itemSnapshotType.GetProperty("DisplayName").SetValue(itemSnapshot, "VS Code — fugle", null);
                System.Collections.IList snapshotItems = (System.Collections.IList)snapshotType.GetProperty("Items").GetValue(snapshot, null);
                snapshotItems.Add(itemSnapshot);
                string serialized = (string)serialize.Invoke(null, new object[] { snapshot });
                object restored = deserialize.Invoke(null, new object[] { serialized });
                IList<int> restoredIds = (IList<int>)snapshotType.GetProperty("WorkspaceIds").GetValue(restored, null);
                System.Collections.IList restoredItems = (System.Collections.IList)snapshotType.GetProperty("Items").GetValue(restored, null);
                System.Collections.IList restoredHeights = (System.Collections.IList)snapshotType.GetProperty("Heights").GetValue(restored, null);
                Assert(restoredIds.Count == 2 && restoredIds[1] == 2 && restoredItems.Count == 1 && restoredHeights.Count == 1, "Workspace state round-trips without losing app assignments");
                if (restoredHeights.Count == 1)
                {
                    object restoredHeight = restoredHeights[0];
                    Assert((int)restoredHeight.GetType().GetProperty("Height").GetValue(restoredHeight, null) == 140, "Workspace card height is persisted");
                }

                snapshotType.GetProperty("PanelX").SetValue(snapshot, 120, null);
                snapshotType.GetProperty("PanelY").SetValue(snapshot, 80, null);
                snapshotType.GetProperty("PanelWidth").SetValue(snapshot, 420, null);
                snapshotType.GetProperty("PanelHeight").SetValue(snapshot, 600, null);
                string panelSerialized = (string)serialize.Invoke(null, new object[] { snapshot });
                object panelRestored = deserialize.Invoke(null, new object[] { panelSerialized });
                Assert((int)snapshotType.GetProperty("PanelX").GetValue(panelRestored, null) == 120 &&
                       (int)snapshotType.GetProperty("PanelY").GetValue(panelRestored, null) == 80 &&
                       (int)snapshotType.GetProperty("PanelWidth").GetValue(panelRestored, null) == 420 &&
                       (int)snapshotType.GetProperty("PanelHeight").GetValue(panelRestored, null) == 600,
                       "Workspace panel position and size are persisted");
            }
        }

        Type resizePolicyType = assembly.GetType("WorkspaceSwitcher.Core.WorkspaceResizePolicy");
        Assert(resizePolicyType != null, "Workspace card resize policy exists");
        if (resizePolicyType != null)
        {
            MethodInfo clampHeight = resizePolicyType.GetMethod("ClampHeight");
            Assert(clampHeight != null, "Workspace card height can be clamped");
            if (clampHeight != null)
            {
                Assert((int)clampHeight.Invoke(null, new object[] { 40 }) == 76, "Workspace card resize has a minimum height");
                Assert((int)clampHeight.Invoke(null, new object[] { 300 }) == 240, "Workspace card resize has a maximum height");
                Assert((int)clampHeight.Invoke(null, new object[] { 140 }) == 140, "Workspace card resize keeps values inside the range");
            }
        }

        return failures == 0 ? 0 : 1;
    }
}
