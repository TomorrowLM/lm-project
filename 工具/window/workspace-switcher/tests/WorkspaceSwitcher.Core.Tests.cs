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
        MethodInfo isChromeTitleBarPoint = dragPreviewPolicyType.GetMethod("IsChromeTitleBarPoint");
        MethodInfo getPreviewLeft = dragPreviewPolicyType.GetMethod("GetPreviewLeft");
        MethodInfo getPreviewTop = dragPreviewPolicyType.GetMethod("GetPreviewTop");
        Assert(isTitleBarPoint != null && isChromeTitleBarPoint != null && getPreviewLeft != null && getPreviewTop != null, "Drag preview policy APIs exist");
        if (isTitleBarPoint == null || isChromeTitleBarPoint == null || getPreviewLeft == null || getPreviewTop == null)
        {
            return 1;
        }

        Assert((bool)isTitleBarPoint.Invoke(null, new object[] { 112, 100, 138 }), "Only a title-bar drag starts the preview");
        Assert(!(bool)isTitleBarPoint.Invoke(null, new object[] { 150, 100, 138 }), "A client-area click does not start the preview");
        Assert((bool)isTitleBarPoint.Invoke(null, new object[] { 125, 100, 100 }), "Custom title bars use the top drag zone");
        Assert(!(bool)isTitleBarPoint.Invoke(null, new object[] { 155, 100, 100 }), "Custom title-bar drag zone has a fixed lower bound");
        Assert((bool)isChromeTitleBarPoint.Invoke(null, new object[] { 180, 100, 100 }), "Chrome tab and title controls use the expanded top drag zone");
        Assert(!(bool)isChromeTitleBarPoint.Invoke(null, new object[] { 197, 100, 100 }), "Chrome content below the expanded top drag zone is not treated as a window drag");
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

        MethodInfo shouldProcessForegroundEvent = foregroundPolicyType.GetMethod("ShouldProcessWindowEvent");
        Assert(shouldProcessForegroundEvent != null, "Foreground activation can reject stale queued events");
        if (shouldProcessForegroundEvent != null)
        {
            Assert((bool)shouldProcessForegroundEvent.Invoke(null, new object[] { (long)101, (long)101 }), "The current foreground event is processed");
            Assert(!(bool)shouldProcessForegroundEvent.Invoke(null, new object[] { (long)101, (long)202 }), "A queued event for an old window is ignored");
            Assert(!(bool)shouldProcessForegroundEvent.Invoke(null, new object[] { (long)101, (long)0 }), "An event is ignored when no foreground window is available");
        }

        Type foregroundRecoveryPolicyType = assembly.GetType("WorkspaceSwitcher.Core.ForegroundWindowRecoveryPolicy");
        Assert(foregroundRecoveryPolicyType != null, "Foreground window recovery policy exists");
        if (foregroundRecoveryPolicyType == null)
        {
            return 1;
        }

        MethodInfo shouldUseOnlyProcessMatch = foregroundRecoveryPolicyType.GetMethod("ShouldUseOnlyProcessMatch");
        Assert(shouldUseOnlyProcessMatch != null, "Foreground window recovery policy API exists");
        if (shouldUseOnlyProcessMatch == null)
        {
            return 1;
        }

        Assert((bool)shouldUseOnlyProcessMatch.Invoke(null, new object[] { 1, 1, 1 }), "A sole live process window can recover by process identity");
        Assert(!(bool)shouldUseOnlyProcessMatch.Invoke(null, new object[] { 1, 1, 2 }), "Multiple live VS Code windows cannot recover by process identity alone");
        Assert(!(bool)shouldUseOnlyProcessMatch.Invoke(null, new object[] { 2, 1, 1 }), "Multiple saved windows cannot recover by process identity alone");

        Type windowRecoveryPolicyType = assembly.GetType("WorkspaceSwitcher.Core.WorkspaceWindowRecoveryPolicy");
        Assert(windowRecoveryPolicyType != null, "Workspace window recovery policy exists");
        if (windowRecoveryPolicyType != null)
        {
            MethodInfo shouldUseUniqueCandidate = windowRecoveryPolicyType.GetMethod("ShouldUseUniqueCandidate");
            Assert(shouldUseUniqueCandidate != null, "Workspace window recovery policy API exists");
            if (shouldUseUniqueCandidate != null)
            {
                Assert((bool)shouldUseUniqueCandidate.Invoke(null, new object[] { 1 }), "A unique title or launch-profile match can recover");
                Assert(!(bool)shouldUseUniqueCandidate.Invoke(null, new object[] { 2 }), "Duplicate title matches cannot recover by title alone");
            }

            MethodInfo shouldScanLaunchProfile = windowRecoveryPolicyType.GetMethod("ShouldScanLaunchProfile");
            Assert(shouldScanLaunchProfile != null, "Workspace window recovery can gate the expensive launch-profile scan");
            if (shouldScanLaunchProfile != null)
            {
                Assert(!(bool)shouldScanLaunchProfile.Invoke(null, new object[] { 1 }), "A unique title match skips the expensive launch-profile scan");
                Assert((bool)shouldScanLaunchProfile.Invoke(null, new object[] { 0 }), "No title match still allows launch-profile recovery");
                Assert((bool)shouldScanLaunchProfile.Invoke(null, new object[] { 2 }), "Duplicate title matches still allow launch-profile recovery");
            }
        }

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

        Assert(!(bool)shouldMinimizePeer.Invoke(null, new object[] { 2, 2, (long)101, (long)202 }), "Clicking an app leaves other apps in the same workspace unchanged");
        Assert(!(bool)shouldMinimizePeer.Invoke(null, new object[] { 1, 2, (long)101, (long)202 }), "Clicking an app does not minimize apps in another workspace");
        Assert(!(bool)shouldMinimizePeer.Invoke(null, new object[] { 2, 2, (long)101, (long)101 }), "Clicking an app does not minimize itself");

        MethodInfo shouldMinimizePeerForFocus = focusPolicyType.GetMethod("ShouldMinimizePeerForApplicationFocus");
        Assert(shouldMinimizePeerForFocus != null, "Workspace focus policy exposes double-click peer minimization");
        if (shouldMinimizePeerForFocus == null)
        {
            return 1;
        }

        Assert(!(bool)shouldMinimizePeerForFocus.Invoke(null, new object[] { 2, 2, (long)101, (long)202 }), "Double-clicking an app must not minimize workspace peers");
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

        Assert(!(bool)shouldMinimizePeerOnDisplay.Invoke(null, new object[] { 2, 2, (long)101, (long)202, "\\\\.\\DISPLAY1", "\\\\.\\DISPLAY1" }), "The first click of an app double-click must not minimize same-display peers");
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
        MethodInfo shouldMinimizeWorkspaceCard = workspaceCardClickPolicyType.GetMethod("ShouldMinimize");
        Assert(shouldMinimizeWorkspaceCard != null, "Workspace minimization requires an explicit click-count decision");
        if (shouldMinimizeWorkspaceCard != null)
        {
            Assert(!(bool)shouldMinimizeWorkspaceCard.Invoke(null, new object[] { 2, 2, 1 }), "Single workspace click never minimizes applications");
            Assert((bool)shouldMinimizeWorkspaceCard.Invoke(null, new object[] { 2, 2, 2 }), "Double workspace click minimizes its applications");
            Assert(!(bool)shouldMinimizeWorkspaceCard.Invoke(null, new object[] { 2, 3, 2 }), "Double-click crossing workspace cards does not minimize");
            Assert(!(bool)shouldMinimizeWorkspaceCard.Invoke(null, new object[] { 0, 0, 2 }), "Double-click outside workspace cards does not minimize");
        }
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
        MethodInfo setWindowUserMinimized = RequireMethod(catalogType, "SetWindowUserMinimized", 2);
        MethodInfo setLaunchProfile = RequireMethod(catalogType, "SetLaunchProfile", 3);
        MethodInfo getWindowWorkspaceId = RequireMethod(catalogType, "GetWindowWorkspaceId", 1);
        Assert(assignWindow != null, "AssignWindow API exists");
        Assert(getItems != null, "GetWorkspaceItems API exists");
        Assert(moveWindow != null, "MoveWindow API exists");
        Assert(moveWorkspaceItems != null, "Workspace items can be moved in one operation");
        Assert(removeWindow != null, "RemoveWindow API exists");
        Assert(rebindWindow != null, "RebindWindow API exists for restarted applications");
        Assert(setWindowMaximized != null, "SetWindowMaximized API exists");
        Assert(setWindowUserMinimized != null, "Workspace can record a user-minimized window");
        Assert(setLaunchProfile != null, "SetLaunchProfile API exists");
        Assert(getWindowWorkspaceId != null, "Window workspace lookup API exists");
        if (assignWindow == null || getItems == null || moveWindow == null || moveWorkspaceItems == null || removeWindow == null || rebindWindow == null || setWindowMaximized == null || setLaunchProfile == null || getWindowWorkspaceId == null)
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
            PropertyInfo isUserMinimized = item.GetType().GetProperty("IsUserMinimized");
            Assert(isUserMinimized != null && !(bool)isUserMinimized.GetValue(item, null), "New window assignments are not user-minimized by default");
            if (setWindowUserMinimized != null)
            {
                setWindowUserMinimized.Invoke(catalog, new object[] { (long)101, true });
                Assert(isUserMinimized != null && (bool)isUserMinimized.GetValue(item, null), "Workspace records an externally minimized window");
            }
            setLaunchProfile.Invoke(catalog, new object[]
            {
                (long)101,
                "--new-window \"D:\\孚嘉\\code\\yqa.code-workspace\"",
                "D:\\software\\front\\Microsoft VS Code"
            });
            PropertyInfo launchArguments = item.GetType().GetProperty("LaunchArguments");
            PropertyInfo workingDirectory = item.GetType().GetProperty("WorkingDirectory");
            Assert(launchArguments != null && (string)launchArguments.GetValue(item, null) == "--new-window \"D:\\孚嘉\\code\\yqa.code-workspace\"",
                "Each window retains its own launch arguments");
            Assert(workingDirectory != null && (string)workingDirectory.GetValue(item, null) == "D:\\software\\front\\Microsoft VS Code",
                "Each window retains its working directory");
        }

        Type launchParserType = assembly.GetType("WorkspaceSwitcher.Core.WorkspaceLaunchProfileParser");
        Assert(launchParserType != null, "Workspace launch profile parser exists");
        if (launchParserType != null)
        {
            MethodInfo extractArguments = launchParserType.GetMethod("ExtractArguments", BindingFlags.Public | BindingFlags.Static);
            MethodInfo getWorkingDirectory = launchParserType.GetMethod("GetWorkingDirectory", BindingFlags.Public | BindingFlags.Static);
            Assert(extractArguments != null && getWorkingDirectory != null, "Workspace launch profile parser APIs exist");
            if (extractArguments != null && getWorkingDirectory != null)
            {
                string codeArguments = (string)extractArguments.Invoke(null, new object[]
                {
                    "\"D:\\software\\front\\Microsoft VS Code\\Code.exe\" --new-window \"D:\\孚嘉\\code\\yqa.code-workspace\"",
                    "D:\\software\\front\\Microsoft VS Code\\Code.exe"
                });
                Assert(codeArguments == "--new-window \"D:\\孚嘉\\code\\yqa.code-workspace\"",
                    "Launch parser preserves a quoted VS Code workspace argument");
                string workingPath = (string)getWorkingDirectory.Invoke(null, new object[]
                {
                    "D:\\software\\front\\Microsoft VS Code\\Code.exe"
                });
                Assert(workingPath == "D:\\software\\front\\Microsoft VS Code",
                    "Launch parser derives the executable working directory");
            }
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
                itemSnapshotType.GetProperty("LaunchArguments").SetValue(itemSnapshot, "--new-window \"D:\\孚嘉\\code\\yqa.code-workspace\"", null);
                itemSnapshotType.GetProperty("WorkingDirectory").SetValue(itemSnapshot, "D:\\software\\front\\Microsoft VS Code", null);
                PropertyInfo snapshotIsUserMinimized = itemSnapshotType.GetProperty("IsUserMinimized");
                Assert(snapshotIsUserMinimized != null, "Window snapshot exposes user-minimized state");
                if (snapshotIsUserMinimized != null)
                {
                    snapshotIsUserMinimized.SetValue(itemSnapshot, true, null);
                }
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
                if (restoredItems.Count == 1)
                {
                    object restoredItem = restoredItems[0];
                    Assert((string)restoredItem.GetType().GetProperty("LaunchArguments").GetValue(restoredItem, null) == "--new-window \"D:\\孚嘉\\code\\yqa.code-workspace\"",
                        "Workspace state persists per-window launch arguments");
                    Assert((string)restoredItem.GetType().GetProperty("WorkingDirectory").GetValue(restoredItem, null) == "D:\\software\\front\\Microsoft VS Code",
                        "Workspace state persists per-window working directory");
                    PropertyInfo restoredIsUserMinimized = restoredItem.GetType().GetProperty("IsUserMinimized");
                    Assert(restoredIsUserMinimized != null && (bool)restoredIsUserMinimized.GetValue(restoredItem, null),
                        "Workspace state persists a user-minimized window");
                }

                object legacyRestored = deserialize.Invoke(null, new object[]
                {
                    "<workspaceState><workspaces><workspace id=\"1\" /></workspaces><items><item handle=\"1234\" workspace=\"1\" maximized=\"false\"><title>Legacy</title><process>legacy.exe</process></item></items></workspaceState>"
                });
                System.Collections.IList legacyItems = (System.Collections.IList)snapshotType.GetProperty("Items").GetValue(legacyRestored, null);
                PropertyInfo legacyIsUserMinimized = itemSnapshotType.GetProperty("IsUserMinimized");
                Assert(legacyItems.Count == 1 && legacyIsUserMinimized != null && !(bool)legacyIsUserMinimized.GetValue(legacyItems[0], null),
                    "Legacy workspace state without minimized attribute defaults to normal");

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

        Type windowStatePolicyType = assembly.GetType("WorkspaceSwitcher.Core.WorkspaceWindowStatePolicy");
        Assert(windowStatePolicyType != null, "Workspace window state policy exists");
        if (windowStatePolicyType != null)
        {
            MethodInfo applyMinimizeEvent = windowStatePolicyType.GetMethod("ApplyMinimizeEvent", BindingFlags.Public | BindingFlags.Static);
            MethodInfo shouldShowMinimized = windowStatePolicyType.GetMethod("ShouldShowMinimized", BindingFlags.Public | BindingFlags.Static);
            Assert(applyMinimizeEvent != null && shouldShowMinimized != null, "Window state policy exposes event and activation decisions");
            if (applyMinimizeEvent != null && shouldShowMinimized != null)
            {
                Assert((bool)applyMinimizeEvent.Invoke(null, new object[] { false, true, false }), "An external minimize event is recorded");
                Assert(!(bool)applyMinimizeEvent.Invoke(null, new object[] { true, false, false }), "An external restore event clears the minimized state");
                Assert(!(bool)applyMinimizeEvent.Invoke(null, new object[] { false, true, true }), "WorkspaceSwitcher minimize events are not recorded as user minimization");
                Assert((bool)shouldShowMinimized.Invoke(null, new object[] { true, false }), "Workspace switching preserves a user's minimized state");
                Assert(!(bool)shouldShowMinimized.Invoke(null, new object[] { true, true }), "Explicitly opening an app overrides its minimized state");
                Assert(!(bool)shouldShowMinimized.Invoke(null, new object[] { false, false }), "Ordinary windows follow their saved normal or maximized state");
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

        Type dpiLayoutType = assembly.GetType("WorkspaceSwitcher.Core.DpiLayoutPolicy");
        Assert(dpiLayoutType != null, "DPI layout policy type exists");
        if (dpiLayoutType != null)
        {
            MethodInfo scaleValue = dpiLayoutType.GetMethod("ScaleValue");
            MethodInfo unscaleValue = dpiLayoutType.GetMethod("UnscaleValue");
            MethodInfo scaleFontSize = dpiLayoutType.GetMethod("ScaleFontSize");
            Assert(scaleValue != null && unscaleValue != null && scaleFontSize != null, "DPI layout policy exposes reversible layout and font scaling");
            if (scaleValue != null && unscaleValue != null)
            {
                Assert((int)scaleValue.Invoke(null, new object[] { 520, 96 }) == 520, "Base DPI keeps the design size");
                Assert((int)scaleValue.Invoke(null, new object[] { 520, 192 }) == 1040, "High DPI scales the design size");
                Assert((int)unscaleValue.Invoke(null, new object[] { 1040, 192 }) == 520, "Device size converts back to the design size");
                Assert(scaleFontSize != null && Math.Abs((float)scaleFontSize.Invoke(null, new object[] { 16f, 96 }) - 16f) < 0.01f, "Base DPI keeps the logical font size");
                Assert(scaleFontSize != null && Math.Abs((float)scaleFontSize.Invoke(null, new object[] { 16f, 192 }) - 8f) < 0.01f, "High DPI compensates the transformed font size");
            }
        }

        return failures == 0 ? 0 : 1;
    }
}
