using System;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;

internal static class WorkspaceSwitcherAppTests
{
    private static int failures;

    private static void Assert(bool condition, string name)
    {
        Console.WriteLine((condition ? "PASS " : "FAIL ") + name);
        if (!condition)
        {
            failures++;
        }
    }

    public static int Main(string[] args)
    {
        string applicationPath = args.Length >= 1
            ? args[0]
            : Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "WorkspaceSwitcher.exe");

        Assert(File.Exists(applicationPath), "Workspace switcher application is built");
        if (!File.Exists(applicationPath))
        {
            return 1;
        }

        Assembly application = Assembly.LoadFrom(applicationPath);
        Type layoutType = application.GetType("WorkspaceSwitcher.App.WorkspacePanelLayout");
        Type formType = application.GetType("WorkspaceSwitcher.App.WorkspaceForm");
        Type previewType = application.GetType("WorkspaceSwitcher.App.DragPreviewForm");
        Type workspaceGhostType = application.GetType("WorkspaceSwitcher.App.WorkspaceDragGhostForm");
        Type visualMetricsType = application.GetType("WorkspaceSwitcher.App.WorkspaceVisualMetrics");
        Type menuPlacementType = application.GetType("WorkspaceSwitcher.App.DisplayMenuPlacementPolicy");
        Type glassBackdropType = application.GetType("WorkspaceSwitcher.App.GlassWindowBackdrop");
        Assert(layoutType != null, "Right panel layout type exists");
        Assert(formType != null, "Workspace panel form exists");
        Assert(previewType != null, "Topmost drag preview form exists");
        Assert(workspaceGhostType != null, "Workspace card drag ghost form exists");
        Assert(visualMetricsType != null, "Workspace visual metrics are centralized");
        Assert(menuPlacementType != null, "Display context menu has a reusable placement policy");
        Assert(glassBackdropType != null, "Workspace panel has a native DWM glass renderer");
        if (layoutType == null)
        {
            return 1;
        }

        if (menuPlacementType != null)
        {
            MethodInfo placement = menuPlacementType.GetMethod(
                "GetLocation",
                BindingFlags.Public | BindingFlags.Static,
                null,
                new Type[] { typeof(Point), typeof(Size), typeof(Rectangle), typeof(int) },
                null);
            Assert(placement != null, "Display context menu placement exposes a pure calculation");
            if (placement != null)
            {
                Point location = (Point)placement.Invoke(null, new object[]
                {
                    new Point(1900, 1060),
                    new Size(220, 52),
                    new Rectangle(0, 0, 1920, 1080),
                    10
                });
                Assert(location.X == 1670 && location.Y == 998, "Display context menu flips away from the bottom-right edge");
            }

            MethodInfo targetPlacement = menuPlacementType.GetMethod(
                "GetLocation",
                BindingFlags.Public | BindingFlags.Static,
                null,
                new Type[] { typeof(Point), typeof(Size), typeof(Rectangle), typeof(Rectangle), typeof(int) },
                null);
            Assert(targetPlacement != null, "Display context menu placement understands the clicked app bounds");
            if (targetPlacement != null)
            {
                try
                {
                    Point location = (Point)targetPlacement.Invoke(null, new object[]
                    {
                        new Point(1850, 1020),
                        new Size(220, 52),
                        new Rectangle(1800, 1000, 80, 40),
                        new Rectangle(0, 0, 1920, 1080),
                        10
                    });
                    Assert(location.X == 1570 && location.Y == 1000, "Display context menu avoids covering the clicked app when the right side is tight");
                }
                catch (Exception exception)
                {
                    Console.WriteLine("ERROR target placement " + exception.GetType().FullName + " base=" + exception.GetBaseException().GetType().FullName + " message=" + exception.Message);
                    failures++;
                }
            }
        }

        MethodInfo topRightPlacement = layoutType.GetMethod("GetTopRightBounds", BindingFlags.Public | BindingFlags.Static);
        MethodInfo clampPanelSize = layoutType.GetMethod("ClampPanelSize", BindingFlags.Public | BindingFlags.Static);
        MethodInfo panelResizeHitTest = layoutType.GetMethod("GetResizeEdgeAt", BindingFlags.Public | BindingFlags.Static);
        Assert(topRightPlacement != null, "Panel can calculate a top-right floating position");
        Assert(clampPanelSize != null, "Panel size can be clamped safely");
        Assert(panelResizeHitTest != null, "Panel exposes edge resize hit-testing");
        if (topRightPlacement != null)
        {
            Rectangle bounds = (Rectangle)topRightPlacement.Invoke(null, new object[] { new Rectangle(0, 0, 1920, 1080), new Size(620, 600) });
            Assert(bounds.Left == 1300 && bounds.Top == 0, "Floating panel is placed at the top-right");
        }

        MethodInfo keepWithinWorkingArea = layoutType.GetMethod("KeepWithinWorkingArea", BindingFlags.Public | BindingFlags.Static);
        Assert(keepWithinWorkingArea != null, "DPI repositioning has a reusable working-area clamp");
        if (keepWithinWorkingArea != null)
        {
            Rectangle bounds = (Rectangle)keepWithinWorkingArea.Invoke(null, new object[]
            {
                new Rectangle(-1900, -40, 300, 200),
                new Size(700, 600),
                new Rectangle(-1920, 30, 1600, 850)
            });
            Assert(bounds == new Rectangle(-1900, 30, 700, 600), "DPI repositioning preserves the suggested position on a negative-origin display");
        }

        MethodInfo mapWindowBounds = formType.GetMethod("MapWindowBoundsToDisplay", BindingFlags.NonPublic | BindingFlags.Static);
        Assert(mapWindowBounds != null, "Cross-display window movement exposes a reusable bounds mapping");
        if (mapWindowBounds != null)
        {
            Rectangle mapped = (Rectangle)mapWindowBounds.Invoke(null, new object[]
            {
                new Rectangle(960, 100, 600, 600),
                new Rectangle(0, 0, 1920, 1080),
                new Rectangle(-1280, 0, 1280, 720)
            });
            Assert(mapped.Left >= -1280 && mapped.Right <= 0 && mapped.Top >= 0 && mapped.Bottom <= 720,
                "Cross-display window bounds remain inside a negative-origin monitor");
        }

        MethodInfo exitAndRestore = formType.GetMethod("ExitAndRestore", BindingFlags.NonPublic | BindingFlags.Instance);
        Assert(exitAndRestore != null, "Panel provides a restore-before-exit path");

        MethodInfo foregroundHandler = formType.GetMethod("HandleForegroundWindow", BindingFlags.NonPublic | BindingFlags.Instance);
        MethodInfo captureWindow = formType.GetMethod("CaptureWindow", BindingFlags.NonPublic | BindingFlags.Static);
        Assert(foregroundHandler != null, "Panel handles foreground activation from docks and taskbar");
        Assert(captureWindow != null, "Panel captures a window for the drag preview");

        Type nativeType = application.GetType("WorkspaceSwitcher.App.NativeMethods");
        Assert(nativeType != null && nativeType.GetMethod("SetWinEventHook", BindingFlags.NonPublic | BindingFlags.Static) != null, "Native foreground event hook is available");
        Assert(nativeType != null && nativeType.GetMethod("PrintWindow", BindingFlags.NonPublic | BindingFlags.Static) != null, "Preview uses window rendering instead of desktop capture");
        Type windowPlacementType = nativeType == null ? null : nativeType.GetNestedType("WindowPlacement", BindingFlags.NonPublic);
        Assert(windowPlacementType != null && Marshal.SizeOf(windowPlacementType) == 44, "Native window placement layout matches the Windows structure size");
        MethodInfo readSuggestedDpiBounds = formType.GetMethod("GetSuggestedDpiBounds", BindingFlags.NonPublic | BindingFlags.Static);
        Assert(readSuggestedDpiBounds != null, "Panel can read the suggested rectangle from WM_DPICHANGED");
        if (readSuggestedDpiBounds != null && nativeType != null)
        {
            Type rectType = nativeType.GetNestedType("Rect", BindingFlags.NonPublic);
            IntPtr rectangleMemory = Marshal.AllocHGlobal(Marshal.SizeOf(rectType));
            try
            {
                object nativeRect = Activator.CreateInstance(rectType, true);
                rectType.GetField("Left", BindingFlags.NonPublic | BindingFlags.Instance).SetValue(nativeRect, -1920);
                rectType.GetField("Top", BindingFlags.NonPublic | BindingFlags.Instance).SetValue(nativeRect, 40);
                rectType.GetField("Right", BindingFlags.NonPublic | BindingFlags.Instance).SetValue(nativeRect, -1000);
                rectType.GetField("Bottom", BindingFlags.NonPublic | BindingFlags.Instance).SetValue(nativeRect, 840);
                Marshal.StructureToPtr(nativeRect, rectangleMemory, false);
                Rectangle suggested = (Rectangle)readSuggestedDpiBounds.Invoke(null, new object[] { rectangleMemory });
                Assert(suggested == new Rectangle(-1920, 40, 920, 800), "DPI suggested rectangle preserves negative monitor coordinates");
            }
            finally
            {
                Marshal.FreeHGlobal(rectangleMemory);
            }
        }
        FieldInfo minimizeStartEvent = nativeType == null ? null : nativeType.GetField("EVENT_SYSTEM_MINIMIZESTART", BindingFlags.NonPublic | BindingFlags.Static);
        FieldInfo minimizeEndEvent = nativeType == null ? null : nativeType.GetField("EVENT_SYSTEM_MINIMIZEEND", BindingFlags.NonPublic | BindingFlags.Static);
        Assert(minimizeStartEvent != null && Convert.ToUInt32(minimizeStartEvent.GetRawConstantValue()) == 0x0016, "Windows minimize-start event is configured");
        Assert(minimizeEndEvent != null && Convert.ToUInt32(minimizeEndEvent.GetRawConstantValue()) == 0x0017, "Windows minimize-end event is configured");
        Assert(formType.GetField("windowStateEventHook", BindingFlags.NonPublic | BindingFlags.Instance) != null, "Window-state event hook has a lifecycle-managed handle");
        Assert(formType.GetMethod("OnTrackedWindowStateChanged", BindingFlags.NonPublic | BindingFlags.Instance) != null, "Panel tracks minimize and restore events for assigned windows");

        MethodInfo lookup = layoutType.GetMethod("GetWorkspaceIdAtY", BindingFlags.Public | BindingFlags.Static);
        Assert(lookup != null, "Right panel hit-test API exists");
        if (lookup == null)
        {
            return 1;
        }

        Assert((int)lookup.Invoke(null, new object[] { 20, 0, 60, 8, 3 }) == 1, "First workspace card accepts a drop");
        Assert((int)lookup.Invoke(null, new object[] { 88, 0, 60, 8, 3 }) == 2, "Second workspace card accepts a drop");
        Assert((int)lookup.Invoke(null, new object[] { 64, 0, 60, 8, 3 }) == 0, "Card gap does not accept a drop");
        Assert((int)lookup.Invoke(null, new object[] { 250, 0, 60, 8, 3 }) == 0, "Outside the cards does not accept a drop");

        MethodInfo addBlockLookup = layoutType.GetMethod("IsAddBlockAtY", BindingFlags.Public | BindingFlags.Static);
        Assert(addBlockLookup != null, "Large add-workspace block hit-test API exists");
        if (addBlockLookup != null)
        {
            Assert((bool)addBlockLookup.Invoke(null, new object[] { 138, 60, 70, 8, 104 }), "Large add-workspace block follows the default workspace");
            Assert(!(bool)addBlockLookup.Invoke(null, new object[] { 130, 60, 70, 8, 104 }), "Card gap is not part of the add-workspace block");
        }

        MethodInfo createWorkspaceFromAddBlock = formType.GetMethod("CreateWorkspaceFromAddBlock", BindingFlags.NonPublic | BindingFlags.Instance);
        MethodInfo moveWorkspaceToIndex = formType.GetMethod("MoveWorkspaceToIndex", BindingFlags.NonPublic | BindingFlags.Instance);
        MethodInfo toggleSingleWindowMaximize = formType.GetMethod("ToggleSingleWindowMaximize", BindingFlags.NonPublic | BindingFlags.Instance);
        MethodInfo toggleWindowMaximize = formType.GetMethod("ToggleWindowMaximize", BindingFlags.NonPublic | BindingFlags.Instance);
        MethodInfo itemPointLookup = formType.GetMethod("GetWorkspaceItemAt", BindingFlags.NonPublic | BindingFlags.Instance, null, new Type[] { typeof(int), typeof(int) }, null);
        MethodInfo resizeHandleLookup = formType.GetMethod("GetResizeHandleAt", BindingFlags.NonPublic | BindingFlags.Instance);
        MethodInfo hideButtonLookup = formType.GetMethod("GetHideButtonBounds", BindingFlags.NonPublic | BindingFlags.Instance);
        MethodInfo deleteButtonLookup = formType.GetMethod("GetDeleteButtonBounds", BindingFlags.NonPublic | BindingFlags.Instance);
        MethodInfo deleteWorkspace = formType.GetMethod("DeleteWorkspace", BindingFlags.NonPublic | BindingFlags.Instance);
        MethodInfo configureRendering = formType.GetMethod("ConfigureRendering", BindingFlags.NonPublic | BindingFlags.Static);
        Assert(createWorkspaceFromAddBlock != null, "Panel can create a workspace from the large add block");
        Assert(moveWorkspaceToIndex != null, "Panel can reorder workspace cards");
        Assert(toggleSingleWindowMaximize == null, "Workspace cards do not toggle an app on double-click");
        Assert(toggleWindowMaximize != null, "App title can toggle its window on double-click");
        Assert(itemPointLookup != null, "App title hit-test uses both horizontal and vertical position");
        Assert(resizeHandleLookup != null, "Workspace cards expose a bottom-edge resize hit-test");
        Assert(hideButtonLookup != null, "Panel exposes a top hide button hit-test");
        Assert(deleteButtonLookup != null, "Non-default workspace cards expose a delete button hit-test");
        Assert(deleteWorkspace != null, "Panel can delete a workspace after confirmation");
        Assert(configureRendering != null, "Panel configures high-quality text rendering");
        if (configureRendering != null)
        {
            string sourceDirectory = args.Length >= 2
                ? args[1]
                : Path.Combine(Path.GetDirectoryName(applicationPath), "..", "src");
            string source = File.ReadAllText(Path.Combine(sourceDirectory, "WorkspaceSwitcher.App.cs"));
            source += File.ReadAllText(Path.Combine(sourceDirectory, "WorkspaceSwitcher.Glass.cs"));
            source += File.ReadAllText(Path.Combine(sourceDirectory, "WorkspaceSwitcher.ContextMenu.cs"));
            string wallpaperSource = File.ReadAllText(Path.Combine(sourceDirectory, "WorkspaceSwitcher.LiveBackdrop.cs"));
            Assert(source.Contains("NativeMethods.EVENT_SYSTEM_MINIMIZESTART"), "Panel subscribes to system minimize events");
            Assert(source.Contains("NativeMethods.EVENT_SYSTEM_MINIMIZEEND"), "Panel subscribes to system restore events");
            Assert(source.Contains("NativeMethods.SW_SHOWMINNOACTIVE"), "Workspace switching preserves minimized state without stealing focus");
            Assert(source.Contains("pendingWorkspaceMinimizeEvents"), "WorkspaceSwitcher-initiated minimize events are excluded from user state");
            Assert(source.Contains("workspaceMinimizedWindows"), "WorkspaceSwitcher batch minimization remains distinct from user minimization");
            Assert(source.Contains("CaptureMinimizedStateBeforeHiding"), "Switch-away captures a minimize action before hiding the window");
            Assert(source.Contains(".lm-exe"), "User data is stored below the per-user .lm-exe root");
            Assert(source.Contains("workspace-state.xml"), "Workspace state uses the persistent workspace-state.xml file");
            Assert(source.Contains("AntiAliasGridFit"), "Panel uses grayscale anti-aliased text for translucent glass");
            Assert(source.Contains("graphics.DrawString"), "Panel draws text with the graphics anti-aliasing mode");
            Assert(source.Contains("StringFormat.GenericTypographic"), "Panel uses typographic text metrics for stable GDI+ drawing");
            Assert(source.Contains("DrawCenteredText"), "Panel has one centered text drawing helper for controls");
            Assert(source.Contains("format.Alignment = StringAlignment.Center"), "Control text is horizontally centered by its layout rectangle");
            Assert(source.Contains("format.LineAlignment = StringAlignment.Center"), "Control text is vertically centered by its layout rectangle");
            Assert(!source.Contains("TextRenderer.MeasureText(tab.Label"), "Display tabs do not mix GDI measurement with GDI+ drawing");
            Assert(source.Contains("ControlFontSize"), "Top-level controls share one font-size metric");
            Assert(!source.Contains("ClearTypeGridFit"), "Panel avoids ClearType color fringes on translucent glass");
            Assert(!source.Contains("TextRenderer.DrawText"), "Panel does not use GDI ClearType text drawing");
            Assert(source.Contains("GraphicsUnit.Pixel"), "Panel uses pixel-sized fonts for stable DPI layout");
            Assert(source.Contains("numberSize.Width + 2"), "Workspace title spacing follows the actual number width");
            Assert(source.Contains("GetAutomaticWorkspaceCardHeight"), "Workspace cards reserve height for wrapped app rows");
            Assert(source.Contains("GetAutomaticPanelHeight"), "Panel height is calculated from its visible content");
            Assert(source.Contains("FitPanelHeightToContent"), "Panel refits after workspace content changes");
            Assert(source.Contains("GetItemTopOffset"), "App rows use the shared dynamic title spacing");
            Assert(source.Contains("card.Width - 58"), "App buttons reserve space for the bullet marker and padding");
            Assert(source.Contains("AppButtonRadius"), "Applications are rendered as rounded buttons");
            Assert(source.Contains("selectedApplicationWindowHandle"), "Selected application has a dedicated visual state");
            Assert(source.Contains("GetWorkspaceItemLayouts"), "Application drawing and hit-testing share button bounds");
            Assert(source.Contains("AppButtonHorizontalGap"), "Application buttons use an explicit horizontal gap");
            Assert(source.Contains("AppButtonVerticalGap"), "Application buttons use an explicit vertical gap");
            Assert(source.Contains("MouseWheel +="), "Panel handles mouse-wheel scrolling");
            Assert(source.Contains("contentScrollOffset"), "Panel keeps an independent content scroll offset");
            Assert(source.Contains("GetContentScrollMaximum"), "Panel clamps content scrolling to its content height");
            Assert(source.Contains("DrawContentScrollBar"), "Panel draws a discoverable content scrollbar");
            Assert(source.Contains("TranslateTransform(0, -contentScrollOffset)"), "Workspace content translates with the scroll offset");
            Assert(source.Contains("UpdatePanelRegion"), "Panel applies a rounded clipping region");
            Assert(source.Contains("new Region(path)"), "Panel clipping uses the shared rounded path");
            Assert(source.Contains("Brush addFill = new SolidBrush(Color.FromArgb(WorkspaceVisualMetrics.CardBackgroundArgb))"), "Add-workspace block uses the Fluent white card surface");
            Assert(source.Contains("SetProcessDpiAwarenessContext"), "Process opts into per-monitor DPI awareness");
            Assert(source.Contains("AutoScaleMode = AutoScaleMode.None"), "Custom pixel panel disables WinForms automatic size scaling");
            Assert(source.Contains("WM_DPICHANGED"), "Panel handles monitor DPI changes explicitly");
            Assert(source.Contains("KeepPanelSizeOnDpiChange"), "Panel preserves its physical size when crossing monitors");
            Assert(source.Contains("GetSuggestedDpiBounds(message.LParam)"), "DPI handling uses Windows' suggested position for the new monitor");
            Assert(source.Contains("Screen.FromRectangle(preferredBounds).WorkingArea"), "DPI handling selects the monitor from the suggested bounds");
            Assert(source.Contains("WorkspacePanelLayout.KeepWithinWorkingArea"), "DPI handling clamps the panel without losing its suggested anchor");
            Assert(source.Contains("savedPanelLogicalSize"), "DPI changes prefer the persisted logical panel size");
            Assert(source.Contains("savedPanelLogicalSize"), "Panel persists a DPI-independent logical size");
            Assert(source.Contains("DpiLayoutPolicy.ScaleValue"), "Panel scales its physical bounds from the logical size");
            Assert(source.Contains("DpiLayoutPolicy.ScaleFontSize"), "Panel compensates font size for the drawing transform");
            Assert(source.Contains("graphics.ScaleTransform"), "Panel scales custom drawing with the monitor DPI");
            Assert(source.Contains("GetLogicalClientSize"), "Panel layout uses logical client coordinates");
            Assert(source.Contains("WM_MOUSEACTIVATE"), "Panel handles mouse activation explicitly");
            Assert(source.Contains("MA_NOACTIVATE"), "Panel clicks do not steal foreground activation");
            Assert(source.Contains("ShowWithoutActivation"), "Panel remains interactive without becoming the foreground window");
            Assert(!source.Contains("ShowWorkspace(id);\n                    Hide();"), "Switching workspaces does not hide the panel");
            Assert(source.Contains("keepPanelVisible"), "Workspace switching preserves an already-visible panel");
            Assert(source.Contains("PanelMaximumWidth"), "Panel has a compact maximum width");
            Assert(source.Contains("logicalWidth > WorkspaceVisualMetrics.PanelMaximumWidth"), "Oversized saved panel widths are migrated to the compact layout");
            Assert(source.Contains("ExStyle |= 0x08000000"), "Panel is topmost without activating the panel window");
            Assert(source.Contains("usingRegisteredHotKey = NativeMethods.RegisterHotKey"), "Hotkey registration failure is observable");
            Assert(source.Contains("InstallKeyboardHook"), "Hotkey has a fallback keyboard hook");
            Assert(source.Contains("WH_KEYBOARD_LL"), "Fallback uses a low-level keyboard hook");
            Assert(source.Contains("lowLevelControlDown"), "Fallback tracks physical Control key state");
            Assert(source.Contains("lowLevelAltDown"), "Fallback tracks physical Alt key state");
            Assert(source.Contains("PostMessage(Handle"), "Fallback posts the toggle back to the panel message queue");
            Assert(source.Contains("EnsureAlwaysOnTop"), "Panel has an explicit topmost enforcement path");
            Assert(source.Contains("NativeMethods.SetWindowPos"), "Panel uses the native topmost z-order API");
            Assert(source.Contains("NativeMethods.HWND_TOPMOST"), "Panel requests the Windows topmost layer");
            Assert(source.Contains("ExStyle |= 0x00000008"), "Panel requests the topmost extended window style at creation");
            Assert(source.Contains("NativeMethods.SWP_NOACTIVATE"), "Topmost enforcement does not steal app focus");
            Assert(source.Contains("dragTimer.Interval = 16"), "Drag preview refreshes at approximately sixty frames per second");
            Assert(source.Contains("0x00000020"), "Drag overlays are mouse transparent");
            Assert(source.Contains("WM_NCHITTEST"), "Drag overlays handle mouse hit testing explicitly");
            Assert(source.Contains("HTTRANSPARENT"), "Drag overlays pass mouse hit testing to the underlying window");
            Assert(source.Contains("DragPreviewPolicy.HasMovedEnough"), "Drag preview waits for actual pointer movement");
            Assert(source.Contains("new DragPreviewForm(null, GetWindowTitle(window))"), "Drag preview is shown without blocking on window capture");
            Assert(!source.Contains("dragPreview = new DragPreviewForm(CaptureWindow(window), GetWindowTitle(window))"), "Drag start does not synchronously capture the dragged window");
            Assert(source.Contains("Chrome_WidgetWin_1"), "Chrome windows have an application-specific drag zone");
            Assert(source.Contains("IntPtr foreground = NativeMethods.GetForegroundWindow();"), "Drag detection uses the active top-level window");
            Assert(!source.Contains("GetDragWindowAtPoint(cursor)"), "Drag detection does not replace the active window with a child window");
            Assert(!source.Contains("Math.Min(WorkspaceVisualMetrics.PanelMaximumHeight"), "Panel height uses the monitor working area when no fixed limit is configured");
            Assert(!source.Contains("WorkspaceFocusPolicy.ShouldMinimizePeer"), "Application focus never invokes peer minimization");
            Assert(source.Contains("selectedWindowHandle != 0 && item.WindowHandle != selectedWindowHandle"), "Application focus preserves visible peers on every display");
            Assert(source.Contains("WorkspaceDisplayService"), "Display window operations use a dedicated service");
            Assert(source.Contains("new GlassContextMenuStrip"), "Display actions use the custom glass context menu");
            Assert(source.Contains("nativeGlassBackdropApplied = GlassWindowBackdrop.TryApply(Handle)"), "Workspace panel uses the native Windows glass backdrop");
            Assert(source.Contains("DwmSetWindowAttribute"), "Workspace panel requests a system-composited backdrop");
            Assert(source.Contains("DwmwaSystemBackdropType"), "Workspace panel targets the Windows system backdrop attribute");
            Assert(source.Contains("DwmstbTransientWindow"), "Workspace panel requests the Acrylic-like transient material");
            Assert(source.Contains("DwmwaUseImmersiveDarkMode"), "Workspace panel configures the system backdrop theme");
            Assert(source.Contains("TryApplyWin32Acrylic"), "Workspace panel has a Win32 Acrylic fallback");
            Assert(source.Contains("SetWindowCompositionAttribute"), "Workspace panel uses the Win32 Acrylic composition API");
            Assert(source.Contains("AccentEnableAcrylicBlurBehind"), "Workspace panel uses the Acrylic blur state");
            Assert(source.Contains("AcrylicGradientColor = 0x66F5F7FB"), "Workspace panel keeps the white acrylic tint visibly translucent");
            Assert(source.Contains("TryApplyRoundedCorners"), "Workspace panel requests native rounded corners");
            Assert(source.Contains("ClearPanelRegion"), "Workspace panel removes the legacy Region when native corners are active");
            Assert(source.Contains("if (!acrylicApplied)"), "Workspace panel does not stack two backdrop materials");
            Assert(source.Contains("if (nativeGlassBackdropApplied)"), "Native DWM backdrop remains enabled with the visible wallpaper fallback");
            Assert(source.Contains("nativeGlassBackdropApplied = false;"), "Workspace panel resets the native backdrop on handle recreation");
            Assert(source.Contains("BeginInvoke((MethodInvoker)"), "Workspace panel attaches the backdrop after the popup is visible");
            Assert(source.Contains("OnPaintBackground"), "Workspace panel leaves the native backdrop unpainted");
            Assert(source.Contains("WM_ERASEBKGND"), "Workspace panel blocks background erasure over the native backdrop");
            Assert(source.Contains("bool wallpaperGlassRendered = !nativeGlassBackdropApplied && WallpaperGlassSurface.TryRender("), "Workspace panel only paints the fallback wallpaper glass when native glass is unavailable");
            Assert(source.Contains("RectangleToScreen(ClientRectangle)"), "Wallpaper glass uses the panel's actual screen position");
            Assert(source.Contains("Screen.FromHandle(Handle).Bounds"), "Wallpaper glass follows the panel's current display position");
            Assert(source.Contains("if (!wallpaperGlassRendered && !nativeGlassBackdropApplied)"), "Unreadable wallpaper preserves the native DWM glass backdrop");
            Assert(source.Contains("glassRefreshTimer"), "Wallpaper glass has a low-frequency refresh path");
            Assert(source.Contains("glassRefreshTimer.Interval = 1000"), "Wallpaper glass refreshes without a high-frequency repaint loop");
            Assert(source.Contains("PanelBorderInset = 1"), "Panel border uses a one-pixel inset to preserve a smooth outer curve");
            Assert(source.Contains("GetPanelShapeBounds()"), "Panel region and border share the inset rounded shape");
            Assert(source.Contains("PanelBorderArgb = unchecked((int)0x24FFFFFF)"), "Panel glass edge uses a low-alpha highlight instead of a white arc");
            Assert(source.Contains("Color.FromArgb(WorkspaceVisualMetrics.PanelBorderArgb)"), "Panel border color is centralized with the glass metrics");
            Assert(source.Contains("DwmwaBorderColor"), "Native glass configures the outer DWM border color");
            Assert(source.Contains("TryApplyWindowBorder"), "Native glass applies the outer border policy");
            Assert(source.Contains("if (!nativeGlassBackdropApplied)"), "Native glass does not paint a second bright client border");
            Assert(!source.Contains("Color.FromArgb(170, 255, 255, 255)"), "Panel border does not use a bright white highlight");
            Assert(!source.Contains("GradientColor = unchecked((int)0x110A0E14)"), "Workspace panel does not use a near-zero Acrylic alpha");
            Assert(!source.Contains("LiveWallpaperBackdrop"), "Workspace panel does not retain a wallpaper sampling renderer");
            Assert(!source.Contains("LiveDesktopBackdrop"), "Workspace panel does not capture desktop pixels");
            Assert(!source.Contains("CopyFromScreen"), "Workspace panel does not sample the screen for its glass surface");
            Assert(!source.Contains("wallpaperRefreshTimer"), "Workspace panel does not run a wallpaper refresh timer");
            Assert(!source.Contains("RefreshLiveBackdrop"), "Workspace panel does not refresh a sampled backdrop");
            Assert(!source.Contains("PrepareLiveBackdropBeforeShow"), "Workspace panel does not capture before showing");
            Assert(!source.Contains("Environment.OSVersion.Version.Major < 10"), "Acrylic does not trust the compatibility-shimmed .NET Framework OS version");
            Assert(!source.Contains("TransparencyKey = Color.Black"), "Workspace panel does not enable a WinForms color key that breaks DWM composition");
            Assert(source.Contains("PanelGlassBackgroundArgb"), "Workspace panel keeps a static fallback color centralized");
            Assert(!source.Contains("GlassWallpaperBackground.Draw"), "Workspace panel does not use a static wallpaper snapshot");
            Assert(source.Contains("MinimumSize = new Size(220"), "Display context menu keeps a readable minimum width");
            Assert(source.Contains("focusAction.Height = 44"), "Display context menu keeps a readable row height");
            Assert(source.Contains("DisplayMenuPlacementPolicy.GetLocation"), "Display context menu uses the screen-aware placement policy");
            Assert(source.Contains("NativeMethods.SW_MINIMIZE"), "Peer windows use the system minimize action");
            Assert(source.Contains("ShowWorkspace(item.WorkspaceId, window.ToInt64())"), "App focus passes the resolved live window into workspace switching");
            Assert(source.Contains("EventWaitHandle"), "Workspace switcher exposes a named show-request event for the existing instance");
            Assert(source.Contains("RegisterWaitForSingleObject"), "Workspace switcher listens for show requests without polling");
            Assert(source.Contains("SignalShowRequest"), "A second workspace process signals the existing instance");
            Assert(source.Contains("WM_SHOW_PANEL"), "Workspace switcher has a private show-panel message");
            Assert(source.Contains("ShowPanelFromExternalRequest"), "The existing workspace instance handles an external show request");
            Assert(wallpaperSource.Contains("SystemParametersInfo"), "Wallpaper glass reads the desktop wallpaper through the Windows system API");
            Assert(wallpaperSource.Contains("GetWallpaperPath"), "Wallpaper glass resolves the current desktop wallpaper path");
            Assert(source.Contains("TryResolveWorkspaceWindow"), "App clicks can recover windows whose handles changed after restart");
            Assert(source.Contains("NativeMethods.EnumWindows"), "Window recovery scans current top-level windows");
            Assert(source.Contains("NativeMethods.IsWindowVisible"), "Window recovery ignores stale hidden handles");
            Assert(source.Contains("GetProcessName(processId)"), "Window recovery validates the saved process identity");
            Assert(source.Contains("IsProtectedDesktopWindow"), "Window management protects the desktop shell from hide and minimize operations");
            Assert(source.Contains("GetClassName"), "Desktop shell protection identifies native shell window classes");
            Assert(source.Contains("String.Equals(GetWindowTitle(candidate), item.Title"), "Window recovery prefers the saved window title");
            Assert(source.Contains("catalog.RebindWindow"), "Window recovery persists the new live handle");
            Assert(source.Contains("TryLaunchWorkspaceApplication"), "App clicks can relaunch a closed application");
            Assert(source.Contains("ProcessStartInfo"), "Application relaunch uses an explicit process start request");
            Assert(source.Contains("catalog.SetExecutablePath"), "Application records retain a launchable executable path");
            Assert(source.Contains("SetLaunchProfile"), "Newly assigned windows persist launch profiles");
            Assert(source.Contains("WorkspaceLaunchProfileParser"), "Application launch arguments use the shared parser");
            Assert(source.Contains("startInfo.Arguments = item.LaunchArguments"), "Application relaunch uses saved per-window arguments");
            Assert(source.Contains("startInfo.WorkingDirectory = item.WorkingDirectory"), "Application relaunch uses the saved working directory");
            Assert(source.Contains("CaptureLaunchProfileIfMissing"), "Existing running windows upgrade legacy records with launch profiles");
            Assert(source.Contains("QueueLaunchProfileCapture"), "Launch profile capture is scheduled outside the UI thread");
            Assert(source.Contains("ThreadPool.QueueUserWorkItem"), "WMI launch profile lookup does not block the UI thread");
            Assert(source.Contains("WaitOne(250)"), "Command line lookup has a bounded wait");
            Assert(source.Contains("searcher.Options.Timeout"), "WMI command line enumeration has a bounded timeout");
            Assert(source.Contains("bool expectNewWindow = true"), "Every relaunched window waits for its own new window handle");
            Assert(source.Contains("RefreshWorkspaceAvailability"), "Startup refresh only checks application availability");
            Assert(!source.Contains("TryLaunchWorkspaceApplication(item, out window);\n                }\n\n                ShowWorkspace"), "Loading state does not automatically launch missing applications");
            Assert(source.Contains("RefreshWorkspaceState"), "Panel exposes a workspace refresh path");
            Assert(source.Contains("ShowWorkspaceInternal(workspaceId, selectedWindowHandle, minimizeAllItems)"), "Workspace switches suppress foreground feedback for the full transition");
            Assert(source.Contains("TryResolveForegroundWorkspaceItem"), "Foreground windows can recover newly created application handles");
            Assert(source.Contains("catalog.GetAllItems()"), "Foreground recovery compares the live window with saved workspace items");
            Assert(source.Contains("if (!IsCandidateWindow(window) || !NativeMethods.IsWindowVisible(window))"), "Foreground recovery ignores delayed events for hidden windows");
            Assert(source.Contains("GetSavedProcessItemCount(item.ProcessName)"), "Ambiguous process windows are not assigned across multiple workspace records");
            Assert(source.Contains("ForegroundWindowRecoveryPolicy.ShouldUseOnlyProcessMatch"), "Foreground recovery rejects ambiguous same-process windows");
            Assert(source.Contains("WorkspaceWindowRecoveryPolicy.ShouldUseUniqueCandidate"), "Restart recovery rejects duplicate title matches");
            Assert(source.Contains("WorkspaceLaunchProfileParser.ExtractArguments"), "Restart recovery can compare launch profiles");
            Assert(source.Contains("int existingWorkspaceId = catalog.GetWindowWorkspaceId(window.ToInt64())"), "Dragging a managed window keeps its existing record");
            Assert(source.Contains("catalog.MoveWindow(window.ToInt64(), workspaceId)"), "Dragging a managed window moves it instead of replacing it");
            Assert(source.Contains("startInfo.Arguments = \"--new-window\""), "Launching a VS Code workspace opens a distinct window");
            Assert(source.Contains("IsWorkspaceItemWindow(item, window, false)"), "Managed hidden windows are restored instead of relaunched");
            Assert(source.Contains("GetRefreshButtonBounds"), "Panel exposes a refresh button hit-test");
            Assert(source.Contains("IsAvailable"), "Workspace apps retain an availability status");
            Assert(source.Contains("MoveWorkspaceItemToWorkspace"), "App context actions can move an app to a workspace");
            Assert(source.Contains("CloseWorkspaceItem"), "App context actions can close an application");
            Assert(source.Contains("RemoveWorkspaceItem"), "App context actions can remove an application record from a workspace");
            Assert(source.Contains("从工作区移除记录"), "App context menu distinguishes record removal from closing an application");
            Assert(source.Contains("NativeMethods.WM_CLOSE"), "Closing an app uses the native close message");
            Assert(!source.Contains("ShowWorkspace(item.WorkspaceId, window.ToInt64(), true)"), "Double-clicking an app does not request batch minimization");
            Assert(source.Contains("--show"), "Desktop shortcut has a visible startup mode");
            Assert(source.Contains("showPanelOnStart"), "Application distinguishes desktop launch from background startup");
            Assert(source.Contains("panel.Show()"), "Desktop launch shows the workspace panel");
            string singleClickHandler = source.Substring(source.IndexOf("MouseClick +="), source.IndexOf("MouseUp +=") - source.IndexOf("MouseClick +="));
            Assert(singleClickHandler.Contains("ShowWorkspace(pressedWorkspaceId);") && !singleClickHandler.Contains("ShowWorkspace(pressedWorkspaceId, 0, true)"), "Single workspace click only switches workspaces");
            string doubleClickHandler = source.Substring(source.IndexOf("MouseDoubleClick +="), source.IndexOf("protected override void OnHandleCreated") - source.IndexOf("MouseDoubleClick +="));
            Assert(doubleClickHandler.Contains("WorkspaceCardClickPolicy.ShouldMinimize(pressedWorkspaceId, id, args.Clicks)") && doubleClickHandler.Contains("ShowWorkspace(pressedWorkspaceId, 0, true)"), "Only workspace double-click requests batch minimization");
            Assert(source.Contains("DrawDisplayTabs"), "Panel draws the all-displays and monitor filter tabs");
            Assert(source.Contains("GetDisplayTabAt"), "Display filter tabs use a shared hit-test");
            Assert(source.Contains("Screen.AllScreens"), "Panel enumerates every connected Windows display");
            Assert(source.Contains("DisplayFilterPolicy.ShouldHighlight"), "App styling follows the selected display filter");
            Assert(source.Contains("MoveWorkspaceItemToDisplay"), "App context actions can move a single window across displays");
            Assert(source.Contains("MoveMinimizedWindowToDisplay"), "Moving a minimized app updates its restore position without flashing it");
            Assert(source.Contains("targetScreen.Bounds"), "Moving a maximized app targets the full destination monitor");
            Assert(source.Contains("NativeMethods.RedrawWindow"), "Moved app windows receive a full frame and child repaint request");
            Assert(source.Contains("WorkspaceCardClickPolicy.ShouldActivate"), "Workspace activation uses the recorded press and release targets");
            Assert(source.Contains("applicationClickTimer.Interval = Math.Max(1, SystemInformation.DoubleClickTime)"), "Application clicks use the system double-click interval");
            Assert(!source.Contains("QueueWorkspaceItemClick(selectedItem)"), "Single application clicks are not deferred behind double-click detection");
            Assert(source.Contains("FlushPendingWorkspaceItemClick"), "Deferred application clicks have an explicit flush path");
            Assert(source.Contains("CancelPendingWorkspaceItemClick"), "Double-clicks cancel the pending single application click");
            Assert(source.Contains("FocusWorkspaceItem(selectedItem);"), "Single application clicks focus the selected application immediately");
            Assert(source.Contains("ReleaseApplicationInputCapture"), "Application focus releases panel mouse capture");
            Assert(source.Contains("KeepPanelVisibleForApplicationFocus"), "Application focus keeps the workspace panel visible");
            Assert(source.Contains("NativeMethods.HWND_TOPMOST"), "Application focus keeps the panel in a controlled topmost layer");
            Assert(source.Contains("foregroundSyncSuppression"), "Programmatic window changes suppress foreground feedback");
            Assert(source.Contains("panelIsPassive && message.Msg == NativeMethods.WM_NCHITTEST"), "Visible passive panels pass mouse hit-testing through");
            Assert(source.Contains("IsPanelInteractiveAt(clientPoint)"), "Passive panels keep workspace cards and controls clickable");
            Assert(source.Contains("NativeMethods.ReleaseCapture()"), "Application focus also releases native mouse capture");
            Assert(source.Contains("foregroundSyncSuppression = Math.Max(0, foregroundSyncSuppression - 1)"), "Application focus restores foreground synchronization after window resolution");
            Assert(source.Contains("if (panelIsPassive)"), "Hotkey detects a visible passive panel");
            Assert(source.Contains("DrawDeleteButton"), "Non-default workspace cards draw a delete action");
            Assert(source.Contains("DeleteButtonWidth = 58"), "Delete button uses a compact width");
            Assert(source.Contains("DeleteButtonHeight = 24"), "Delete button uses a compact height");
            Assert(source.Contains("DeleteButtonTopOffset = 5"), "Delete button sits in the card header area");
            Assert(source.Contains("DeleteButtonFontSize = 14f"), "Delete button uses a compact label size");
            Assert(source.Contains("ConfirmWorkspaceDeletion"), "Deleting a workspace requires confirmation");
            Assert(source.Contains("catalog.MoveWorkspaceItems(workspaceId, 1)"), "Deleting a workspace transfers apps to the default workspace");
            Assert(source.Contains("workspaceLayout.RemoveWorkspace(workspaceId)"), "Deleting a workspace removes its layout card");
            Assert(source.Contains("displayContextMenu"), "Display context menu has an owned lifetime");
            Assert(source.Contains("DisposeDisplayContextMenu"), "Display context menu has an explicit disposal path");
            Assert(!source.Contains("menu.Closed += delegate { menu.Dispose(); };"), "Display context menu is not disposed during its close callback");
            Assert(source.Contains("private bool isClosing"), "Workspace form tracks its closing lifecycle");
            Assert(source.Contains("QueueBackdropRetry"), "Workspace form centralizes deferred backdrop callbacks");
            Assert(source.Contains("ObjectDisposedException"), "Deferred backdrop callbacks handle disposed forms");
            Assert(source.Contains("dragTimer.Stop()"), "Workspace form stops drag polling before closing");
            Assert(source.Contains("applicationClickTimer.Stop()"), "Workspace form stops deferred app clicks before closing");
            Assert(source.Contains("glassRefreshTimer.Stop()"), "Workspace form stops backdrop refresh before closing");
            Assert(source.Contains("dragTimer.Dispose()"), "Workspace form disposes the drag timer");
        }
        if (visualMetricsType != null)
        {
            FieldInfo cardTop = visualMetricsType.GetField("CardTop", BindingFlags.Public | BindingFlags.Static);
            FieldInfo sideMargin = visualMetricsType.GetField("SideMargin", BindingFlags.Public | BindingFlags.Static);
            FieldInfo cardHeight = visualMetricsType.GetField("CardHeight", BindingFlags.Public | BindingFlags.Static);
            FieldInfo addBlockHeight = visualMetricsType.GetField("AddBlockHeight", BindingFlags.Public | BindingFlags.Static);
            FieldInfo titleFontSize = visualMetricsType.GetField("TitleFontSize", BindingFlags.Public | BindingFlags.Static);
            FieldInfo itemFontSize = visualMetricsType.GetField("ItemFontSize", BindingFlags.Public | BindingFlags.Static);
            FieldInfo addTitleFontSize = visualMetricsType.GetField("AddTitleFontSize", BindingFlags.Public | BindingFlags.Static);
            FieldInfo smallFontSize = visualMetricsType.GetField("SmallFontSize", BindingFlags.Public | BindingFlags.Static);
            FieldInfo controlFontSize = visualMetricsType.GetField("ControlFontSize", BindingFlags.Public | BindingFlags.Static);
            FieldInfo hideButtonFontSize = visualMetricsType.GetField("HideButtonFontSize", BindingFlags.Public | BindingFlags.Static);
            FieldInfo sidebarOpacity = visualMetricsType.GetField("SidebarOpacity", BindingFlags.Public | BindingFlags.Static);
            FieldInfo panelWidth = visualMetricsType.GetField("PanelWidth", BindingFlags.Public | BindingFlags.Static);
            FieldInfo panelRadius = visualMetricsType.GetField("PanelRadius", BindingFlags.Public | BindingFlags.Static);
            FieldInfo appButtonHorizontalGap = visualMetricsType.GetField("AppButtonHorizontalGap", BindingFlags.Public | BindingFlags.Static);
            FieldInfo appButtonVerticalGap = visualMetricsType.GetField("AppButtonVerticalGap", BindingFlags.Public | BindingFlags.Static);
            FieldInfo hideButtonWidth = visualMetricsType.GetField("HideButtonWidth", BindingFlags.Public | BindingFlags.Static);
            FieldInfo hideButtonHeight = visualMetricsType.GetField("HideButtonHeight", BindingFlags.Public | BindingFlags.Static);
            FieldInfo refreshButtonWidth = visualMetricsType.GetField("RefreshButtonWidth", BindingFlags.Public | BindingFlags.Static);
            FieldInfo refreshButtonHeight = visualMetricsType.GetField("RefreshButtonHeight", BindingFlags.Public | BindingFlags.Static);
            FieldInfo displayTabTop = visualMetricsType.GetField("DisplayTabTop", BindingFlags.Public | BindingFlags.Static);
            FieldInfo displayTabHeight = visualMetricsType.GetField("DisplayTabHeight", BindingFlags.Public | BindingFlags.Static);
            FieldInfo panelBackgroundArgb = visualMetricsType.GetField("PanelBackgroundArgb", BindingFlags.Public | BindingFlags.Static);
            FieldInfo cardBackgroundArgb = visualMetricsType.GetField("CardBackgroundArgb", BindingFlags.Public | BindingFlags.Static);
            FieldInfo activeCardBackgroundArgb = visualMetricsType.GetField("ActiveCardBackgroundArgb", BindingFlags.Public | BindingFlags.Static);
            FieldInfo cardBorderArgb = visualMetricsType.GetField("CardBorderArgb", BindingFlags.Public | BindingFlags.Static);
            FieldInfo activeCardBorderArgb = visualMetricsType.GetField("ActiveCardBorderArgb", BindingFlags.Public | BindingFlags.Static);
            FieldInfo cardRadius = visualMetricsType.GetField("CardRadius", BindingFlags.Public | BindingFlags.Static);
            FieldInfo addBlockRadius = visualMetricsType.GetField("AddBlockRadius", BindingFlags.Public | BindingFlags.Static);
            FieldInfo cardFillAlpha = visualMetricsType.GetField("CardFillAlpha", BindingFlags.Public | BindingFlags.Static);
            FieldInfo panelMaximumHeight = visualMetricsType.GetField("PanelMaximumHeight", BindingFlags.Public | BindingFlags.Static);
            FieldInfo panelResizeGrip = visualMetricsType.GetField("PanelResizeGrip", BindingFlags.Public | BindingFlags.Static);
            FieldInfo panelMaximumWidth = visualMetricsType.GetField("PanelMaximumWidth", BindingFlags.Public | BindingFlags.Static);
            Assert(cardTop != null && (int)cardTop.GetValue(null) == 108, "Cards leave a compact gap below the display filter tabs");
            Assert(sideMargin != null && (int)sideMargin.GetValue(null) == 20, "Workspace cards keep a wider margin from the panel edge");
            Assert(cardHeight != null && (int)cardHeight.GetValue(null) == 80, "Workspace cards use a compact adaptive baseline height");
            Assert(addBlockHeight != null && (int)addBlockHeight.GetValue(null) == 80, "Add-workspace block uses a compact adaptive height");
            Assert(titleFontSize != null && Math.Abs((float)titleFontSize.GetValue(null) - 22f) < 0.01f, "Workspace title uses the readable pixel font size");
            Assert(itemFontSize != null && Math.Abs((float)itemFontSize.GetValue(null) - 17f) < 0.01f, "App names use the enlarged readable pixel font size");
            Assert(addTitleFontSize != null && Math.Abs((float)addTitleFontSize.GetValue(null) - 22f) < 0.01f, "Add-workspace title uses the readable pixel font size");
            Assert(smallFontSize != null && Math.Abs((float)smallFontSize.GetValue(null) - 11f) < 0.01f, "Add-workspace hint uses the readable pixel font size");
            Assert(controlFontSize != null && Math.Abs((float)controlFontSize.GetValue(null) - 16f) < 0.01f, "Top-level controls use the readable control font size");
            Assert(hideButtonFontSize != null && Math.Abs((float)hideButtonFontSize.GetValue(null) - 16f) < 0.01f, "Hide button text uses the shared readable control font size");
            Assert(hideButtonWidth != null && (int)hideButtonWidth.GetValue(null) == 72, "Hide button uses the smaller top-control width");
            Assert(hideButtonHeight != null && (int)hideButtonHeight.GetValue(null) == 34, "Hide button uses the smaller top-control height");
            Assert(refreshButtonWidth != null && (int)refreshButtonWidth.GetValue(null) == 110, "Refresh button uses the smaller top-control width");
            Assert(refreshButtonHeight != null && (int)refreshButtonHeight.GetValue(null) == 34, "Refresh button uses the smaller top-control height");
            Assert(displayTabTop != null && (int)displayTabTop.GetValue(null) == 48, "Display tabs move up with the compact top controls");
            Assert(displayTabHeight != null && (int)displayTabHeight.GetValue(null) == 36, "Display tabs use the smaller top-control height");
            Assert(appButtonHorizontalGap != null && (int)appButtonHorizontalGap.GetValue(null) == 8, "Application buttons use an eight-pixel horizontal gap");
            Assert(appButtonVerticalGap != null && (int)appButtonVerticalGap.GetValue(null) == 12, "Application buttons use a twelve-pixel vertical gap");
            Assert(sidebarOpacity != null && Math.Abs((double)sidebarOpacity.GetValue(null) - 1.0d) < 0.01d, "Sidebar uses an opaque white surface for readable text");
            Assert(panelWidth != null && (int)panelWidth.GetValue(null) == 520, "Floating workspace container uses the enlarged scheme width");
            Assert(panelMaximumWidth != null && (int)panelMaximumWidth.GetValue(null) == 760, "Floating workspace container can be expanded horizontally");
            Assert(panelMaximumHeight != null && (int)panelMaximumHeight.GetValue(null) == 0, "Floating workspace container has no fixed vertical limit");
            Assert(panelResizeGrip != null && (int)panelResizeGrip.GetValue(null) == 12, "Panel resize has a forgiving edge hit area");
            Assert(panelBackgroundArgb != null && cardBackgroundArgb != null && activeCardBackgroundArgb != null, "Scheme 1 surface colors are centralized");
            Assert(cardBorderArgb != null && activeCardBorderArgb != null, "Scheme 1 border colors are centralized");
            Assert(cardRadius != null && (int)cardRadius.GetValue(null) == 18, "Scheme 1 workspace cards use the enlarged radius");
            Assert(addBlockRadius != null && (int)addBlockRadius.GetValue(null) == 18, "Scheme 1 add-workspace block uses the enlarged radius");
            Assert(panelRadius != null && (int)panelRadius.GetValue(null) == 20, "Panel itself uses a visible rounded radius");
            Assert(sidebarOpacity != null && Math.Abs((double)sidebarOpacity.GetValue(null) - 1.0d) < 0.01d, "Workspace panel is globally opaque for readable text");
            Assert(panelBackgroundArgb != null && (int)panelBackgroundArgb.GetValue(null) == -459777, "Scheme 1 panel uses the exact Fluent surface color");
            Assert(cardBackgroundArgb != null && (int)cardBackgroundArgb.GetValue(null) == -1, "Scheme 1 cards use the exact white surface color");
            Assert(activeCardBackgroundArgb != null && (int)activeCardBackgroundArgb.GetValue(null) == -1182465, "Scheme 1 active card uses the exact blue surface color");
            Assert(cardFillAlpha != null && (int)cardFillAlpha.GetValue(null) == 255, "Workspace cards are opaque");
        }

        MethodInfo itemLookup = layoutType.GetMethod("GetItemIndexAtY", BindingFlags.Public | BindingFlags.Static);
        Assert(itemLookup != null, "Program row hit-test API exists");
        if (itemLookup != null)
        {
            Assert((int)itemLookup.Invoke(null, new object[] { 31, 0, 31, 15, 2 }) == 0, "First program row is selectable");
            Assert((int)itemLookup.Invoke(null, new object[] { 46, 0, 31, 15, 2 }) == 1, "Second program row is selectable");
            Assert((int)itemLookup.Invoke(null, new object[] { 61, 0, 31, 15, 2 }) == -1, "Area below program rows is not selectable");
        }
        return failures == 0 ? 0 : 1;
    }
}
