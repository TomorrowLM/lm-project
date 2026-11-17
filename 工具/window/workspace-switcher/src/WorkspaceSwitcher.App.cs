using System;
using System.Collections;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Management;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;
using WorkspaceSwitcher.Core;

namespace WorkspaceSwitcher.App
{
    public enum PanelResizeEdge
    {
        None,
        Left,
        Top,
        Right,
        Bottom,
        TopLeft,
        TopRight,
        BottomLeft,
        BottomRight
    }

    public static class WorkspacePanelLayout
    {
        public static Rectangle GetTopRightBounds(Rectangle workingArea, Size panelSize)
        {
            return new Rectangle(workingArea.Right - panelSize.Width, workingArea.Top, panelSize.Width, panelSize.Height);
        }

        public static Rectangle KeepWithinWorkingArea(Rectangle preferredBounds, Size requestedSize, Rectangle workingArea)
        {
            int width = Math.Max(1, Math.Min(requestedSize.Width, workingArea.Width));
            int height = Math.Max(1, Math.Min(requestedSize.Height, workingArea.Height));
            int left = Math.Max(workingArea.Left, Math.Min(preferredBounds.Left, workingArea.Right - width));
            int top = Math.Max(workingArea.Top, Math.Min(preferredBounds.Top, workingArea.Bottom - height));
            return new Rectangle(left, top, width, height);
        }

        public static Size ClampPanelSize(Size requested, Size minimum, Size maximum)
        {
            int width = Math.Max(minimum.Width, Math.Min(maximum.Width, requested.Width));
            int height = Math.Max(minimum.Height, Math.Min(maximum.Height, requested.Height));
            return new Size(width, height);
        }

        public static PanelResizeEdge GetResizeEdgeAt(Point point, Size clientSize, int grip)
        {
            bool left = point.X >= 0 && point.X <= grip;
            bool right = point.X >= clientSize.Width - grip && point.X < clientSize.Width;
            bool top = point.Y >= 0 && point.Y <= grip;
            bool bottom = point.Y >= clientSize.Height - grip && point.Y < clientSize.Height;
            if (left && top) return PanelResizeEdge.TopLeft;
            if (right && top) return PanelResizeEdge.TopRight;
            if (left && bottom) return PanelResizeEdge.BottomLeft;
            if (right && bottom) return PanelResizeEdge.BottomRight;
            if (left) return PanelResizeEdge.Left;
            if (top) return PanelResizeEdge.Top;
            if (right) return PanelResizeEdge.Right;
            if (bottom) return PanelResizeEdge.Bottom;
            return PanelResizeEdge.None;
        }

        public static int GetWorkspaceIdAtY(int y, int cardTop, int cardHeight, int gap, int workspaceCount)
        {
            if (y < cardTop || cardHeight <= 0 || workspaceCount <= 0)
            {
                return 0;
            }

            int relativeY = y - cardTop;
            int blockHeight = cardHeight + gap;
            int index = relativeY / blockHeight;
            if (index < 0 || index >= workspaceCount || relativeY % blockHeight >= cardHeight)
            {
                return 0;
            }

            return index + 1;
        }

        public static int GetItemIndexAtY(int y, int cardTop, int itemTopOffset, int itemHeight, int itemCount)
        {
            if (itemHeight <= 0 || itemCount <= 0)
            {
                return -1;
            }

            int relativeY = y - cardTop - itemTopOffset;
            int index = relativeY / itemHeight;
            if (relativeY < 0 || index < 0 || index >= itemCount)
            {
                return -1;
            }

            return index;
        }

        public static bool IsAddBlockAtY(int y, int cardTop, int cardHeight, int gap, int addBlockHeight)
        {
            int addBlockTop = cardTop + cardHeight + gap;
            return y >= addBlockTop && y < addBlockTop + addBlockHeight;
        }
    }

    internal static class NativeMethods
    {
        internal const int WM_SHOW_PANEL = 0x8001;
        internal const int WM_HOTKEY = 0x0312;
        internal const int WM_CLOSE = 0x0010;
        internal const int WM_ERASEBKGND = 0x0014;
        internal const int WM_MOUSEACTIVATE = 0x0021;
        internal const int WM_NCHITTEST = 0x0084;
        internal const int WM_DPICHANGED = 0x02E0;
        internal const int MA_NOACTIVATE = 0x0003;
        internal const int HTCLIENT = 1;
        internal const int HTTRANSPARENT = -1;
        internal const int WH_KEYBOARD_LL = 13;
        internal const int WM_KEYDOWN = 0x0100;
        internal const int WM_KEYUP = 0x0101;
        internal const int WM_SYSKEYDOWN = 0x0104;
        internal const int WM_SYSKEYUP = 0x0105;
        internal const int VK_CONTROL = 0x11;
        internal const int VK_LCONTROL = 0xA2;
        internal const int VK_RCONTROL = 0xA3;
        internal const int VK_MENU = 0x12;
        internal const int VK_LMENU = 0xA4;
        internal const int VK_RMENU = 0xA5;
        internal const int VK_SPACE = 0x20;
        internal const int VK_1 = 0x31;
        internal const uint MOD_ALT = 0x0001;
        internal const uint MOD_CONTROL = 0x0002;
        internal const int SW_HIDE = 0;
        internal const int SW_SHOWNOACTIVATE = 4;
        internal const int SW_MINIMIZE = 6;
        internal const int SW_SHOWMINNOACTIVE = 7;
        internal const int SW_SHOWMAXIMIZED = 3;
        internal const int SW_RESTORE = 9;
        internal static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
        internal const uint SWP_NOSIZE = 0x0001;
        internal const uint SWP_NOMOVE = 0x0002;
        internal const uint SWP_NOZORDER = 0x0004;
        internal const uint SWP_NOACTIVATE = 0x0010;
        internal const uint SWP_SHOWWINDOW = 0x0040;
        internal const uint SWP_FRAMECHANGED = 0x0020;
        internal const uint RDW_INVALIDATE = 0x0001;
        internal const uint RDW_ERASE = 0x0004;
        internal const uint RDW_ALLCHILDREN = 0x0080;
        internal const uint RDW_FRAME = 0x0400;
        internal const int VK_LBUTTON = 0x01;
        internal const uint EVENT_SYSTEM_FOREGROUND = 0x0003;
        internal const uint EVENT_SYSTEM_MINIMIZESTART = 0x0016;
        internal const uint EVENT_SYSTEM_MINIMIZEEND = 0x0017;
        internal const int OBJID_WINDOW = 0;
        internal const int CHILDID_SELF = 0;
        internal const uint WINEVENT_OUTOFCONTEXT = 0x0000;
        internal const uint WINEVENT_SKIPOWNPROCESS = 0x0002;
        internal const uint PW_RENDERFULLCONTENT = 0x00000002;

        internal delegate void WinEventDelegate(IntPtr hook, uint eventType, IntPtr window, int objectId, int childId, uint eventThread, uint eventTime);
        internal delegate IntPtr LowLevelKeyboardProc(int code, IntPtr message, IntPtr data);

        [StructLayout(LayoutKind.Sequential)]
        internal struct Point
        {
            internal int X;
            internal int Y;
        }

        [StructLayout(LayoutKind.Sequential)]
        internal struct Rect
        {
            internal int Left;
            internal int Top;
            internal int Right;
            internal int Bottom;
        }

        [StructLayout(LayoutKind.Sequential)]
        internal struct WindowPlacement
        {
            internal int Length;
            internal int Flags;
            internal int ShowCommand;
            internal Point MinPosition;
            internal Point MaxPosition;
            internal Rect NormalPosition;
        }

        [StructLayout(LayoutKind.Sequential)]
        internal struct KeyboardInput
        {
            internal uint VirtualKeyCode;
            internal uint ScanCode;
            internal uint Flags;
            internal uint Time;
            internal IntPtr ExtraInfo;
        }

        [DllImport("user32.dll")]
        internal static extern bool RegisterHotKey(IntPtr hWnd, int id, uint modifiers, uint virtualKey);

        [DllImport("user32.dll")]
        internal static extern bool UnregisterHotKey(IntPtr hWnd, int id);

        [DllImport("user32.dll", SetLastError = true)]
        internal static extern bool SetWindowPos(IntPtr window, IntPtr insertAfter, int x, int y, int width, int height, uint flags);

        [DllImport("user32.dll", SetLastError = true)]
        internal static extern bool RedrawWindow(IntPtr window, IntPtr updateRect, IntPtr updateRegion, uint flags);

        [DllImport("user32.dll", SetLastError = true)]
        internal static extern IntPtr SetWindowsHookEx(int hookType, LowLevelKeyboardProc callback, IntPtr module, uint threadId);

        [DllImport("user32.dll")]
        internal static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr message, IntPtr data);

        [DllImport("user32.dll", SetLastError = true)]
        internal static extern bool UnhookWindowsHookEx(IntPtr hook);

        [DllImport("user32.dll")]
        internal static extern short GetAsyncKeyState(int virtualKey);

        [DllImport("user32.dll")]
        internal static extern bool GetCursorPos(out Point point);

        [DllImport("user32.dll")]
        internal static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        internal static extern int GetWindowTextLength(IntPtr hWnd);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        internal static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int maxCount);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        internal static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder className, int maxCount);

        [DllImport("user32.dll")]
        internal static extern bool IsWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        internal static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        internal static extern bool ReleaseCapture();

        [DllImport("user32.dll")]
        internal static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

        internal delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")]
        internal static extern bool IsZoomed(IntPtr hWnd);

        [DllImport("user32.dll")]
        internal static extern bool IsIconic(IntPtr hWnd);

        [DllImport("user32.dll")]
        internal static extern bool GetWindowRect(IntPtr hWnd, out Rect rectangle);

        [DllImport("user32.dll", SetLastError = true)]
        internal static extern bool GetWindowPlacement(IntPtr hWnd, ref WindowPlacement placement);

        [DllImport("user32.dll", SetLastError = true)]
        internal static extern bool SetWindowPlacement(IntPtr hWnd, ref WindowPlacement placement);

        [DllImport("user32.dll")]
        internal static extern uint GetDpiForWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        internal static extern bool GetClientRect(IntPtr hWnd, out Rect rectangle);

        [DllImport("user32.dll")]
        internal static extern bool ClientToScreen(IntPtr hWnd, ref Point point);

        [DllImport("user32.dll")]
        internal static extern bool ShowWindow(IntPtr hWnd, int command);


        [DllImport("user32.dll")]
        internal static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        internal static extern bool PostMessage(IntPtr hWnd, uint message, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
        internal static extern IntPtr GetModuleHandle(string moduleName);

        [DllImport("kernel32.dll", SetLastError = true)]
        internal static extern IntPtr OpenProcess(uint access, bool inheritHandle, uint processId);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        internal static extern bool QueryFullProcessImageName(IntPtr process, uint flags, System.Text.StringBuilder path, ref uint size);

        [DllImport("kernel32.dll")]
        internal static extern bool CloseHandle(IntPtr handle);

        [DllImport("user32.dll", EntryPoint = "SetProcessDpiAwarenessContext", SetLastError = true)]
        internal static extern bool SetProcessDpiAwarenessContext(IntPtr dpiContext);

        [DllImport("shcore.dll", EntryPoint = "SetProcessDpiAwareness", SetLastError = true)]
        internal static extern int SetProcessDpiAwareness(int value);

        [DllImport("user32.dll")]
        internal static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

        [DllImport("user32.dll")]
        internal static extern IntPtr SetWinEventHook(uint eventMin, uint eventMax, IntPtr module, WinEventDelegate callback, uint processId, uint threadId, uint flags);

        [DllImport("user32.dll")]
        internal static extern bool UnhookWinEvent(IntPtr hook);

        [DllImport("user32.dll")]
        internal static extern bool PrintWindow(IntPtr window, IntPtr deviceContext, uint flags);
    }

    internal sealed class DragPreviewForm : Form
    {
        private readonly Bitmap snapshot;
        private readonly string title;

        internal DragPreviewForm(Bitmap source, string sourceTitle)
        {
            snapshot = source;
            title = sourceTitle;
            AutoScaleMode = AutoScaleMode.Dpi;
            BackColor = Color.FromArgb(31, 41, 55);
            DoubleBuffered = true;
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            TopMost = true;
            Opacity = 0.94;
            Size = GetPreviewSize(source);
        }

        protected override bool ShowWithoutActivation
        {
            get { return true; }
        }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams parameters = base.CreateParams;
                parameters.ExStyle |= 0x08000000;
                parameters.ExStyle |= 0x00000080;
                parameters.ExStyle |= 0x00000020;
                return parameters;
            }
        }

        protected override void WndProc(ref Message message)
        {
            if (message.Msg == NativeMethods.WM_NCHITTEST)
            {
                message.Result = new IntPtr(NativeMethods.HTTRANSPARENT);
                return;
            }

            base.WndProc(ref message);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            using (Pen border = new Pen(Color.FromArgb(96, 165, 250), 2f))
            {
                e.Graphics.DrawRectangle(border, 1, 1, ClientSize.Width - 3, ClientSize.Height - 3);
            }

            if (snapshot != null)
            {
                e.Graphics.DrawImage(snapshot, new Rectangle(5, 5, ClientSize.Width - 10, ClientSize.Height - 10));
                return;
            }

            using (Font font = new Font(WorkspaceVisualMetrics.FontFamilyName, 9f, FontStyle.Bold, GraphicsUnit.Pixel))
            using (Brush foreground = new SolidBrush(Color.White))
            {
                e.Graphics.DrawString(title, font, foreground, 12, 12);
            }
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing && snapshot != null)
            {
                snapshot.Dispose();
            }

            base.Dispose(disposing);
        }

        internal void MoveToPointer(NativeMethods.Point pointer)
        {
            Location = new System.Drawing.Point(
                DragPreviewPolicy.GetPreviewLeft(pointer.X, Width),
                DragPreviewPolicy.GetPreviewTop(pointer.Y, Height));
        }

        private static Size GetPreviewSize(Bitmap source)
        {
            if (source == null)
            {
                return new Size(260, 120);
            }

            const int maximumWidth = 420;
            const int maximumHeight = 280;
            float scale = Math.Min((float)maximumWidth / source.Width, (float)maximumHeight / source.Height);
            scale = Math.Min(scale, 0.55f);
            return new Size(Math.Max(160, (int)(source.Width * scale)), Math.Max(100, (int)(source.Height * scale)));
        }
    }

    internal static class WorkspaceVisuals
    {
        internal static void ConfigureRendering(Graphics graphics)
        {
            graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
            graphics.CompositingQuality = System.Drawing.Drawing2D.CompositingQuality.HighQuality;
            graphics.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
            // ClearType adds RGB sub-pixel fringes when text is composited
            // over Acrylic. Grayscale anti-aliasing keeps labels sharp after
            // the translucent surface is blended by DWM.
            graphics.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
            graphics.TextContrast = 0;
        }

        internal static System.Drawing.Drawing2D.GraphicsPath CreateRoundedPath(Rectangle rectangle, int radius)
        {
            int diameter = radius * 2;
            System.Drawing.Drawing2D.GraphicsPath path = new System.Drawing.Drawing2D.GraphicsPath();
            path.AddArc(rectangle.Left, rectangle.Top, diameter, diameter, 180, 90);
            path.AddArc(rectangle.Right - diameter, rectangle.Top, diameter, diameter, 270, 90);
            path.AddArc(rectangle.Right - diameter, rectangle.Bottom - diameter, diameter, diameter, 0, 90);
            path.AddArc(rectangle.Left, rectangle.Bottom - diameter, diameter, diameter, 90, 90);
            path.CloseFigure();
            return path;
        }
    }

    internal static class WorkspaceVisualMetrics
    {
        public const int CardTop = 108;
        public const int CardGap = 8;
        public const int CardHeight = 80;
        public const int AddBlockHeight = 80;
        public const int SideMargin = 20;
        public const int PanelWidth = 520;
        public const int PanelHeight = 360;
        public const int PanelMinimumWidth = 360;
        public const int PanelMinimumHeight = 300;
        public const int PanelMaximumWidth = 760;
        public const int PanelMaximumHeight = 0;
        public const int PanelResizeGrip = 12;
        public const int PanelRadius = 20;
        public const int PanelBorderInset = 1;
        public const int PanelBorderArgb = unchecked((int)0x24FFFFFF);
        public const int GridGap = 8;
        public const int PanelBackgroundArgb = -459777;
        public const int PanelGlassBackgroundArgb = 1727593471;
        public const int CardBackgroundArgb = -1;
        public const int ActiveCardBackgroundArgb = -1182465;
        public const int CardBorderArgb = -2366225;
        public const int ActiveCardBorderArgb = -11828239;
        public const int TextArgb = -15523272;
        public const int MutedTextArgb = -10062451;
        public const int AccentArgb = -14128933;
        public const int AddBorderArgb = -2366225;
        public const int AppButtonBackgroundArgb = -459777;
        public const int AppButtonActiveBackgroundArgb = -1182465;
        public const int AppButtonBorderArgb = -2366225;
        public const int AppButtonActiveBorderArgb = -11828239;
        public const int CardFillAlpha = 255;
        public const int CardRadius = 18;
        public const int AddBlockRadius = 18;
        public const int AppButtonRadius = 10;
        public const int AppButtonHorizontalPadding = 12;
        public const int AppButtonVerticalPadding = 7;
        public const int AppButtonHorizontalGap = 8;
        public const int AppButtonVerticalGap = 12;
        public const int DisplayTabTop = 48;
        public const int DisplayTabHeight = 36;
        public const int DisplayTabGap = 6;
        public const int DisplayTabRadius = 8;
        public const float TitleFontSize = 22f;
        public const float ItemFontSize = 17f;
        public const float AddTitleFontSize = 22f;
        public const float SmallFontSize = 11f;
        public const int HideButtonWidth = 72;
        public const int HideButtonHeight = 34;
        public const int HideButtonRadius = 8;
        public const int HideButtonTopMargin = 6;
        public const float ControlFontSize = 16f;
        public const float HideButtonFontSize = ControlFontSize;
        public const int RefreshButtonWidth = 110;
        public const int RefreshButtonHeight = 34;
        public const int RefreshButtonRadius = 8;
        public const int DeleteButtonWidth = 58;
        public const int DeleteButtonHeight = 24;
        public const int DeleteButtonRadius = 7;
        public const int DeleteButtonTopOffset = 5;
        public const float DeleteButtonFontSize = 14f;
        public const int DeleteButtonArgb = -5036746;
        public const int DeleteButtonBorderArgb = -1933766;
        public const string FontFamilyName = "Microsoft YaHei UI";
        public const double SidebarOpacity = 1.0d;
    }

    internal sealed class WorkspaceDragGhostForm : Form
    {
        private readonly string label;

        internal WorkspaceDragGhostForm(string workspaceLabel)
        {
            label = workspaceLabel;
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            TopMost = true;
            Opacity = 0.88;
            Size = new Size(300, 58);
            DoubleBuffered = true;
        }

        protected override bool ShowWithoutActivation { get { return true; } }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams parameters = base.CreateParams;
                parameters.ExStyle |= 0x08000000;
                parameters.ExStyle |= 0x00000080;
                parameters.ExStyle |= 0x00000020;
                return parameters;
            }
        }

        protected override void WndProc(ref Message message)
        {
            if (message.Msg == NativeMethods.WM_NCHITTEST)
            {
                message.Result = new IntPtr(NativeMethods.HTTRANSPARENT);
                return;
            }

            base.WndProc(ref message);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            WorkspaceVisuals.ConfigureRendering(e.Graphics);
            using (System.Drawing.Drawing2D.GraphicsPath path = WorkspaceVisuals.CreateRoundedPath(new Rectangle(1, 1, ClientSize.Width - 3, ClientSize.Height - 3), WorkspaceVisualMetrics.CardRadius))
            using (Brush fill = new SolidBrush(Color.FromArgb(WorkspaceVisualMetrics.ActiveCardBackgroundArgb)))
            using (Pen border = new Pen(Color.FromArgb(WorkspaceVisualMetrics.ActiveCardBorderArgb), 2f))
            using (Brush foreground = new SolidBrush(Color.FromArgb(WorkspaceVisualMetrics.TextArgb)))
            using (Font font = new Font(WorkspaceVisualMetrics.FontFamilyName, 9f, FontStyle.Bold, GraphicsUnit.Pixel))
            {
                e.Graphics.FillPath(fill, path);
                e.Graphics.DrawPath(border, path);
                e.Graphics.DrawString(label, font, foreground, 16, 18);
            }
        }

        internal void MoveToPointer(Point pointer)
        {
            Location = new Point(pointer.X - Width / 2, pointer.Y - Height / 2);
        }
    }

    public sealed class WorkspaceForm : Form
    {
        private sealed class WorkspaceItemLayout
        {
            internal WorkspaceItem Item;
            internal string Label;
            internal Rectangle Bounds;
        }

        private sealed class DisplayTabLayout
        {
            internal string DeviceName;
            internal string Label;
            internal Rectangle Bounds;
        }

        private const int HotKeyId = 7101;
        private const int WorkspaceHotKeyIdBase = HotKeyId + 1;
        private const int AddBlockHeight = WorkspaceVisualMetrics.AddBlockHeight;
        private const int HideButtonWidth = WorkspaceVisualMetrics.HideButtonWidth;
        private const int HideButtonHeight = WorkspaceVisualMetrics.HideButtonHeight;
        private readonly WorkspaceCatalog catalog = new WorkspaceCatalog();
        private readonly WorkspaceLayout workspaceLayout = new WorkspaceLayout();
        private readonly string statePath;
        private readonly System.Windows.Forms.Timer dragTimer = new System.Windows.Forms.Timer();
        private int activeWorkspace = 1;
        private long selectedApplicationWindowHandle;
        private string selectedDisplayDeviceName = String.Empty;
        private ContextMenuStrip displayContextMenu;
        private IntPtr dragSource = IntPtr.Zero;
        private bool dragging;
        private IntPtr dragCandidate = IntPtr.Zero;
        private NativeMethods.Point dragCandidateStart;
        private int highlightedWorkspace;
        private bool highlightedAddBlock;
        private int hoveredWorkspaceId;
        private DragPreviewForm dragPreview;
        private bool dragSourceWasMaximized;
        private IntPtr foregroundEventHook = IntPtr.Zero;
        private NativeMethods.WinEventDelegate foregroundEventCallback;
        private IntPtr windowStateEventHook = IntPtr.Zero;
        private NativeMethods.WinEventDelegate windowStateEventCallback;
        private readonly System.Collections.Generic.HashSet<long> pendingWorkspaceMinimizeEvents =
            new System.Collections.Generic.HashSet<long>();
        private readonly System.Collections.Generic.HashSet<long> workspaceMinimizedWindows =
            new System.Collections.Generic.HashSet<long>();
        private bool usingRegisteredHotKey;
        private readonly bool[] workspaceHotKeysRegistered = new bool[WorkspaceLayout.MaximumWorkspaceCount];
        private IntPtr keyboardHook = IntPtr.Zero;
        private NativeMethods.LowLevelKeyboardProc keyboardHookCallback;
        private bool lowLevelHotkeyDown;
        private bool lowLevelControlDown;
        private bool lowLevelAltDown;
        private bool isHandlingForegroundActivation;
        private int foregroundSyncSuppression;
        private bool panelIsPassive;
        private int workspaceCardPressed;
        private int workspaceCardDropIndex = -1;
        private Point workspaceCardPressPoint;
        private bool isReorderingWorkspaces;
        private bool ignoreNextClick;
        private WorkspaceDragGhostForm workspaceGhost;
        private readonly System.Collections.Generic.Dictionary<int, int> workspaceHeights = new System.Collections.Generic.Dictionary<int, int>();
        private int resizingWorkspaceId;
        private int resizeStartY;
        private int resizeStartHeight;
        private bool isDraggingPanel;
        private Point panelDragStartScreen;
        private Point panelDragStartLocation;
        private PanelResizeEdge panelResizeEdge;
        private Point panelResizeStartScreen;
        private Rectangle panelResizeStartBounds;
        private Rectangle savedPanelBounds;
        private Size savedPanelLogicalSize;
        private bool hasSavedPanelBounds;
        private bool hasSavedPanelLogicalSize;
        private int currentDpi = DpiLayoutPolicy.BaseDpi;
        private int contentScrollOffset;
        private bool nativeGlassBackdropApplied;
        private readonly System.Windows.Forms.Timer applicationClickTimer = new System.Windows.Forms.Timer();
        private readonly System.Windows.Forms.Timer glassRefreshTimer = new System.Windows.Forms.Timer();
        private readonly System.Collections.Generic.HashSet<long> launchProfileCapturePending = new System.Collections.Generic.HashSet<long>();
        private WorkspaceItem pendingApplicationClick;
        private bool isClosing;

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                isClosing = true;
                dragTimer.Stop();
                applicationClickTimer.Stop();
                glassRefreshTimer.Stop();
                DisposeDisplayContextMenu();
                dragTimer.Dispose();
                applicationClickTimer.Dispose();
                glassRefreshTimer.Dispose();
            }

            base.Dispose(disposing);
        }

        public WorkspaceForm()
        {
            statePath = GetWorkspaceStatePath();
            MigrateLegacyStateIfNeeded();
            AutoScaleMode = AutoScaleMode.None;
            BackColor = Color.FromArgb(WorkspaceVisualMetrics.PanelBackgroundArgb);
            DoubleBuffered = true;
            SetStyle(ControlStyles.SupportsTransparentBackColor | ControlStyles.ResizeRedraw, true);
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            TopMost = true;
            Width = WorkspaceVisualMetrics.PanelWidth;
            Height = WorkspaceVisualMetrics.PanelHeight;
            LoadState();
            RefreshWorkspaceAvailability();
            Resize += delegate { UpdatePanelRegion(); Invalidate(true); Update(); };
            UpdatePanelRegion();
            applicationClickTimer.Interval = Math.Max(1, SystemInformation.DoubleClickTime);
            applicationClickTimer.Tick += delegate { FlushPendingWorkspaceItemClick(); };
            glassRefreshTimer.Interval = 1000;
            glassRefreshTimer.Tick += delegate
            {
                if (Visible)
                {
                    Invalidate();
                }
            };
            glassRefreshTimer.Start();
            dragTimer.Interval = 16;
            dragTimer.Tick += delegate { PollDrag(); };
            MouseWheel += delegate(object sender, MouseEventArgs args)
            {
                Point logicalPoint = ToLogicalPoint(args.Location);
                if (!GetContentViewportBounds().Contains(logicalPoint))
                {
                    return;
                }

                int step = Math.Max(24, (int)Math.Round(WorkspaceVisualMetrics.ItemFontSize * 2));
                SetContentScrollOffset(contentScrollOffset - Math.Sign(args.Delta) * step);
                Invalidate();
            };
            MouseDown += delegate(object sender, MouseEventArgs args)
            {
                if (args.Button != MouseButtons.Left)
                {
                    return;
                }

                Point logicalPoint = ToLogicalPoint(args.Location);
                Size logicalClientSize = GetLogicalClientSize();
                panelResizeEdge = WorkspacePanelLayout.GetResizeEdgeAt(logicalPoint, logicalClientSize, WorkspaceVisualMetrics.PanelResizeGrip);
                if (panelResizeEdge != PanelResizeEdge.None)
                {
                    panelResizeStartScreen = PointToScreen(args.Location);
                    panelResizeStartBounds = Bounds;
                    ignoreNextClick = true;
                    Capture = true;
                    return;
                }

                int resizeWorkspaceId = GetResizeHandleAt(logicalPoint.X, logicalPoint.Y);
                if (resizeWorkspaceId != 0)
                {
                    resizingWorkspaceId = resizeWorkspaceId;
                    resizeStartY = logicalPoint.Y;
                    resizeStartHeight = GetWorkspaceCardHeight(resizeWorkspaceId);
                    ignoreNextClick = true;
                    Capture = true;
                    return;
                }

                if (CanDragPanelAt(logicalPoint))
                {
                    isDraggingPanel = true;
                    panelDragStartScreen = PointToScreen(args.Location);
                    panelDragStartLocation = Location;
                    ignoreNextClick = true;
                    Capture = true;
                    return;
                }

                if (GetDeleteButtonWorkspaceAt(logicalPoint.X, logicalPoint.Y) != 0)
                {
                    workspaceCardPressed = 0;
                    Capture = false;
                    return;
                }

                workspaceCardPressed = GetWorkspaceAt(logicalPoint.X, logicalPoint.Y);
                workspaceCardPressPoint = logicalPoint;
            Capture = true;
            };
            MouseMove += delegate(object sender, MouseEventArgs args)
            {
                Point logicalPoint = ToLogicalPoint(args.Location);
                if (panelResizeEdge != PanelResizeEdge.None)
                {
                    if (args.Button == MouseButtons.Left)
                    {
                        ResizePanel(PointToScreen(args.Location));
                    }
                    return;
                }

                if (isDraggingPanel)
                {
                    if (args.Button == MouseButtons.Left)
                    {
                        Point cursor = PointToScreen(args.Location);
                        Location = new Point(panelDragStartLocation.X + cursor.X - panelDragStartScreen.X, panelDragStartLocation.Y + cursor.Y - panelDragStartScreen.Y);
                        Invalidate();
                    }
                    return;
                }

                if (resizingWorkspaceId != 0)
                {
                    if (args.Button == MouseButtons.Left)
                    {
                        SetWorkspaceHeight(resizingWorkspaceId, resizeStartHeight + logicalPoint.Y - resizeStartY);
                        Invalidate();
                    }
                    return;
                }

                if (args.Button == MouseButtons.None)
                {
                    PanelResizeEdge edge = WorkspacePanelLayout.GetResizeEdgeAt(logicalPoint, GetLogicalClientSize(), WorkspaceVisualMetrics.PanelResizeGrip);
                    Cursor = GetPanelResizeCursor(edge);
                    if (edge == PanelResizeEdge.None)
                    {
                        Cursor = GetResizeHandleAt(logicalPoint.X, logicalPoint.Y) == 0 ? (CanDragPanelAt(logicalPoint) ? Cursors.SizeAll : Cursors.Default) : Cursors.SizeNS;
                    }

                    int nextHoveredWorkspaceId = GetWorkspaceAt(logicalPoint.X, logicalPoint.Y);
                    if (hoveredWorkspaceId != nextHoveredWorkspaceId)
                    {
                        hoveredWorkspaceId = nextHoveredWorkspaceId;
                        Invalidate();
                    }
                }

                if (workspaceCardPressed <= 1 || args.Button != MouseButtons.Left)
                {
                    return;
                }

                if (!isReorderingWorkspaces && WorkspaceDragPolicy.ShouldStartReorder(workspaceCardPressed, logicalPoint.X - workspaceCardPressPoint.X, logicalPoint.Y - workspaceCardPressPoint.Y))
                {
                    isReorderingWorkspaces = true;
                    workspaceGhost = new WorkspaceDragGhostForm("工作区 " + workspaceCardPressed);
                    workspaceGhost.MoveToPointer(PointToScreen(args.Location));
                    workspaceGhost.Show(this);
                }

                if (isReorderingWorkspaces)
                {
                    workspaceCardDropIndex = GetWorkspaceInsertIndex(logicalPoint.Y);
                    if (workspaceGhost != null)
                    {
                        workspaceGhost.MoveToPointer(PointToScreen(args.Location));
                    }
                    Invalidate();
                }
            };
            MouseClick += delegate(object sender, MouseEventArgs args)
            {
                if (args.Button != MouseButtons.Left)
                {
                    return;
                }

                Point logicalPoint = ToLogicalPoint(args.Location);

                if (ignoreNextClick)
                {
                    ignoreNextClick = false;
                    CancelPendingWorkspaceItemClick();
                    return;
                }

                DisplayTabLayout displayTab = GetDisplayTabAt(logicalPoint.X, logicalPoint.Y);
                if (displayTab != null)
                {
                    CancelPendingWorkspaceItemClick();
                    selectedDisplayDeviceName = displayTab.DeviceName ?? String.Empty;
                    Invalidate();
                    return;
                }

                if (IsHideButtonAt(logicalPoint.X, logicalPoint.Y))
                {
                    CancelPendingWorkspaceItemClick();
                    Hide();
                    return;
                }

                if (IsRefreshButtonAt(logicalPoint.X, logicalPoint.Y))
                {
                    CancelPendingWorkspaceItemClick();
                    RefreshWorkspaceState();
                    return;
                }

                if (IsAddBlockAt(logicalPoint.Y))
                {
                    CancelPendingWorkspaceItemClick();
                    CreateWorkspaceFromAddBlock();
                    return;
                }

                int workspaceToDelete = GetDeleteButtonWorkspaceAt(logicalPoint.X, logicalPoint.Y);
                if (workspaceToDelete != 0)
                {
                    CancelPendingWorkspaceItemClick();
                    ConfirmWorkspaceDeletion(workspaceToDelete);
                    return;
                }

                WorkspaceItem selectedItem = GetWorkspaceItemAt(logicalPoint.X, logicalPoint.Y);
                if (selectedItem != null)
                {
                    workspaceCardPressed = 0;
                    FocusWorkspaceItem(selectedItem);
                    return;
                }

                CancelPendingWorkspaceItemClick();
                int id = GetWorkspaceAt(logicalPoint.X, logicalPoint.Y);
                int pressedWorkspaceId = workspaceCardPressed;
                workspaceCardPressed = 0;
                if (WorkspaceCardClickPolicy.ShouldActivate(pressedWorkspaceId, id))
                {
                    ShowWorkspace(pressedWorkspaceId);
                }
            };
            MouseUp += delegate(object sender, MouseEventArgs args)
            {
                Point logicalPoint = ToLogicalPoint(args.Location);
                if (args.Button == MouseButtons.Right)
                {
                    CancelPendingWorkspaceItemClick();
                    WorkspaceItem contextItem = GetWorkspaceItemAt(logicalPoint.X, logicalPoint.Y);
                    if (contextItem != null)
                    {
                        ShowDisplayContextMenu(contextItem, PointToScreen(args.Location));
                        return;
                    }

                    if (logicalPoint.Y < CardTop)
                    {
                        ExitAndRestore();
                    }
                }
                else if (args.Button == MouseButtons.Left && panelResizeEdge != PanelResizeEdge.None)
                {
                    panelResizeEdge = PanelResizeEdge.None;
                    hasSavedPanelBounds = true;
                    savedPanelBounds = Bounds;
                    UpdateSavedLogicalSizeFromBounds(Bounds.Size);
                    SaveState();
                    ignoreNextClick = true;
                    Capture = false;
                    return;
                }
                else if (args.Button == MouseButtons.Left && isDraggingPanel)
                {
                    isDraggingPanel = false;
                    hasSavedPanelBounds = true;
                    savedPanelBounds = Bounds;
                    SaveState();
                    ignoreNextClick = true;
                    Capture = false;
                    return;
                }
                else if (args.Button == MouseButtons.Left && resizingWorkspaceId != 0)
                {
                    SaveState();
                    resizingWorkspaceId = 0;
                    workspaceCardPressed = 0;
                    workspaceCardDropIndex = -1;
                    ignoreNextClick = true;
                    Capture = false;
                    Invalidate();
                    return;
                }
                else if (args.Button == MouseButtons.Left && isReorderingWorkspaces)
                {
                    MoveWorkspaceToIndex(workspaceCardPressed, workspaceCardDropIndex);
                    EndWorkspaceCardReorder();
                    workspaceCardPressed = 0;
                    workspaceCardDropIndex = -1;
                    ignoreNextClick = true;
                    Invalidate();
                }
                if (args.Button == MouseButtons.Left)
                {
                    Capture = false;
                }
            };
            MouseDoubleClick += delegate(object sender, MouseEventArgs args)
            {
                if (args.Button == MouseButtons.Left && !ignoreNextClick
                    && !isReorderingWorkspaces && !isDraggingPanel
                    && panelResizeEdge == PanelResizeEdge.None && resizingWorkspaceId == 0)
                {
                    CancelPendingWorkspaceItemClick();
                    Point logicalPoint = ToLogicalPoint(args.Location);
                    WorkspaceItem selectedItem = GetWorkspaceItemAt(logicalPoint.X, logicalPoint.Y);
                    if (selectedItem != null)
                    {
                        ToggleWindowMaximize(selectedItem);
                        return;
                    }

                    int id = GetWorkspaceAt(logicalPoint.X, logicalPoint.Y);
                    int pressedWorkspaceId = workspaceCardPressed;
                    workspaceCardPressed = 0;
                    if (GetDeleteButtonWorkspaceAt(logicalPoint.X, logicalPoint.Y) == 0
                        && WorkspaceCardClickPolicy.ShouldMinimize(pressedWorkspaceId, id, args.Clicks))
                    {
                        ShowWorkspace(pressedWorkspaceId, 0, true);
                    }
                }
            };
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            currentDpi = GetWindowDpi();
            // Use Win32 Acrylic. The compositor performs the blur behind the
            // client area; this form never samples or repaints the desktop.
            nativeGlassBackdropApplied = GlassWindowBackdrop.TryApply(Handle);
            usingRegisteredHotKey = NativeMethods.RegisterHotKey(Handle, HotKeyId, NativeMethods.MOD_CONTROL | NativeMethods.MOD_ALT, NativeMethods.VK_SPACE);
            RegisterWorkspaceHotKeys();
            if (!usingRegisteredHotKey)
            {
                InstallKeyboardHook();
            }
            foregroundEventCallback = OnForegroundWindowChanged;
            foregroundEventHook = NativeMethods.SetWinEventHook(
                NativeMethods.EVENT_SYSTEM_FOREGROUND,
                NativeMethods.EVENT_SYSTEM_FOREGROUND,
                IntPtr.Zero,
                foregroundEventCallback,
                0,
                0,
                NativeMethods.WINEVENT_OUTOFCONTEXT | NativeMethods.WINEVENT_SKIPOWNPROCESS);
            windowStateEventCallback = OnTrackedWindowStateChanged;
            windowStateEventHook = NativeMethods.SetWinEventHook(
                NativeMethods.EVENT_SYSTEM_MINIMIZESTART,
                NativeMethods.EVENT_SYSTEM_MINIMIZEEND,
                IntPtr.Zero,
                windowStateEventCallback,
                0,
                0,
                NativeMethods.WINEVENT_OUTOFCONTEXT | NativeMethods.WINEVENT_SKIPOWNPROCESS);
            CaptureInitialMinimizedWindowStates();
            PlaceAtCenter();
            RefreshWorkspaceState();
        }

        protected override void OnHandleDestroyed(EventArgs e)
        {
            if (usingRegisteredHotKey)
            {
                NativeMethods.UnregisterHotKey(Handle, HotKeyId);
                usingRegisteredHotKey = false;
            }
            for (int index = 0; index < workspaceHotKeysRegistered.Length; index++)
            {
                if (workspaceHotKeysRegistered[index])
                {
                    NativeMethods.UnregisterHotKey(Handle, WorkspaceHotKeyIdBase + index);
                    workspaceHotKeysRegistered[index] = false;
                }
            }
            UninstallKeyboardHook();
            if (foregroundEventHook != IntPtr.Zero)
            {
                NativeMethods.UnhookWinEvent(foregroundEventHook);
                foregroundEventHook = IntPtr.Zero;
            }
            if (windowStateEventHook != IntPtr.Zero)
            {
                NativeMethods.UnhookWinEvent(windowStateEventHook);
                windowStateEventHook = IntPtr.Zero;
            }

            nativeGlassBackdropApplied = false;
            foregroundEventCallback = null;
            windowStateEventCallback = null;
            pendingWorkspaceMinimizeEvents.Clear();
            workspaceMinimizedWindows.Clear();
            base.OnHandleDestroyed(e);
        }

        private void InstallKeyboardHook()
        {
            if (keyboardHook != IntPtr.Zero)
            {
                return;
            }

            keyboardHookCallback = LowLevelKeyboardHookCallback;
            try
            {
                keyboardHook = NativeMethods.SetWindowsHookEx(
                    NativeMethods.WH_KEYBOARD_LL,
                    keyboardHookCallback,
                    NativeMethods.GetModuleHandle(null),
                    0);
            }
            catch (EntryPointNotFoundException)
            {
                keyboardHook = IntPtr.Zero;
            }
            catch (DllNotFoundException)
            {
                keyboardHook = IntPtr.Zero;
            }
        }

        private void RegisterWorkspaceHotKeys()
        {
            for (int index = 0; index < workspaceHotKeysRegistered.Length; index++)
            {
                // A registration conflict disables only that digit. The fallback
                // hook remains reserved for Ctrl+Alt+Space so other applications'
                // shortcuts are never intercepted.
                workspaceHotKeysRegistered[index] = NativeMethods.RegisterHotKey(
                    Handle,
                    WorkspaceHotKeyIdBase + index,
                    NativeMethods.MOD_CONTROL | NativeMethods.MOD_ALT,
                    (uint)(NativeMethods.VK_1 + index));
            }
        }

        private void UninstallKeyboardHook()
        {
            if (keyboardHook != IntPtr.Zero)
            {
                NativeMethods.UnhookWindowsHookEx(keyboardHook);
                keyboardHook = IntPtr.Zero;
            }

            keyboardHookCallback = null;
            lowLevelHotkeyDown = false;
            lowLevelControlDown = false;
            lowLevelAltDown = false;
        }

        private IntPtr LowLevelKeyboardHookCallback(int code, IntPtr message, IntPtr data)
        {
            if (code >= 0)
            {
                int messageId = message.ToInt32();
                bool isKeyDown = messageId == NativeMethods.WM_KEYDOWN || messageId == NativeMethods.WM_SYSKEYDOWN;
                bool isKeyUp = messageId == NativeMethods.WM_KEYUP || messageId == NativeMethods.WM_SYSKEYUP;
                NativeMethods.KeyboardInput input = (NativeMethods.KeyboardInput)Marshal.PtrToStructure(data, typeof(NativeMethods.KeyboardInput));
                if (input.VirtualKeyCode == NativeMethods.VK_LCONTROL || input.VirtualKeyCode == NativeMethods.VK_RCONTROL)
                {
                    if (isKeyDown)
                    {
                        lowLevelControlDown = true;
                    }
                    else if (isKeyUp)
                    {
                        lowLevelControlDown = false;
                    }
                }
                else if (input.VirtualKeyCode == NativeMethods.VK_LMENU || input.VirtualKeyCode == NativeMethods.VK_RMENU)
                {
                    if (isKeyDown)
                    {
                        lowLevelAltDown = true;
                    }
                    else if (isKeyUp)
                    {
                        lowLevelAltDown = false;
                    }
                }
                else if (input.VirtualKeyCode == NativeMethods.VK_SPACE)
                {
                    if (isKeyDown && lowLevelControlDown && lowLevelAltDown && !lowLevelHotkeyDown)
                    {
                        lowLevelHotkeyDown = true;
                        if (IsHandleCreated && !IsDisposed)
                        {
                            NativeMethods.PostMessage(Handle, NativeMethods.WM_HOTKEY, new IntPtr(HotKeyId), IntPtr.Zero);
                        }

                        return new IntPtr(1);
                    }

                    if (isKeyUp && lowLevelHotkeyDown)
                    {
                        lowLevelHotkeyDown = false;
                        return new IntPtr(1);
                    }
                }
            }

            return NativeMethods.CallNextHookEx(keyboardHook, code, message, data);
        }

        protected override void WndProc(ref Message message)
        {
            if (message.Msg == NativeMethods.WM_SHOW_PANEL)
            {
                ShowPanelFromExternalRequest();
                return;
            }

            if (message.Msg == NativeMethods.WM_HOTKEY)
            {
                int hotKeyId = message.WParam.ToInt32();
                if (hotKeyId == HotKeyId)
                {
                    TogglePanel();
                    return;
                }

                if (hotKeyId >= WorkspaceHotKeyIdBase
                    && hotKeyId < WorkspaceHotKeyIdBase + WorkspaceLayout.MaximumWorkspaceCount)
                {
                    int workspaceId = WorkspaceHotKeyPolicy.ResolveWorkspaceId(
                        hotKeyId,
                        WorkspaceHotKeyIdBase,
                        workspaceLayout.GetWorkspaceIds());
                    if (workspaceId != 0)
                    {
                        ShowWorkspace(workspaceId);
                    }

                    return;
                }
            }

            if (message.Msg == NativeMethods.WM_MOUSEACTIVATE)
            {
                message.Result = new IntPtr(NativeMethods.MA_NOACTIVATE);
                return;
            }

            if (message.Msg == NativeMethods.WM_DPICHANGED)
            {
                KeepPanelSizeOnDpiChange(
                    GetDpiFromMessage(message.WParam),
                    GetSuggestedDpiBounds(message.LParam));
                message.Result = IntPtr.Zero;
                return;
            }

            if (panelIsPassive && message.Msg == NativeMethods.WM_NCHITTEST)
            {
                int screenX = unchecked((short)(long)message.LParam);
                int screenY = unchecked((short)(((long)message.LParam) >> 16));
                Point clientPoint = ToLogicalPoint(PointToClient(new Point(screenX, screenY)));
                message.Result = new IntPtr(IsPanelInteractiveAt(clientPoint)
                    ? NativeMethods.HTCLIENT
                    : NativeMethods.HTTRANSPARENT);
                return;
            }

            if (message.Msg == NativeMethods.WM_ERASEBKGND && nativeGlassBackdropApplied)
            {
                message.Result = new IntPtr(1);
                return;
            }

            base.WndProc(ref message);
        }

        private void ShowPanelFromExternalRequest()
        {
            if (isClosing || IsDisposed || Disposing)
            {
                return;
            }

            if (!Visible)
            {
                PlaceAtCenter();
                Show();
            }

            EnsureAlwaysOnTop();
            Invalidate();
        }

        private bool IsPanelInteractiveAt(Point clientPoint)
        {
            Size logicalClientSize = GetLogicalClientSize();
            if (clientPoint.X < 0 || clientPoint.Y < 0
                || clientPoint.X >= logicalClientSize.Width
                || clientPoint.Y >= logicalClientSize.Height)
            {
                return false;
            }

            if (GetDisplayTabAt(clientPoint.X, clientPoint.Y) != null
                || IsHideButtonAt(clientPoint.X, clientPoint.Y)
                || IsRefreshButtonAt(clientPoint.X, clientPoint.Y)
                || IsAddBlockAt(clientPoint.Y)
                || GetDeleteButtonWorkspaceAt(clientPoint.X, clientPoint.Y) != 0
                || GetResizeHandleAt(clientPoint.X, clientPoint.Y) != 0
                || WorkspacePanelLayout.GetResizeEdgeAt(clientPoint, GetLogicalClientSize(), WorkspaceVisualMetrics.PanelResizeGrip) != PanelResizeEdge.None
                || GetWorkspaceAt(clientPoint.X, clientPoint.Y) != 0
                || GetWorkspaceItemAt(clientPoint.X, clientPoint.Y) != null)
            {
                return true;
            }

            return CanDragPanelAt(clientPoint);
        }

        protected override bool ShowWithoutActivation
        {
            get { return true; }
        }

        protected override void OnVisibleChanged(EventArgs e)
        {
            base.OnVisibleChanged(e);
            if (isClosing || IsDisposed || Disposing)
            {
                return;
            }

            if (Visible && IsHandleCreated)
            {
                // The handle-created attempt can report success before DWM has
                // attached the Acrylic surface. Always reapply after the popup
                // is visible, then make one queued retry for the compositor.
                nativeGlassBackdropApplied = false;
                TryAttachNativeGlassBackdrop();
                QueueBackdropRetry();
            }
            dragTimer.Enabled = Visible;
            if (Visible)
            {
                PlaceAtCenter();
                EnsureAlwaysOnTop();
                Invalidate();
            }
        }

        private void QueueBackdropRetry()
        {
            if (isClosing || IsDisposed || Disposing || !IsHandleCreated)
            {
                return;
            }

            try
            {
                BeginInvoke((MethodInvoker)(() =>
                {
                    if (isClosing || IsDisposed || Disposing || !IsHandleCreated || !Visible)
                    {
                        return;
                    }

                    nativeGlassBackdropApplied = false;
                    TryAttachNativeGlassBackdrop();
                }));
            }
            catch (ObjectDisposedException)
            {
            }
            catch (InvalidOperationException)
            {
            }
        }

        private void TryAttachNativeGlassBackdrop()
        {
            if (!Visible || !IsHandleCreated || nativeGlassBackdropApplied || IsDisposed)
            {
                return;
            }

            nativeGlassBackdropApplied = GlassWindowBackdrop.TryApply(Handle);
            if (nativeGlassBackdropApplied)
            {
                ClearPanelRegion();
                Invalidate(true);
            }
        }

        private void UpdatePanelRegion()
        {
            if (nativeGlassBackdropApplied)
            {
                ClearPanelRegion();
                return;
            }

            if (ClientSize.Width < ScaleLogicalValue(WorkspaceVisualMetrics.PanelRadius * 2)
                || ClientSize.Height < ScaleLogicalValue(WorkspaceVisualMetrics.PanelRadius * 2))
            {
                return;
            }

            using (System.Drawing.Drawing2D.GraphicsPath path = WorkspaceVisuals.CreateRoundedPath(
                GetPanelDeviceShapeBounds(),
                ScaleLogicalValue(GetPanelShapeRadius())))
            {
                Region previousRegion = Region;
                Region = new Region(path);
                if (previousRegion != null)
                {
                    previousRegion.Dispose();
                }
            }
        }

        private void ClearPanelRegion()
        {
            Region previousRegion = Region;
            Region = null;
            if (previousRegion != null)
            {
                previousRegion.Dispose();
            }
        }

        private Rectangle GetPanelShapeBounds()
        {
            int inset = WorkspaceVisualMetrics.PanelBorderInset;
            Size logicalClientSize = GetLogicalClientSize();
            return new Rectangle(
                inset,
                inset,
                Math.Max(1, logicalClientSize.Width - inset * 2),
                Math.Max(1, logicalClientSize.Height - inset * 2));
        }

        private Rectangle GetPanelDeviceShapeBounds()
        {
            int inset = ScaleLogicalValue(WorkspaceVisualMetrics.PanelBorderInset);
            return new Rectangle(
                inset,
                inset,
                Math.Max(1, ClientSize.Width - inset * 2),
                Math.Max(1, ClientSize.Height - inset * 2));
        }

        private int GetPanelShapeRadius()
        {
            return Math.Max(1, WorkspaceVisualMetrics.PanelRadius - WorkspaceVisualMetrics.PanelBorderInset);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            Graphics graphics = e.Graphics;
            ConfigureRendering(graphics);
            Rectangle panelScreenBounds = RectangleToScreen(ClientRectangle);
            Rectangle screenBounds = Screen.FromHandle(Handle).Bounds;
            // Some Windows builds return success from the native Acrylic API
            // while rendering only a flat system surface. Always keep the
            // verified wallpaper glass layer as a visible fallback; native
            // Acrylic remains enabled as a compositor enhancement.
            bool wallpaperGlassRendered = !nativeGlassBackdropApplied && WallpaperGlassSurface.TryRender(
                graphics,
                ClientRectangle,
                panelScreenBounds,
                screenBounds,
                WorkspaceVisualMetrics.PanelRadius);
            if (!wallpaperGlassRendered && !nativeGlassBackdropApplied)
            {
                graphics.Clear(Color.FromArgb(WorkspaceVisualMetrics.PanelBackgroundArgb));
            }
            graphics.ScaleTransform((float)currentDpi / DpiLayoutPolicy.BaseDpi, (float)currentDpi / DpiLayoutPolicy.BaseDpi);
            if (!nativeGlassBackdropApplied)
            {
                using (System.Drawing.Drawing2D.GraphicsPath panelPath = WorkspaceVisuals.CreateRoundedPath(
                    GetPanelShapeBounds(), GetPanelShapeRadius()))
                using (Pen glassBorder = new Pen(Color.FromArgb(WorkspaceVisualMetrics.PanelBorderArgb), 1f))
                {
                    graphics.DrawPath(glassBorder, panelPath);
                }
            }
            using (Font titleFont = CreateTextFont(WorkspaceVisualMetrics.TitleFontSize, FontStyle.Bold))
            using (Font itemFont = CreateTextFont(WorkspaceVisualMetrics.ItemFontSize, FontStyle.Regular))
            using (Font addTitleFont = CreateTextFont(WorkspaceVisualMetrics.AddTitleFontSize, FontStyle.Bold))
            using (Font smallFont = CreateTextFont(WorkspaceVisualMetrics.SmallFontSize, FontStyle.Regular))
            using (Font displayTabFont = CreateTextFont(WorkspaceVisualMetrics.ControlFontSize, FontStyle.Regular))
            using (Brush muted = new SolidBrush(Color.FromArgb(WorkspaceVisualMetrics.MutedTextArgb)))
            {
                DrawDisplayTabs(graphics, displayTabFont);
                SetContentScrollOffset(contentScrollOffset);
                System.Drawing.Drawing2D.GraphicsState contentState = graphics.Save();
                graphics.SetClip(GetContentViewportBounds());
                graphics.TranslateTransform(0, -contentScrollOffset);
                foreach (int id in workspaceLayout.GetWorkspaceIds())
                {
                    Rectangle card = GetWorkspaceCardBounds(id);
                    bool isActive = id == activeWorkspace;
                    bool isDropTarget = id == highlightedWorkspace;
                    Color fill = isDropTarget || isActive
                        ? Color.FromArgb(WorkspaceVisualMetrics.ActiveCardBackgroundArgb)
                        : Color.FromArgb(WorkspaceVisualMetrics.CardBackgroundArgb);
                    Color border = isDropTarget || isActive
                        ? Color.FromArgb(WorkspaceVisualMetrics.ActiveCardBorderArgb)
                        : Color.FromArgb(WorkspaceVisualMetrics.CardBorderArgb);
                    using (System.Drawing.Drawing2D.GraphicsPath cardPath = WorkspaceVisuals.CreateRoundedPath(card, WorkspaceVisualMetrics.CardRadius))
                    using (Brush fillBrush = new SolidBrush(fill))
                    using (Pen borderPen = new Pen(border, isDropTarget ? 2f : 1f))
                    {
                        graphics.FillPath(fillBrush, cardPath);
                        graphics.DrawPath(borderPen, cardPath);
                    }

                    int displayIndex = GetWorkspaceDisplayIndex(id) + 1;
                    string displayIndexText = displayIndex.ToString("00");
                    Point numberLocation = new Point(card.Left + 13, card.Top + 11);
                    Size numberSize = TextRenderer.MeasureText(displayIndexText, titleFont, new Size(120, 40), TextFormatFlags.NoPadding);
                    DrawText(graphics, displayIndexText, titleFont, numberLocation, isActive ? Color.FromArgb(WorkspaceVisualMetrics.AccentArgb) : Color.FromArgb(WorkspaceVisualMetrics.TextArgb));
                    DrawText(graphics, isActive ? "当前工作区" : "工作区 " + id, titleFont, new Point(numberLocation.X + numberSize.Width + 2, card.Top + 11), Color.FromArgb(WorkspaceVisualMetrics.TextArgb));
                    DrawWorkspaceItems(graphics, itemFont, muted, card, id);
                    if (id == hoveredWorkspaceId && id != 1)
                    {
                        DrawDeleteButton(graphics, id);
                    }

                    if (id == 1)
                    {
                        DrawAddBlock(graphics, addTitleFont, smallFont, muted);
                    }

                    if (isReorderingWorkspaces && workspaceCardDropIndex == GetWorkspaceDisplayIndex(id))
                    {
                        using (Pen insertion = new Pen(Color.FromArgb(WorkspaceVisualMetrics.AccentArgb), 3f))
                        {
                            graphics.DrawLine(insertion, card.Left + 5, card.Top - 4, card.Right - 5, card.Top - 4);
                        }
                    }
                }
                graphics.Restore(contentState);
            }
            DrawContentScrollBar(graphics);
            DrawRefreshButton(graphics);
            DrawHideButton(graphics);
        }

        protected override void OnPaintBackground(PaintEventArgs e)
        {
            if (nativeGlassBackdropApplied)
            {
                return;
            }

            base.OnPaintBackground(e);
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            isClosing = true;
            dragTimer.Stop();
            applicationClickTimer.Stop();
            glassRefreshTimer.Stop();
            CancelPendingWorkspaceItemClick();
            CancelPendingDrag();
            EndWorkspaceCardReorder();
            SaveState();
            RestoreAllManagedWindows();
            base.OnFormClosing(e);
        }

        private static void ConfigureRendering(Graphics graphics)
        {
            WorkspaceVisuals.ConfigureRendering(graphics);
        }

        private int CardTop { get { return WorkspaceVisualMetrics.CardTop; } }
        private int CardGap { get { return WorkspaceVisualMetrics.CardGap; } }
        private int CardHeight
        {
            get
            {
                return WorkspaceVisualMetrics.CardHeight;
            }
        }

        private static int GetItemTopOffset(Font titleFont)
        {
            return 11 + titleFont.Height + 8;
        }

        private int GetItemTopOffset()
        {
            using (Font titleFont = CreateTextFont(WorkspaceVisualMetrics.TitleFontSize, FontStyle.Bold))
            {
                return GetItemTopOffset(titleFont);
            }
        }

        private Font CreateTextFont(float logicalFontSize, FontStyle style)
        {
            return new Font(
                WorkspaceVisualMetrics.FontFamilyName,
                DpiLayoutPolicy.ScaleFontSize(logicalFontSize, currentDpi),
                style,
                GraphicsUnit.Pixel);
        }

        private static int GetItemRowHeight(Font itemFont)
        {
            return GetAppButtonHeight(itemFont) + WorkspaceVisualMetrics.AppButtonVerticalGap;
        }

        private static int GetAppButtonHeight(Font itemFont)
        {
            return Math.Max(24, itemFont.Height + WorkspaceVisualMetrics.AppButtonVerticalPadding * 2);
        }

        private static string GetWorkspaceItemLabel(WorkspaceItem item)
        {
            if (item == null || item.IsAvailable)
            {
                return item == null ? String.Empty : item.DisplayName;
            }

            return item.DisplayName + "（未运行）";
        }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams parameters = base.CreateParams;
                parameters.ExStyle |= 0x08000000;
                parameters.ExStyle |= 0x00000008;
                return parameters;
            }
        }

        private int GetWorkspaceCardWidth(int workspaceId)
        {
            int fullWidth = GetLogicalClientSize().Width - WorkspaceVisualMetrics.SideMargin * 2;
            return workspaceId == 1 ? fullWidth : (fullWidth - WorkspaceVisualMetrics.GridGap) / 2;
        }

        private int GetWorkspaceCardHeight(int workspaceId)
        {
            int automaticHeight = GetAutomaticWorkspaceCardHeight(workspaceId);
            int resizedHeight;
            if (workspaceHeights.TryGetValue(workspaceId, out resizedHeight))
            {
                return Math.Max(WorkspaceResizePolicy.ClampHeight(resizedHeight), automaticHeight);
            }

            return automaticHeight;
        }

        private int GetAutomaticWorkspaceCardHeight(int workspaceId)
        {
            System.Collections.Generic.IList<WorkspaceItem> items = catalog.GetWorkspaceItems(workspaceId);
            if (items.Count == 0)
            {
                return WorkspaceVisualMetrics.CardHeight;
            }

            int availableWidth = GetWorkspaceCardWidth(workspaceId) - 58;
            int lineWidth = 0;
            int rows = 1;
            int itemTopOffset;
            int itemButtonHeight;
            using (Font titleFont = CreateTextFont(WorkspaceVisualMetrics.TitleFontSize, FontStyle.Bold))
            using (Font font = CreateTextFont(WorkspaceVisualMetrics.ItemFontSize, FontStyle.Regular))
            {
                itemTopOffset = GetItemTopOffset(titleFont);
                itemButtonHeight = GetAppButtonHeight(font);
                foreach (WorkspaceItem item in items)
                {
                    string label = TrimToWidth(null, font, GetWorkspaceItemLabel(item), availableWidth);
                    int itemWidth = TextRenderer.MeasureText("• " + label, font, new Size(1000, 30), TextFormatFlags.NoPadding).Width
                        + WorkspaceVisualMetrics.AppButtonHorizontalPadding * 2;
                    if (lineWidth > 0 && lineWidth + itemWidth > availableWidth)
                    {
                        rows++;
                        lineWidth = itemWidth;
                    }
                    else
                    {
                        lineWidth += itemWidth + WorkspaceVisualMetrics.AppButtonHorizontalGap;
                    }
                }
            }

            return Math.Max(
                WorkspaceVisualMetrics.CardHeight,
                itemTopOffset + rows * itemButtonHeight + (rows - 1) * WorkspaceVisualMetrics.AppButtonVerticalGap + 12);
        }

        private int GetAutomaticPanelHeight()
        {
            return Math.Max(WorkspaceVisualMetrics.PanelMinimumHeight, GetContentContentBottom());
        }

        private void FitPanelHeightToContent()
        {
            if (!IsHandleCreated || IsDisposed)
            {
                return;
            }

            Rectangle area = Screen.FromHandle(Handle).WorkingArea;
            int logicalWidth = GetLogicalClientSize().Width;
            int logicalHeight = GetAutomaticPanelHeight();
            Size size = WorkspacePanelLayout.ClampPanelSize(
                ScaleLogicalSize(new Size(logicalWidth, logicalHeight)),
                GetDeviceMinimumSize(),
                GetPanelMaximumSize(area));
            int left = Math.Max(area.Left, Math.Min(Left, area.Right - size.Width));
            int top = Math.Max(area.Top, Math.Min(Top, area.Bottom - size.Height));
            Bounds = new Rectangle(left, top, size.Width, size.Height);
            savedPanelBounds = Bounds;
            savedPanelLogicalSize = new Size(logicalWidth, logicalHeight);
            hasSavedPanelBounds = true;
            hasSavedPanelLogicalSize = true;
            UpdatePanelRegion();
        }

        private void SetWorkspaceHeight(int workspaceId, int height)
        {
            if (workspaceId == 0)
            {
                return;
            }

            workspaceHeights[workspaceId] = WorkspaceResizePolicy.ClampHeight(height);
        }

        private void TogglePanel()
        {
            if (Visible)
            {
                if (panelIsPassive)
                {
                    panelIsPassive = false;
                    EnsureAlwaysOnTop();
                    Invalidate();
                    return;
                }

                Hide();
                return;
            }

            PlaceAtCenter();
            Show();
            EnsureAlwaysOnTop();
        }

        private void EnsureAlwaysOnTop()
        {
            if (!IsHandleCreated || IsDisposed)
            {
                return;
            }

            panelIsPassive = false;
            TopMost = true;
            NativeMethods.SetWindowPos(
                Handle,
                NativeMethods.HWND_TOPMOST,
                0,
                0,
                0,
                0,
                NativeMethods.SWP_NOMOVE | NativeMethods.SWP_NOSIZE | NativeMethods.SWP_NOACTIVATE);
        }

        private void PlaceAtCenter()
        {
            Rectangle area = Screen.FromHandle(Handle).WorkingArea;
            int logicalWidth = hasSavedPanelLogicalSize
                ? savedPanelLogicalSize.Width
                : WorkspaceVisualMetrics.PanelWidth;
            if (logicalWidth < WorkspaceVisualMetrics.PanelMinimumWidth
                || logicalWidth > WorkspaceVisualMetrics.PanelMaximumWidth)
            {
                logicalWidth = WorkspaceVisualMetrics.PanelWidth;
            }

            Size automaticSize = WorkspacePanelLayout.ClampPanelSize(
                ScaleLogicalSize(new Size(logicalWidth, GetAutomaticPanelHeight())),
                GetDeviceMinimumSize(),
                GetPanelMaximumSize(area));
            int left = hasSavedPanelBounds
                ? Math.Max(area.Left, Math.Min(savedPanelBounds.Left, area.Right - automaticSize.Width))
                : area.Right - automaticSize.Width;
            int top = hasSavedPanelBounds
                ? Math.Max(area.Top, Math.Min(savedPanelBounds.Top, area.Bottom - automaticSize.Height))
                : area.Top;
            Bounds = new Rectangle(left, top, automaticSize.Width, automaticSize.Height);
            savedPanelBounds = Bounds;
            savedPanelLogicalSize = new Size(logicalWidth, GetAutomaticPanelHeight());
            hasSavedPanelBounds = true;
            hasSavedPanelLogicalSize = true;
        }

        private void KeepPanelSizeOnDpiChange(int requestedDpi, Rectangle suggestedBounds)
        {
            int nextDpi = requestedDpi > 0 ? requestedDpi : GetWindowDpi();
            if (!hasSavedPanelLogicalSize)
            {
                savedPanelLogicalSize = UnscaleDeviceSize(Size, currentDpi);
                hasSavedPanelLogicalSize = true;
            }
            currentDpi = nextDpi;
            Rectangle preferredBounds = suggestedBounds.Width > 0 && suggestedBounds.Height > 0
                ? suggestedBounds
                : Bounds;
            Rectangle area = Screen.FromRectangle(preferredBounds).WorkingArea;
            Size size = WorkspacePanelLayout.ClampPanelSize(
                ScaleLogicalSize(new Size(savedPanelLogicalSize.Width, GetAutomaticPanelHeight())),
                GetDeviceMinimumSize(),
                GetPanelMaximumSize(area));
            Bounds = WorkspacePanelLayout.KeepWithinWorkingArea(
                new Rectangle(preferredBounds.Location, size),
                size,
                area);
            savedPanelBounds = Bounds;
            savedPanelLogicalSize = new Size(UnscaleDeviceSize(size, nextDpi).Width, GetAutomaticPanelHeight());
            hasSavedPanelBounds = true;
            UpdatePanelRegion();
            Invalidate(true);
        }

        private static Rectangle GetSuggestedDpiBounds(IntPtr boundsPointer)
        {
            if (boundsPointer == IntPtr.Zero)
            {
                return Rectangle.Empty;
            }

            NativeMethods.Rect suggested = (NativeMethods.Rect)Marshal.PtrToStructure(
                boundsPointer,
                typeof(NativeMethods.Rect));
            return Rectangle.FromLTRB(suggested.Left, suggested.Top, suggested.Right, suggested.Bottom);
        }

        private Size GetPanelMaximumSize(Rectangle area)
        {
            return new Size(
                Math.Min(ScaleLogicalValue(WorkspaceVisualMetrics.PanelMaximumWidth), area.Width),
                area.Height);
        }

        private int GetWindowDpi()
        {
            try
            {
                if (IsHandleCreated)
                {
                    uint dpi = NativeMethods.GetDpiForWindow(Handle);
                    if (dpi > 0)
                    {
                        return (int)dpi;
                    }
                }
            }
            catch (EntryPointNotFoundException)
            {
            }
            return DpiLayoutPolicy.BaseDpi;
        }

        private static int GetDpiFromMessage(IntPtr wParam)
        {
            int dpi = unchecked((int)(long)wParam) & 0xFFFF;
            return dpi > 0 ? dpi : DpiLayoutPolicy.BaseDpi;
        }

        private static int ScaleLogicalValue(int value, int dpi)
        {
            return DpiLayoutPolicy.ScaleValue(value, dpi);
        }

        private int ScaleLogicalValue(int value)
        {
            return ScaleLogicalValue(value, currentDpi);
        }

        private Size ScaleLogicalSize(Size logicalSize)
        {
            return new Size(
                ScaleLogicalValue(logicalSize.Width),
                ScaleLogicalValue(logicalSize.Height));
        }

        private static Size UnscaleDeviceSize(Size deviceSize, int dpi)
        {
            return new Size(
                DpiLayoutPolicy.UnscaleValue(deviceSize.Width, dpi),
                DpiLayoutPolicy.UnscaleValue(deviceSize.Height, dpi));
        }

        private Size GetDeviceMinimumSize()
        {
            return ScaleLogicalSize(new Size(
                WorkspaceVisualMetrics.PanelMinimumWidth,
                WorkspaceVisualMetrics.PanelMinimumHeight));
        }

        private Size GetLogicalClientSize()
        {
            return UnscaleDeviceSize(ClientSize, currentDpi);
        }

        private Point ToLogicalPoint(Point devicePoint)
        {
            return new Point(
                DpiLayoutPolicy.UnscaleValue(devicePoint.X, currentDpi),
                DpiLayoutPolicy.UnscaleValue(devicePoint.Y, currentDpi));
        }

        private bool CanDragPanelAt(Point location)
        {
            if (GetWorkspaceAt(location.X, location.Y) != 0
                || IsAddBlockAt(location.Y)
                || IsHideButtonAt(location.X, location.Y)
                || IsRefreshButtonAt(location.X, location.Y)
                || GetDisplayTabAt(location.X, location.Y) != null)
            {
                return false;
            }

            return WorkspacePanelLayout.GetResizeEdgeAt(location, GetLogicalClientSize(), WorkspaceVisualMetrics.PanelResizeGrip) == PanelResizeEdge.None;
        }

        private Rectangle GetContentViewportBounds()
        {
            Size logicalClientSize = GetLogicalClientSize();
            return new Rectangle(
                0,
                WorkspaceVisualMetrics.CardTop,
                logicalClientSize.Width,
                Math.Max(1, logicalClientSize.Height - WorkspaceVisualMetrics.CardTop - WorkspaceVisualMetrics.SideMargin));
        }

        private int GetContentContentBottom()
        {
            int bottom = GetAddBlockBounds().Bottom;
            foreach (int workspaceId in workspaceLayout.GetWorkspaceIds())
            {
                bottom = Math.Max(bottom, GetWorkspaceCardBounds(workspaceId).Bottom);
            }

            return bottom + WorkspaceVisualMetrics.SideMargin;
        }

        private int GetContentScrollMaximum()
        {
            return Math.Max(0, GetContentContentBottom() - GetContentViewportBounds().Bottom);
        }

        private void SetContentScrollOffset(int value)
        {
            contentScrollOffset = Math.Max(0, Math.Min(value, GetContentScrollMaximum()));
        }

        private Rectangle GetContentScrollTrackBounds()
        {
            if (GetContentScrollMaximum() <= 0)
            {
                return Rectangle.Empty;
            }

            Rectangle viewport = GetContentViewportBounds();
            return new Rectangle(
                Math.Max(0, viewport.Right - 8),
                viewport.Top + 4,
                4,
                Math.Max(1, viewport.Height - 8));
        }

        private Rectangle GetContentScrollThumbBounds()
        {
            Rectangle track = GetContentScrollTrackBounds();
            if (track.IsEmpty)
            {
                return Rectangle.Empty;
            }

            Rectangle viewport = GetContentViewportBounds();
            int contentHeight = Math.Max(viewport.Height, GetContentContentBottom() - viewport.Top);
            int thumbHeight = Math.Max(28, (int)Math.Round(track.Height * (double)viewport.Height / contentHeight));
            thumbHeight = Math.Min(track.Height, thumbHeight);
            int travel = Math.Max(0, track.Height - thumbHeight);
            int thumbTop = track.Top + (GetContentScrollMaximum() == 0
                ? 0
                : (int)Math.Round(travel * (double)contentScrollOffset / GetContentScrollMaximum()));
            return new Rectangle(track.Left, thumbTop, track.Width, thumbHeight);
        }

        private void DrawContentScrollBar(Graphics graphics)
        {
            Rectangle track = GetContentScrollTrackBounds();
            Rectangle thumb = GetContentScrollThumbBounds();
            if (track.IsEmpty || thumb.IsEmpty)
            {
                return;
            }

            using (Brush trackBrush = new SolidBrush(Color.FromArgb(48, 255, 255, 255)))
            using (Brush thumbBrush = new SolidBrush(Color.FromArgb(150, 235, 240, 250)))
            {
                graphics.FillRectangle(trackBrush, track);
                graphics.FillRectangle(thumbBrush, thumb);
            }
        }

        private Rectangle GetHideButtonBounds()
        {
            Size logicalClientSize = GetLogicalClientSize();
            return new Rectangle(
                logicalClientSize.Width - HideButtonWidth - WorkspaceVisualMetrics.SideMargin,
                WorkspaceVisualMetrics.HideButtonTopMargin,
                HideButtonWidth,
                HideButtonHeight);
        }

        private bool IsHideButtonAt(int clientX, int clientY)
        {
            return GetHideButtonBounds().Contains(clientX, clientY);
        }

        private void DrawHideButton(Graphics graphics)
        {
            Rectangle button = GetHideButtonBounds();
            using (System.Drawing.Drawing2D.GraphicsPath path = WorkspaceVisuals.CreateRoundedPath(button, WorkspaceVisualMetrics.HideButtonRadius))
            using (Brush fill = new SolidBrush(Color.FromArgb(WorkspaceVisualMetrics.CardBackgroundArgb)))
            using (Pen border = new Pen(Color.FromArgb(WorkspaceVisualMetrics.CardBorderArgb), 1f))
            using (Font font = CreateTextFont(WorkspaceVisualMetrics.HideButtonFontSize, FontStyle.Regular))
            {
                graphics.FillPath(fill, path);
                graphics.DrawPath(border, path);
                DrawCenteredText(graphics, "隐藏", font, button, Color.FromArgb(WorkspaceVisualMetrics.MutedTextArgb));
            }
        }

        private System.Collections.Generic.IList<DisplayTabLayout> GetDisplayTabs()
        {
            System.Collections.Generic.List<DisplayTabLayout> tabs = new System.Collections.Generic.List<DisplayTabLayout>();
            Screen[] screens = Screen.AllScreens;
            int count = screens.Length + 1;
            int availableWidth = GetLogicalClientSize().Width - WorkspaceVisualMetrics.SideMargin * 2 - WorkspaceVisualMetrics.DisplayTabGap * (count - 1);
            int tabWidth = Math.Max(68, availableWidth / count);
            int left = WorkspaceVisualMetrics.SideMargin;
            tabs.Add(new DisplayTabLayout
            {
                DeviceName = String.Empty,
                Label = "全部",
                Bounds = new Rectangle(left, WorkspaceVisualMetrics.DisplayTabTop, tabWidth, WorkspaceVisualMetrics.DisplayTabHeight)
            });
            left += tabWidth + WorkspaceVisualMetrics.DisplayTabGap;
            for (int index = 0; index < screens.Length; index++)
            {
                tabs.Add(new DisplayTabLayout
                {
                    DeviceName = screens[index].DeviceName,
                    Label = "显示器 " + (index + 1),
                    Bounds = new Rectangle(left, WorkspaceVisualMetrics.DisplayTabTop, tabWidth, WorkspaceVisualMetrics.DisplayTabHeight)
                });
                left += tabWidth + WorkspaceVisualMetrics.DisplayTabGap;
            }

            return tabs;
        }

        private DisplayTabLayout GetDisplayTabAt(int clientX, int clientY)
        {
            foreach (DisplayTabLayout tab in GetDisplayTabs())
            {
                if (tab.Bounds.Contains(clientX, clientY))
                {
                    return tab;
                }
            }

            return null;
        }

        private void DrawDisplayTabs(Graphics graphics, Font font)
        {
            foreach (DisplayTabLayout tab in GetDisplayTabs())
            {
                bool isSelected = String.Equals(selectedDisplayDeviceName, tab.DeviceName, StringComparison.OrdinalIgnoreCase);
                Color fill = isSelected
                    ? Color.FromArgb(WorkspaceVisualMetrics.ActiveCardBackgroundArgb)
                    : Color.FromArgb(WorkspaceVisualMetrics.CardBackgroundArgb);
                Color border = isSelected
                    ? Color.FromArgb(WorkspaceVisualMetrics.ActiveCardBorderArgb)
                    : Color.FromArgb(WorkspaceVisualMetrics.CardBorderArgb);
                using (System.Drawing.Drawing2D.GraphicsPath path = WorkspaceVisuals.CreateRoundedPath(tab.Bounds, WorkspaceVisualMetrics.DisplayTabRadius))
                using (Brush fillBrush = new SolidBrush(fill))
                using (Pen borderPen = new Pen(border, isSelected ? 1.5f : 1f))
                {
                    graphics.FillPath(fillBrush, path);
                    graphics.DrawPath(borderPen, path);
                }

                DrawCenteredText(
                    graphics,
                    tab.Label,
                    font,
                    tab.Bounds,
                    isSelected ? Color.FromArgb(WorkspaceVisualMetrics.AccentArgb) : Color.FromArgb(WorkspaceVisualMetrics.TextArgb));
            }
        }

        private Rectangle GetDeleteButtonBounds(int workspaceId)
        {
            if (workspaceId <= 1 || !workspaceLayout.GetWorkspaceIds().Contains(workspaceId))
            {
                return Rectangle.Empty;
            }

            Rectangle card = GetWorkspaceCardBounds(workspaceId);
            return new Rectangle(
                card.Right - WorkspaceVisualMetrics.DeleteButtonWidth - 12,
                card.Top + WorkspaceVisualMetrics.DeleteButtonTopOffset,
                WorkspaceVisualMetrics.DeleteButtonWidth,
                WorkspaceVisualMetrics.DeleteButtonHeight);
        }

        private int GetDeleteButtonWorkspaceAt(int clientX, int clientY)
        {
            if (!GetContentViewportBounds().Contains(clientX, clientY))
            {
                return 0;
            }

            int contentY = clientY + contentScrollOffset;
            foreach (int workspaceId in workspaceLayout.GetWorkspaceIds())
            {
                if (workspaceId > 1 && GetDeleteButtonBounds(workspaceId).Contains(clientX, contentY))
                {
                    return workspaceId;
                }
            }

            return 0;
        }

        private void DrawDeleteButton(Graphics graphics, int workspaceId)
        {
            Rectangle button = GetDeleteButtonBounds(workspaceId);
            using (System.Drawing.Drawing2D.GraphicsPath path = WorkspaceVisuals.CreateRoundedPath(button, WorkspaceVisualMetrics.DeleteButtonRadius))
            using (Brush fill = new SolidBrush(Color.White))
            using (Pen border = new Pen(Color.FromArgb(WorkspaceVisualMetrics.DeleteButtonBorderArgb), 1f))
            using (Font font = CreateTextFont(WorkspaceVisualMetrics.DeleteButtonFontSize, FontStyle.Bold))
            {
                graphics.FillPath(fill, path);
                graphics.DrawPath(border, path);
                string label = "删除";
                DrawCenteredText(graphics, label, font, button, Color.FromArgb(WorkspaceVisualMetrics.DeleteButtonArgb));
            }
        }

        private static Cursor GetPanelResizeCursor(PanelResizeEdge edge)
        {
            if (edge == PanelResizeEdge.Left || edge == PanelResizeEdge.Right)
            {
                return Cursors.SizeWE;
            }
            if (edge == PanelResizeEdge.Top || edge == PanelResizeEdge.Bottom)
            {
                return Cursors.SizeNS;
            }
            if (edge == PanelResizeEdge.TopLeft || edge == PanelResizeEdge.BottomRight)
            {
                return Cursors.SizeNWSE;
            }
            if (edge == PanelResizeEdge.TopRight || edge == PanelResizeEdge.BottomLeft)
            {
                return Cursors.SizeNESW;
            }

            return Cursors.Default;
        }

        private void ResizePanel(Point cursor)
        {
            int deltaX = cursor.X - panelResizeStartScreen.X;
            int deltaY = cursor.Y - panelResizeStartScreen.Y;
            Rectangle bounds = panelResizeStartBounds;
            if (panelResizeEdge == PanelResizeEdge.Left || panelResizeEdge == PanelResizeEdge.TopLeft || panelResizeEdge == PanelResizeEdge.BottomLeft)
            {
                bounds.X += deltaX;
                bounds.Width -= deltaX;
            }
            if (panelResizeEdge == PanelResizeEdge.Right || panelResizeEdge == PanelResizeEdge.TopRight || panelResizeEdge == PanelResizeEdge.BottomRight)
            {
                bounds.Width += deltaX;
            }
            if (panelResizeEdge == PanelResizeEdge.Top || panelResizeEdge == PanelResizeEdge.TopLeft || panelResizeEdge == PanelResizeEdge.TopRight)
            {
                bounds.Y += deltaY;
                bounds.Height -= deltaY;
            }
            if (panelResizeEdge == PanelResizeEdge.Bottom || panelResizeEdge == PanelResizeEdge.BottomLeft || panelResizeEdge == PanelResizeEdge.BottomRight)
            {
                bounds.Height += deltaY;
            }

            Rectangle area = Screen.FromPoint(cursor).WorkingArea;
            Size size = WorkspacePanelLayout.ClampPanelSize(
                bounds.Size,
                GetDeviceMinimumSize(),
                GetPanelMaximumSize(area));
            if (bounds.Right == panelResizeStartBounds.Right)
            {
                bounds.X = bounds.Right - size.Width;
            }
            if (bounds.Bottom == panelResizeStartBounds.Bottom)
            {
                bounds.Y = bounds.Bottom - size.Height;
            }
            bounds.Size = size;
            bounds.X = Math.Max(area.Left, Math.Min(bounds.X, area.Right - bounds.Width));
            bounds.Y = Math.Max(area.Top, Math.Min(bounds.Y, area.Bottom - bounds.Height));
            Bounds = bounds;
            savedPanelBounds = Bounds;
            UpdateSavedLogicalSizeFromBounds(Bounds.Size);
            hasSavedPanelBounds = true;
        }

        private void UpdateSavedLogicalSizeFromBounds(Size deviceSize)
        {
            savedPanelLogicalSize = UnscaleDeviceSize(deviceSize, currentDpi);
            hasSavedPanelLogicalSize = true;
        }

        private void DrawWorkspaceItems(Graphics graphics, Font font, Brush muted, Rectangle card, int workspaceId)
        {
            System.Collections.Generic.IList<WorkspaceItem> values = catalog.GetWorkspaceItems(workspaceId);
            System.Collections.Generic.IList<WorkspaceItemLayout> layouts = GetWorkspaceItemLayouts(card, workspaceId, font);
            foreach (WorkspaceItemLayout layout in layouts)
            {
                bool isSelected = layout.Item.WindowHandle == selectedApplicationWindowHandle
                    && workspaceId == activeWorkspace;
                string itemDisplayDeviceName = GetWindowDisplayDeviceName(layout.Item);
                bool isOnSelectedDisplay = DisplayFilterPolicy.ShouldHighlight(selectedDisplayDeviceName, itemDisplayDeviceName);
                Color buttonFill = isSelected
                    ? Color.FromArgb(WorkspaceVisualMetrics.AppButtonActiveBackgroundArgb)
                    : isOnSelectedDisplay
                        ? Color.FromArgb(WorkspaceVisualMetrics.AppButtonBackgroundArgb)
                        : Color.FromArgb(245, 248, 252);
                Color buttonBorder = isSelected
                    ? Color.FromArgb(WorkspaceVisualMetrics.AppButtonActiveBorderArgb)
                    : isOnSelectedDisplay
                        ? Color.FromArgb(WorkspaceVisualMetrics.AppButtonBorderArgb)
                        : Color.FromArgb(WorkspaceVisualMetrics.CardBorderArgb);
                using (System.Drawing.Drawing2D.GraphicsPath buttonPath = WorkspaceVisuals.CreateRoundedPath(layout.Bounds, WorkspaceVisualMetrics.AppButtonRadius))
                using (Brush fill = new SolidBrush(buttonFill))
                using (Pen border = new Pen(buttonBorder, isSelected ? 1.5f : 1f))
                {
                    graphics.FillPath(fill, buttonPath);
                    graphics.DrawPath(border, buttonPath);
                }

                string bullet = "• ";
                Size bulletSize = TextRenderer.MeasureText(bullet, font, new Size(100, 30), TextFormatFlags.NoPadding);
                Point textLocation = new Point(
                    layout.Bounds.Left + WorkspaceVisualMetrics.AppButtonHorizontalPadding,
                    layout.Bounds.Top + (layout.Bounds.Height - font.Height) / 2);
                DrawText(graphics, bullet, font, textLocation, GetDisplayAccentColor(itemDisplayDeviceName));
                DrawText(graphics, layout.Label, font, new Point(textLocation.X + bulletSize.Width, textLocation.Y), isSelected
                    ? Color.FromArgb(WorkspaceVisualMetrics.AccentArgb)
                    : isOnSelectedDisplay
                        ? Color.FromArgb(WorkspaceVisualMetrics.TextArgb)
                        : Color.FromArgb(WorkspaceVisualMetrics.MutedTextArgb));
            }

            if (values.Count == 0)
            {
                DrawText(graphics, "将窗口拖到此处", font, new Point(card.Left + 49, card.Top + GetItemTopOffset()), Color.FromArgb(WorkspaceVisualMetrics.MutedTextArgb));
            }
        }

        private string GetWindowDisplayDeviceName(WorkspaceItem item)
        {
            if (item == null)
            {
                return String.Empty;
            }

            return GetWindowDisplayDeviceName(new IntPtr(item.WindowHandle));
        }

        private static string GetWindowDisplayDeviceName(IntPtr window)
        {
            return WorkspaceDisplayService.GetDeviceName(window);
        }

        private static Color GetDisplayAccentColor(string displayDeviceName)
        {
            Color[] colors = new Color[]
            {
                Color.FromArgb(62, 107, 230),
                Color.FromArgb(28, 163, 111),
                Color.FromArgb(150, 96, 219),
                Color.FromArgb(222, 132, 47)
            };
            Screen[] screens = Screen.AllScreens;
            for (int index = 0; index < screens.Length; index++)
            {
                if (String.Equals(screens[index].DeviceName, displayDeviceName, StringComparison.OrdinalIgnoreCase))
                {
                    return colors[index % colors.Length];
                }
            }

            return Color.FromArgb(WorkspaceVisualMetrics.MutedTextArgb);
        }

        private void DisposeDisplayContextMenu()
        {
            if (displayContextMenu == null)
            {
                return;
            }

            ContextMenuStrip menu = displayContextMenu;
            displayContextMenu = null;
            menu.Dispose();
        }

        private void ShowDisplayContextMenu(WorkspaceItem item, Point screenLocation)
        {
            if (item == null)
            {
                return;
            }

            DisposeDisplayContextMenu();
            GlassContextMenuStrip menu = new GlassContextMenuStrip();

            ToolStripMenuItem focusAction = new ToolStripMenuItem("↗  打开 / 置前");
            focusAction.AutoSize = false;
            focusAction.Height = 44;
            focusAction.Width = 236;
            focusAction.Padding = new Padding(14, 0, 14, 0);
            focusAction.Click += delegate { FocusWorkspaceItem(item); };
            menu.Items.Add(focusAction);

            ToolStripMenuItem workspaceAction = new ToolStripMenuItem("⇢  移动到工作区");
            workspaceAction.AutoSize = false;
            workspaceAction.Height = 44;
            workspaceAction.Width = 236;
            workspaceAction.Padding = new Padding(14, 0, 14, 0);
            foreach (int workspaceId in workspaceLayout.GetWorkspaceIds())
            {
                int targetWorkspaceId = workspaceId;
                ToolStripMenuItem target = new ToolStripMenuItem("工作区 " + targetWorkspaceId);
                target.Click += delegate { MoveWorkspaceItemToWorkspace(item, targetWorkspaceId); };
                workspaceAction.DropDownItems.Add(target);
            }
            menu.Items.Add(workspaceAction);

            ToolStripMenuItem displayAction = new ToolStripMenuItem("▣  移动到显示器");
            displayAction.AutoSize = false;
            displayAction.Height = 44;
            displayAction.Width = 236;
            displayAction.Padding = new Padding(14, 0, 14, 0);
            displayAction.Enabled = Screen.AllScreens.Length > 1;
            string currentDisplayDeviceName = GetWindowDisplayDeviceName(item);
            foreach (Screen screen in Screen.AllScreens)
            {
                if (String.Equals(screen.DeviceName, currentDisplayDeviceName, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                Screen targetScreen = screen;
                ToolStripMenuItem target = new ToolStripMenuItem(GetDisplayLabel(targetScreen.DeviceName));
                target.Click += delegate { MoveWorkspaceItemToDisplay(item, targetScreen.DeviceName); };
                displayAction.DropDownItems.Add(target);
            }
            menu.Items.Add(displayAction);

            ToolStripMenuItem closeAction = new ToolStripMenuItem("×  关闭应用");
            closeAction.AutoSize = false;
            closeAction.Height = 44;
            closeAction.Width = 236;
            closeAction.Padding = new Padding(14, 0, 14, 0);
            closeAction.ForeColor = Color.FromArgb(WorkspaceVisualMetrics.DeleteButtonArgb);
            closeAction.Click += delegate { CloseWorkspaceItem(item); };
            menu.Items.Add(closeAction);

            ToolStripMenuItem removeAction = new ToolStripMenuItem("−  从工作区移除记录");
            removeAction.AutoSize = false;
            removeAction.Height = 44;
            removeAction.Width = 236;
            removeAction.Padding = new Padding(14, 0, 14, 0);
            removeAction.Click += delegate { RemoveWorkspaceItem(item); };
            menu.Items.Add(removeAction);

            displayContextMenu = menu;
            menu.Size = new Size(260, menu.Padding.Vertical + (menu.Items.Count * 44));
            Screen menuScreen = Screen.FromPoint(screenLocation);
            Rectangle targetBounds = GetWorkspaceItemScreenBounds(item);
            Point menuLocation = GetMenuLocation(screenLocation, menu.Size, menuScreen.WorkingArea, targetBounds);
            menu.Show(menuLocation);
        }

        private void MoveWorkspaceItemToWorkspace(WorkspaceItem item, int targetWorkspaceId)
        {
            if (item == null || targetWorkspaceId <= 0 || targetWorkspaceId == item.WorkspaceId)
            {
                return;
            }

            IntPtr window;
            if (!TryResolveWorkspaceWindow(item, out window))
            {
                catalog.SetWindowAvailable(item.WindowHandle, false);
                SaveState();
                Invalidate();
                return;
            }

            catalog.MoveWindow(item.WindowHandle, targetWorkspaceId);
            if (targetWorkspaceId == activeWorkspace)
            {
                ShowWorkspaceItem(item, window, false);
            }
            else
            {
                NativeMethods.ShowWindow(window, NativeMethods.SW_HIDE);
            }

            SaveState();
            Invalidate();
        }

        private void CloseWorkspaceItem(WorkspaceItem item)
        {
            if (item == null)
            {
                return;
            }

            IntPtr window;
            if (!TryResolveWorkspaceWindow(item, out window))
            {
                catalog.SetWindowAvailable(item.WindowHandle, false);
                SaveState();
                Invalidate();
                return;
            }

            if (NativeMethods.PostMessage(window, NativeMethods.WM_CLOSE, IntPtr.Zero, IntPtr.Zero))
            {
                SaveState();
                Invalidate();
                try
                {
                    BeginInvoke((Action)delegate { RefreshWorkspaceState(); });
                }
                catch (InvalidOperationException)
                {
                }
            }
        }

        private void RemoveWorkspaceItem(WorkspaceItem item)
        {
            if (item == null)
            {
                return;
            }

            IntPtr window;
            if (TryResolveWorkspaceWindow(item, out window))
            {
                item = FindWorkspaceItem(item.WorkspaceId, window.ToInt64()) ?? item;
            }

            catalog.RemoveWindow(item.WindowHandle);
            if (selectedApplicationWindowHandle == item.WindowHandle)
            {
                selectedApplicationWindowHandle = 0;
            }

            SaveState();
            Invalidate();
        }

        private Rectangle GetWorkspaceItemScreenBounds(WorkspaceItem item)
        {
            if (item == null)
            {
                return Rectangle.Empty;
            }

            using (Font font = CreateTextFont(WorkspaceVisualMetrics.ItemFontSize, FontStyle.Regular))
            {
                foreach (int workspaceId in workspaceLayout.GetWorkspaceIds())
                {
                    Rectangle card = GetWorkspaceCardBounds(workspaceId);
                    foreach (WorkspaceItemLayout layout in GetWorkspaceItemLayouts(card, workspaceId, font))
                    {
                        if (layout.Item.WindowHandle == item.WindowHandle)
                        {
                            Rectangle visibleBounds = layout.Bounds;
                            visibleBounds.Offset(0, -contentScrollOffset);
                            return RectangleToScreen(visibleBounds);
                        }
                    }
                }
            }

            return Rectangle.Empty;
        }

        private static Point GetMenuLocation(
            Point screenLocation,
            Size menuSize,
            Rectangle workingArea,
            Rectangle targetBounds)
        {
            return targetBounds.Width > 0
                ? DisplayMenuPlacementPolicy.GetLocation(screenLocation, menuSize, targetBounds, workingArea, 10)
                : DisplayMenuPlacementPolicy.GetLocation(screenLocation, menuSize, workingArea, 10);
        }

        private static string GetDisplayLabel(string deviceName)
        {
            return WorkspaceDisplayService.GetLabel(deviceName);
        }

        private void MoveWorkspaceItemToDisplay(WorkspaceItem item, string targetDisplayDeviceName)
        {
            if (item == null || String.IsNullOrEmpty(targetDisplayDeviceName))
            {
                return;
            }

            IntPtr window;
            if (!TryResolveWorkspaceWindow(item, out window))
            {
                catalog.SetWindowAvailable(item.WindowHandle, false);
                SaveState();
                Invalidate();
                return;
            }

            Screen targetScreen = null;
            foreach (Screen screen in Screen.AllScreens)
            {
                if (String.Equals(screen.DeviceName, targetDisplayDeviceName, StringComparison.OrdinalIgnoreCase))
                {
                    targetScreen = screen;
                    break;
                }
            }

            if (targetScreen == null)
            {
                return;
            }

            if (NativeMethods.IsIconic(window))
            {
                MoveMinimizedWindowToDisplay(window, targetScreen);
                Invalidate();
                return;
            }

            NativeMethods.Rect rawBounds;
            if (!NativeMethods.GetWindowRect(window, out rawBounds))
            {
                return;
            }

            Screen sourceScreen = Screen.FromHandle(window);
            bool isMaximized = NativeMethods.IsZoomed(window);
            Rectangle sourceBounds = Rectangle.FromLTRB(rawBounds.Left, rawBounds.Top, rawBounds.Right, rawBounds.Bottom);
            Rectangle targetBounds = isMaximized
                ? targetScreen.Bounds
                : MapWindowBoundsToDisplay(sourceBounds, sourceScreen.WorkingArea, targetScreen.WorkingArea);
            bool moved = NativeMethods.SetWindowPos(
                window,
                IntPtr.Zero,
                targetBounds.Left,
                targetBounds.Top,
                targetBounds.Width,
                targetBounds.Height,
                NativeMethods.SWP_NOZORDER | NativeMethods.SWP_NOACTIVATE | NativeMethods.SWP_FRAMECHANGED);
            if (moved)
            {
                NativeMethods.RedrawWindow(
                    window,
                    IntPtr.Zero,
                    IntPtr.Zero,
                    NativeMethods.RDW_INVALIDATE
                        | NativeMethods.RDW_ERASE
                        | NativeMethods.RDW_ALLCHILDREN
                        | NativeMethods.RDW_FRAME);
            }
            Invalidate();
        }

        private static bool MoveMinimizedWindowToDisplay(IntPtr window, Screen targetScreen)
        {
            NativeMethods.WindowPlacement placement = new NativeMethods.WindowPlacement();
            placement.Length = Marshal.SizeOf(typeof(NativeMethods.WindowPlacement));
            if (!NativeMethods.GetWindowPlacement(window, ref placement))
            {
                return false;
            }

            Point workspaceScreenOffset = GetWorkspaceScreenOffset();
            Rectangle normalWorkspaceBounds = Rectangle.FromLTRB(
                placement.NormalPosition.Left,
                placement.NormalPosition.Top,
                placement.NormalPosition.Right,
                placement.NormalPosition.Bottom);
            Rectangle normalScreenBounds = normalWorkspaceBounds;
            normalScreenBounds.Offset(workspaceScreenOffset);
            Screen sourceScreen = Screen.FromRectangle(normalScreenBounds);
            Rectangle targetScreenBounds = MapWindowBoundsToDisplay(
                normalScreenBounds,
                sourceScreen.WorkingArea,
                targetScreen.WorkingArea);
            targetScreenBounds.Offset(-workspaceScreenOffset.X, -workspaceScreenOffset.Y);
            placement.NormalPosition = new NativeMethods.Rect
            {
                Left = targetScreenBounds.Left,
                Top = targetScreenBounds.Top,
                Right = targetScreenBounds.Right,
                Bottom = targetScreenBounds.Bottom
            };
            return NativeMethods.SetWindowPlacement(window, ref placement);
        }

        private static Point GetWorkspaceScreenOffset()
        {
            Screen primary = Screen.PrimaryScreen;
            if (primary == null)
            {
                return Point.Empty;
            }

            return new Point(
                primary.WorkingArea.Left - primary.Bounds.Left,
                primary.WorkingArea.Top - primary.Bounds.Top);
        }

        private static Rectangle MapWindowBoundsToDisplay(Rectangle sourceBounds, Rectangle sourceArea, Rectangle targetArea)
        {
            int width = Math.Min(Math.Max(1, sourceBounds.Width), targetArea.Width);
            int height = Math.Min(Math.Max(1, sourceBounds.Height), targetArea.Height);
            int sourceWidth = Math.Max(1, sourceArea.Width - sourceBounds.Width);
            int sourceHeight = Math.Max(1, sourceArea.Height - sourceBounds.Height);
            double relativeX = (double)(sourceBounds.Left - sourceArea.Left) / sourceWidth;
            double relativeY = (double)(sourceBounds.Top - sourceArea.Top) / sourceHeight;
            int left = targetArea.Left + (int)Math.Round(relativeX * Math.Max(0, targetArea.Width - width));
            int top = targetArea.Top + (int)Math.Round(relativeY * Math.Max(0, targetArea.Height - height));
            left = Math.Max(targetArea.Left, Math.Min(left, targetArea.Right - width));
            top = Math.Max(targetArea.Top, Math.Min(top, targetArea.Bottom - height));
            return new Rectangle(left, top, width, height);
        }

        private System.Collections.Generic.IList<WorkspaceItemLayout> GetWorkspaceItemLayouts(Rectangle card, int workspaceId, Font font)
        {
            System.Collections.Generic.List<WorkspaceItemLayout> layouts = new System.Collections.Generic.List<WorkspaceItemLayout>();
            System.Collections.Generic.IList<WorkspaceItem> values = catalog.GetWorkspaceItems(workspaceId);
            int lineX = card.Left + 13;
            int lineY = card.Top + GetItemTopOffset();
            int lineHeight = GetItemRowHeight(font);
            int maximumTextWidth = Math.Max(80, card.Width - 58);
            foreach (WorkspaceItem item in values)
            {
                string label = TrimToWidth(null, font, GetWorkspaceItemLabel(item), maximumTextWidth);
                string itemText = "• " + label;
                Size measured = TextRenderer.MeasureText(itemText, font, new Size(1000, 30), TextFormatFlags.NoPadding);
                int buttonWidth = measured.Width + WorkspaceVisualMetrics.AppButtonHorizontalPadding * 2;
                int buttonHeight = GetAppButtonHeight(font);
                if (lineX + buttonWidth > card.Right - 13 && lineX > card.Left + 13)
                {
                    lineX = card.Left + 13;
                    lineY += lineHeight;
                }

                layouts.Add(new WorkspaceItemLayout
                {
                    Item = item,
                    Label = label,
                    Bounds = new Rectangle(lineX, lineY, buttonWidth, buttonHeight)
                });
                lineX += buttonWidth + WorkspaceVisualMetrics.AppButtonHorizontalGap;
            }

            return layouts;
        }

        private void DrawAddBlock(Graphics graphics, Font titleFont, Font smallFont, Brush muted)
        {
            Rectangle addBlock = GetAddBlockBounds();
            using (System.Drawing.Drawing2D.GraphicsPath addPath = WorkspaceVisuals.CreateRoundedPath(addBlock, WorkspaceVisualMetrics.AddBlockRadius))
            using (Brush addFill = new SolidBrush(Color.FromArgb(WorkspaceVisualMetrics.CardBackgroundArgb)))
            using (Pen border = new Pen(highlightedAddBlock ? Color.FromArgb(WorkspaceVisualMetrics.ActiveCardBorderArgb) : Color.FromArgb(WorkspaceVisualMetrics.AddBorderArgb), highlightedAddBlock ? 2f : 1f))
            {
                border.DashStyle = System.Drawing.Drawing2D.DashStyle.Dash;
                graphics.FillPath(addFill, addPath);
                graphics.DrawPath(border, addPath);
            }

            {
                string plus = "＋";
                Size plusSize = TextRenderer.MeasureText(plus, titleFont, new Size(500, 50), TextFormatFlags.NoPadding);
                DrawText(graphics, plus, titleFont, new Point(addBlock.Left + (addBlock.Width - plusSize.Width) / 2, addBlock.Top + 5), Color.FromArgb(WorkspaceVisualMetrics.MutedTextArgb));
                string label = "新增工作区";
                Size labelSize = TextRenderer.MeasureText(label, titleFont, new Size(500, 50), TextFormatFlags.NoPadding);
                DrawText(graphics, label, titleFont, new Point(addBlock.Left + (addBlock.Width - labelSize.Width) / 2, addBlock.Top + 29), Color.FromArgb(WorkspaceVisualMetrics.TextArgb));
                string hint = "点击创建，或把窗口拖到这里";
                Size hintSize = TextRenderer.MeasureText(hint, smallFont, new Size(600, 40), TextFormatFlags.NoPadding);
                DrawText(graphics, hint, smallFont, new Point(addBlock.Left + (addBlock.Width - hintSize.Width) / 2, addBlock.Top + 57), Color.FromArgb(WorkspaceVisualMetrics.MutedTextArgb));
            }
        }

        private static void DrawText(Graphics graphics, string text, Font font, Point location, Color color)
        {
            using (SolidBrush brush = new SolidBrush(color))
            using (StringFormat format = (StringFormat)StringFormat.GenericTypographic.Clone())
            {
                format.FormatFlags |= StringFormatFlags.NoClip | StringFormatFlags.NoWrap;
                graphics.DrawString(text, font, brush, new PointF(location.X, location.Y), format);
            }
        }

        private static void DrawCenteredText(Graphics graphics, string text, Font font, Rectangle bounds, Color color)
        {
            using (SolidBrush brush = new SolidBrush(color))
            using (StringFormat format = (StringFormat)StringFormat.GenericTypographic.Clone())
            {
                format.Alignment = StringAlignment.Center;
                format.LineAlignment = StringAlignment.Center;
                format.FormatFlags |= StringFormatFlags.NoClip | StringFormatFlags.NoWrap;
                graphics.DrawString(text, font, brush, bounds, format);
            }
        }

        private Rectangle GetWorkspaceCardBounds(int workspaceId)
        {
            System.Collections.Generic.IList<int> ids = workspaceLayout.GetWorkspaceIds();
            int index = GetWorkspaceDisplayIndex(workspaceId);
            if (index < 0 || index >= ids.Count)
            {
                return Rectangle.Empty;
            }

            int width = GetWorkspaceCardWidth(workspaceId);
            if (index == 0)
            {
                return new Rectangle(WorkspaceVisualMetrics.SideMargin, CardTop, width, GetWorkspaceCardHeight(workspaceId));
            }

            int row = (index - 1) / 2;
            int column = (index - 1) % 2;
            int top = GetGridStartTop();
            for (int rowIndex = 0; rowIndex < row; rowIndex++)
            {
                int firstIndex = 1 + rowIndex * 2;
                int rowHeight = GetWorkspaceCardHeight(ids[firstIndex]);
                if (firstIndex + 1 < ids.Count)
                {
                    rowHeight = Math.Max(rowHeight, GetWorkspaceCardHeight(ids[firstIndex + 1]));
                }
                top += rowHeight + WorkspaceVisualMetrics.GridGap;
            }

            int left = WorkspaceVisualMetrics.SideMargin + column * (width + WorkspaceVisualMetrics.GridGap);
            return new Rectangle(left, top, width, GetWorkspaceCardHeight(workspaceId));
        }

        private Rectangle GetAddBlockBounds()
        {
            Rectangle firstCard = GetWorkspaceCardBounds(1);
            return new Rectangle(WorkspaceVisualMetrics.SideMargin, firstCard.Bottom + CardGap, GetLogicalClientSize().Width - WorkspaceVisualMetrics.SideMargin * 2, AddBlockHeight);
        }

        private int GetGridStartTop()
        {
            return GetWorkspaceCardBounds(1).Bottom + CardGap + AddBlockHeight + CardGap;
        }

        private bool IsAddBlockAt(int clientY)
        {
            Rectangle viewport = GetContentViewportBounds();
            return viewport.Top <= clientY
                && clientY < viewport.Bottom
                && GetAddBlockBounds().Contains(20, clientY + contentScrollOffset);
        }

        private int GetWorkspaceDisplayIndex(int workspaceId)
        {
            System.Collections.Generic.IList<int> ids = workspaceLayout.GetWorkspaceIds();
            for (int index = 0; index < ids.Count; index++)
            {
                if (ids[index] == workspaceId)
                {
                    return index;
                }
            }

            return 0;
        }

        private int GetResizeHandleAt(int clientX, int clientY)
        {
            if (!GetContentViewportBounds().Contains(clientX, clientY))
            {
                return 0;
            }

            int contentY = clientY + contentScrollOffset;
            foreach (int workspaceId in workspaceLayout.GetWorkspaceIds())
            {
                Rectangle card = GetWorkspaceCardBounds(workspaceId);
                if (clientX >= card.Left && clientX <= card.Right && contentY >= card.Bottom - 8 && contentY <= card.Bottom + 4)
                {
                    return workspaceId;
                }
            }

            return 0;
        }

        private int GetWorkspaceInsertIndex(int clientY)
        {
            int contentY = clientY + contentScrollOffset;
            System.Collections.Generic.IList<int> ids = workspaceLayout.GetWorkspaceIds();
            for (int index = 1; index < ids.Count; index++)
            {
                Rectangle card = GetWorkspaceCardBounds(ids[index]);
                if (contentY < card.Top + card.Height / 2)
                {
                    return index;
                }
            }

            return Math.Max(1, ids.Count - 1);
        }

        private void CreateWorkspaceFromAddBlock()
        {
            int workspaceId = workspaceLayout.CreateWorkspace();
            if (workspaceId != 0)
            {
                FitPanelHeightToContent();
                SaveState();
                ShowWorkspace(workspaceId);
            }
        }

        private void ConfirmWorkspaceDeletion(int workspaceId)
        {
            if (workspaceId <= 1 || !workspaceLayout.GetWorkspaceIds().Contains(workspaceId))
            {
                return;
            }

            int applicationCount = catalog.GetWorkspaceItems(workspaceId).Count;
            string message = "删除“工作区 " + workspaceId + "”？\r\n\r\n"
                + "其中的 " + applicationCount + " 个应用不会关闭，将移动到默认工作区。";
            if (MessageBox.Show(
                this,
                message,
                "确认删除工作区",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Warning,
                MessageBoxDefaultButton.Button2) == DialogResult.Yes)
            {
                DeleteWorkspace(workspaceId);
            }
        }

        private void DeleteWorkspace(int workspaceId)
        {
            if (!workspaceLayout.RemoveWorkspace(workspaceId))
            {
                return;
            }

            catalog.MoveWorkspaceItems(workspaceId, 1);
            workspaceHeights.Remove(workspaceId);
            hoveredWorkspaceId = 0;
            if (activeWorkspace == workspaceId)
            {
                ShowWorkspace(1);
                return;
            }

            selectedApplicationWindowHandle = 0;
            FitPanelHeightToContent();
            SaveState();
            Invalidate();
        }

        private void MoveWorkspaceToIndex(int workspaceId, int index)
        {
            if (index >= 1)
            {
                workspaceLayout.MoveWorkspaceToIndex(workspaceId, index);
                SaveState();
            }
        }

        private void EndWorkspaceCardReorder()
        {
            if (workspaceGhost != null)
            {
                workspaceGhost.Close();
                workspaceGhost.Dispose();
                workspaceGhost = null;
            }

            isReorderingWorkspaces = false;
            workspaceCardPressed = 0;
            workspaceCardDropIndex = -1;
            Capture = false;
        }

        private void ToggleWindowMaximize(WorkspaceItem item)
        {
            if (item == null)
            {
                return;
            }

            try
            {
                foregroundSyncSuppression++;
                IntPtr window;
                if (!TryResolveWorkspaceWindow(item, out window))
                {
                    if (!TryLaunchWorkspaceApplication(item, out window))
                    {
                        return;
                    }
                }

                item = FindWorkspaceItem(item.WorkspaceId, window.ToInt64()) ?? item;
                catalog.SetWindowUserMinimized(item.WindowHandle, false);
                ShowWorkspace(item.WorkspaceId, window.ToInt64());
                bool shouldMaximize = !NativeMethods.IsZoomed(window);
                catalog.SetWindowMaximized(item.WindowHandle, shouldMaximize);
                ShowWindowUsingSavedState(window, shouldMaximize);
                NativeMethods.SetForegroundWindow(window);
                SaveState();
                Invalidate();
            }
            finally
            {
                foregroundSyncSuppression = Math.Max(0, foregroundSyncSuppression - 1);
                KeepPanelVisibleForApplicationFocus();
            }
        }

        private void RefreshWorkspaceState()
        {
            RefreshWorkspaceAvailability();
            FitPanelHeightToContent();
            SaveState();
            Invalidate();
        }

        private void RefreshWorkspaceAvailability()
        {
            foreach (int workspaceId in workspaceLayout.GetWorkspaceIds())
            {
                foreach (WorkspaceItem item in catalog.GetWorkspaceItems(workspaceId))
                {
                    IntPtr window;
                    bool available = TryResolveWorkspaceWindow(item, out window);
                    catalog.SetWindowAvailable(item.WindowHandle, available);
                }
            }
        }

        private void CaptureInitialMinimizedWindowStates()
        {
            bool changed = false;
            foreach (WorkspaceItem item in catalog.GetAllItems())
            {
                IntPtr window;
                if (!TryResolveWorkspaceWindow(item, out window))
                {
                    continue;
                }

                bool isMinimized = NativeMethods.IsIconic(window);
                if (item.IsUserMinimized != isMinimized)
                {
                    catalog.SetWindowUserMinimized(item.WindowHandle, isMinimized);
                    changed = true;
                }
            }

            if (changed)
            {
                SaveState();
            }
        }

        private Rectangle GetRefreshButtonBounds()
        {
            int logicalWidth = GetLogicalClientSize().Width;
            return new Rectangle(
                logicalWidth - WorkspaceVisualMetrics.SideMargin - WorkspaceVisualMetrics.HideButtonWidth - 6 - WorkspaceVisualMetrics.RefreshButtonWidth,
                WorkspaceVisualMetrics.HideButtonTopMargin,
                WorkspaceVisualMetrics.RefreshButtonWidth,
                WorkspaceVisualMetrics.RefreshButtonHeight);
        }

        private bool IsRefreshButtonAt(int clientX, int clientY)
        {
            return GetRefreshButtonBounds().Contains(clientX, clientY);
        }

        private void DrawRefreshButton(Graphics graphics)
        {
            Rectangle button = GetRefreshButtonBounds();
            using (System.Drawing.Drawing2D.GraphicsPath path = WorkspaceVisuals.CreateRoundedPath(button, WorkspaceVisualMetrics.RefreshButtonRadius))
            using (Brush fill = new SolidBrush(Color.FromArgb(WorkspaceVisualMetrics.CardBackgroundArgb)))
            using (Pen border = new Pen(Color.FromArgb(WorkspaceVisualMetrics.CardBorderArgb), 1f))
            using (Font font = CreateTextFont(WorkspaceVisualMetrics.ControlFontSize, FontStyle.Regular))
            {
                graphics.FillPath(fill, path);
                graphics.DrawPath(border, path);
                string label = "刷新工作区";
                DrawCenteredText(graphics, label, font, button, Color.FromArgb(WorkspaceVisualMetrics.AccentArgb));
            }
        }

        private static string TrimToWidth(Graphics graphics, Font font, string text, int maximumWidth)
        {
            if (TextRenderer.MeasureText(text, font, new Size(2000, 40), TextFormatFlags.NoPadding).Width <= maximumWidth)
            {
                return text;
            }

            const string suffix = "…";
            string result = text;
            while (result.Length > 1 && TextRenderer.MeasureText(result + suffix, font, new Size(2000, 40), TextFormatFlags.NoPadding).Width > maximumWidth)
            {
                result = result.Substring(0, result.Length - 1);
            }

            return result + suffix;
        }

        private void PollDrag()
        {
            NativeMethods.Point cursor;
            NativeMethods.GetCursorPos(out cursor);
            bool leftButtonDown = (NativeMethods.GetAsyncKeyState(NativeMethods.VK_LBUTTON) & 0x8000) != 0;
            if (leftButtonDown && !dragging)
            {
                IntPtr foreground = NativeMethods.GetForegroundWindow();
                if (IsCandidateWindow(foreground) && IsTitleBarDrag(foreground, cursor))
                {
                    if (dragCandidate != foreground)
                    {
                        dragCandidate = foreground;
                        dragCandidateStart = cursor;
                    }
                    else if (DragPreviewPolicy.HasMovedEnough(dragCandidateStart.X, dragCandidateStart.Y, cursor.X, cursor.Y))
                    {
                        BeginDragPreview(foreground, cursor);
                    }
                }
                else
                {
                    ClearDragCandidate();
                }
            }

            if (!leftButtonDown && !dragging)
            {
                ClearDragCandidate();
            }

            if (dragging && dragPreview != null)
            {
                dragPreview.MoveToPointer(cursor);
            }

            Point logicalCursor = ToLogicalPoint(new Point(cursor.X - Left, cursor.Y - Top));
            int newHighlight = dragging && Bounds.Contains(cursor.X, cursor.Y)
                ? GetWorkspaceAt(logicalCursor.X, logicalCursor.Y)
                : 0;
            bool newAddHighlight = dragging && Bounds.Contains(cursor.X, cursor.Y) && IsAddBlockAt(logicalCursor.Y);
            if (highlightedWorkspace != newHighlight || highlightedAddBlock != newAddHighlight)
            {
                highlightedWorkspace = newHighlight;
                highlightedAddBlock = newAddHighlight;
                Invalidate();
            }

            if (!leftButtonDown && dragging)
            {
                int targetWorkspace = highlightedWorkspace;
                if (highlightedAddBlock)
                {
                    targetWorkspace = workspaceLayout.CreateWorkspace();
                }

                if (targetWorkspace != 0 && IsCandidateWindow(dragSource))
                {
                    AddWindowToWorkspace(dragSource, targetWorkspace, dragSourceWasMaximized);
                    if (WorkspaceVisibilityPolicy.ShouldHide(targetWorkspace, activeWorkspace))
                    {
                        NativeMethods.ShowWindow(dragSource, NativeMethods.SW_HIDE);
                    }
                    else
                    {
                        ShowWindowUsingSavedState(dragSource, dragSourceWasMaximized);
                    }
                }
                else
                {
                    ShowWindowUsingSavedState(dragSource, dragSourceWasMaximized);
                }

                EndDragPreview();
            }
        }

        private int GetWorkspaceAt(int clientY)
        {
            return GetWorkspaceAt(GetLogicalClientSize().Width / 2, clientY);
        }

        private int GetWorkspaceAt(int clientX, int clientY)
        {
            if (!GetContentViewportBounds().Contains(clientX, clientY))
            {
                return 0;
            }

            int contentY = clientY + contentScrollOffset;
            foreach (int workspaceId in workspaceLayout.GetWorkspaceIds())
            {
                if (GetWorkspaceCardBounds(workspaceId).Contains(clientX, contentY))
                {
                    return workspaceId;
                }
            }

            return 0;
        }

        private WorkspaceItem GetWorkspaceItemAt(int clientY)
        {
            return GetWorkspaceItemAt(GetLogicalClientSize().Width / 2, clientY);
        }

        private WorkspaceItem GetWorkspaceItemAt(int clientX, int clientY)
        {
            int workspaceId = GetWorkspaceAt(clientX, clientY);
            if (workspaceId == 0)
            {
                return null;
            }

            Rectangle card = GetWorkspaceCardBounds(workspaceId);
            int contentY = clientY + contentScrollOffset;
            using (Font font = CreateTextFont(WorkspaceVisualMetrics.ItemFontSize, FontStyle.Regular))
            {
                foreach (WorkspaceItemLayout layout in GetWorkspaceItemLayouts(card, workspaceId, font))
                {
                    if (layout.Bounds.Contains(clientX, contentY))
                    {
                        return layout.Item;
                    }
                }
            }

            return null;
        }

        private bool TryResolveWorkspaceWindow(WorkspaceItem item, out IntPtr window)
        {
            window = item == null ? IntPtr.Zero : new IntPtr(item.WindowHandle);
            if (item == null)
            {
                return false;
            }

            if (IsWorkspaceItemWindow(item, window, false))
            {
                uint liveProcessId;
                NativeMethods.GetWindowThreadProcessId(window, out liveProcessId);
                string executablePath = GetProcessExecutablePath(liveProcessId);
                catalog.SetExecutablePath(window.ToInt64(), executablePath);
                CaptureLaunchProfileIfMissing(item, window, liveProcessId, executablePath);
                catalog.SetWindowAvailable(window.ToInt64(), true);
                return true;
            }

            IntPtr titleMatch = IntPtr.Zero;
            IntPtr onlyProcessMatch = IntPtr.Zero;
            System.Collections.Generic.List<IntPtr> processMatches = new System.Collections.Generic.List<IntPtr>();
            int processMatchCount = 0;
            int titleMatchCount = 0;
            NativeMethods.EnumWindows(delegate(IntPtr candidate, IntPtr data)
            {
                if (!IsWorkspaceItemWindow(item, candidate, true)
                    || IsWindowAssignedToAnotherItem(item, candidate))
                {
                    return true;
                }

                processMatchCount++;
                onlyProcessMatch = candidate;
                processMatches.Add(candidate);
                if (String.Equals(GetWindowTitle(candidate), item.Title, StringComparison.Ordinal))
                {
                    titleMatchCount++;
                    titleMatch = candidate;
                }

                return true;
            }, IntPtr.Zero);

            IntPtr resolved = WorkspaceWindowRecoveryPolicy.ShouldUseUniqueCandidate(titleMatchCount)
                ? titleMatch
                : IntPtr.Zero;
            if (resolved == IntPtr.Zero
                && WorkspaceWindowRecoveryPolicy.ShouldScanLaunchProfile(titleMatchCount)
                && !String.IsNullOrEmpty(item.LaunchArguments))
            {
                IntPtr launchProfileMatch = IntPtr.Zero;
                int launchProfileMatchCount = 0;
                foreach (IntPtr candidate in processMatches)
                {
                    if (HasSameLaunchArguments(item.LaunchArguments, candidate))
                    {
                        launchProfileMatchCount++;
                        launchProfileMatch = candidate;
                    }
                }

                if (WorkspaceWindowRecoveryPolicy.ShouldUseUniqueCandidate(launchProfileMatchCount))
                {
                    resolved = launchProfileMatch;
                }
            }

            if (resolved == IntPtr.Zero
                && titleMatchCount == 0
                && ForegroundWindowRecoveryPolicy.ShouldUseOnlyProcessMatch(
                    processMatchCount,
                    GetSavedProcessItemCount(item.ProcessName),
                    GetProcessWindowCount(item.ProcessName)))
            {
                resolved = onlyProcessMatch;
            }
            if (resolved == IntPtr.Zero)
            {
                catalog.SetWindowAvailable(item.WindowHandle, false);
                return false;
            }

            if (catalog.RebindWindow(item.WindowHandle, resolved.ToInt64()))
            {
                item = FindWorkspaceItem(item.WorkspaceId, resolved.ToInt64());
            }

            uint resolvedProcessId;
            NativeMethods.GetWindowThreadProcessId(resolved, out resolvedProcessId);
            string resolvedExecutablePath = GetProcessExecutablePath(resolvedProcessId);
            catalog.SetExecutablePath(resolved.ToInt64(), resolvedExecutablePath);
            CaptureLaunchProfileIfMissing(item, resolved, resolvedProcessId, resolvedExecutablePath);
            catalog.SetWindowAvailable(resolved.ToInt64(), true);

            window = resolved;
            return true;
        }

        private bool IsWindowAssignedToAnotherItem(WorkspaceItem item, IntPtr window)
        {
            foreach (WorkspaceItem savedItem in catalog.GetAllItems())
            {
                if (!Object.ReferenceEquals(savedItem, item)
                    && savedItem.WindowHandle == window.ToInt64())
                {
                    return true;
                }
            }

            return false;
        }

        private bool HasSameLaunchArguments(string savedArguments, IntPtr window)
        {
            uint processId;
            NativeMethods.GetWindowThreadProcessId(window, out processId);
            string executablePath = GetProcessExecutablePath(processId);
            string commandLine = GetCommandLine(processId);
            string liveArguments = WorkspaceLaunchProfileParser.ExtractArguments(commandLine, executablePath);
            return !String.IsNullOrWhiteSpace(liveArguments)
                && String.Equals(savedArguments.Trim(), liveArguments.Trim(), StringComparison.OrdinalIgnoreCase);
        }

        private void CaptureLaunchProfileIfMissing(WorkspaceItem item, IntPtr window, uint processId, string executablePath)
        {
            if (item == null || (!String.IsNullOrEmpty(item.LaunchArguments) && !String.IsNullOrEmpty(item.WorkingDirectory)))
            {
                return;
            }

            QueueLaunchProfileCapture(item, window, processId, executablePath);
        }

        private void QueueLaunchProfileCapture(WorkspaceItem item, IntPtr window, uint processId, string executablePath)
        {
            long windowHandle = window.ToInt64();
            if (!launchProfileCapturePending.Add(windowHandle))
            {
                return;
            }

            int workspaceId = item.WorkspaceId;
            string initialArguments = item.LaunchArguments ?? String.Empty;
            string initialWorkingDirectory = item.WorkingDirectory ?? String.Empty;
            ThreadPool.QueueUserWorkItem(delegate
            {
                string commandLine = GetCommandLineFromWmi(processId);
                string arguments = String.IsNullOrEmpty(initialArguments)
                    ? WorkspaceLaunchProfileParser.ExtractArguments(commandLine, executablePath)
                    : initialArguments;
                string workingDirectory = String.IsNullOrEmpty(initialWorkingDirectory)
                    ? WorkspaceLaunchProfileParser.GetWorkingDirectory(executablePath)
                    : initialWorkingDirectory;

                try
                {
                    BeginInvoke((Action)delegate
                    {
                        launchProfileCapturePending.Remove(windowHandle);
                        WorkspaceItem current = FindWorkspaceItem(workspaceId, windowHandle);
                        if (current == null)
                        {
                            return;
                        }

                        catalog.SetLaunchProfile(
                            current.WindowHandle,
                            String.IsNullOrEmpty(current.LaunchArguments) ? arguments : current.LaunchArguments,
                            String.IsNullOrEmpty(current.WorkingDirectory) ? workingDirectory : current.WorkingDirectory);
                        SaveState();
                        Invalidate();
                    });
                }
                catch (ObjectDisposedException)
                {
                }
                catch (InvalidOperationException)
                {
                }
            });
        }

        private int GetSavedProcessItemCount(string processName)
        {
            int count = 0;
            foreach (WorkspaceItem savedItem in catalog.GetAllItems())
            {
                if (String.Equals(savedItem.ProcessName, processName, StringComparison.OrdinalIgnoreCase))
                {
                    count++;
                }
            }

            return count;
        }

        private bool IsWorkspaceItemWindow(WorkspaceItem item, IntPtr window, bool requireVisible)
        {
            if (item == null || !IsCandidateWindow(window))
            {
                return false;
            }

            if (requireVisible && !NativeMethods.IsWindowVisible(window))
            {
                return false;
            }

            uint processId;
            NativeMethods.GetWindowThreadProcessId(window, out processId);
            return String.Equals(GetProcessName(processId), item.ProcessName, StringComparison.OrdinalIgnoreCase);
        }

        private bool TryLaunchWorkspaceApplication(WorkspaceItem item, out IntPtr window)
        {
            window = IntPtr.Zero;
            if (item == null)
            {
                return false;
            }

            string executable = item.ExecutablePath;
            if (String.IsNullOrEmpty(executable))
            {
                executable = item.ProcessName;
            }

            if (String.IsNullOrEmpty(executable))
            {
                return false;
            }

            // Keep the WorkspaceSwitcher launch entry aligned with the pinned
            // VS Code version when the side-by-side 1.141.2 build is present.
            // Existing non-VS Code applications and already-versioned paths
            // remain unchanged.
            if (String.Equals(Path.GetFileName(executable), "Code.exe", StringComparison.OrdinalIgnoreCase))
            {
                string executableDirectory = Path.GetDirectoryName(executable);
                if (!String.IsNullOrEmpty(executableDirectory))
                {
                    string preferredCode = Path.Combine(executableDirectory, "1.141.2", "Code.exe");
                    if (File.Exists(preferredCode))
                    {
                        executable = preferredCode;
                    }
                }
            }

            bool forceNewWindow = String.Equals(item.ProcessName, "Code.exe", StringComparison.OrdinalIgnoreCase);
            bool expectNewWindow = true;
            System.Collections.Generic.HashSet<long> existingProcessWindows = expectNewWindow
                ? GetVisibleProcessWindows(item.ProcessName)
                : null;

            try
            {
                ProcessStartInfo startInfo = new ProcessStartInfo
                {
                    FileName = executable,
                    UseShellExecute = true
                };
                startInfo.Arguments = item.LaunchArguments ?? String.Empty;
                if (forceNewWindow)
                {
                    if (String.IsNullOrWhiteSpace(startInfo.Arguments))
                    {
                        startInfo.Arguments = "--new-window";
                    }
                    else if (startInfo.Arguments.IndexOf("--new-window", StringComparison.OrdinalIgnoreCase) < 0)
                    {
                        startInfo.Arguments = "--new-window " + startInfo.Arguments;
                    }
                }
                if (!String.IsNullOrWhiteSpace(item.WorkingDirectory) && Directory.Exists(item.WorkingDirectory))
                {
                    startInfo.WorkingDirectory = item.WorkingDirectory;
                }

                using (Process process = Process.Start(startInfo))
                {
                    if (process != null)
                    {
                        try
                        {
                            process.WaitForInputIdle(1500);
                        }
                        catch (InvalidOperationException)
                        {
                        }
                    }
                }
            }
            catch (Exception)
            {
                return false;
            }

            if (expectNewWindow)
            {
                IntPtr launchedWindow = WaitForNewProcessWindow(item.ProcessName, existingProcessWindows);
                if (launchedWindow != IntPtr.Zero && catalog.RebindWindow(item.WindowHandle, launchedWindow.ToInt64()))
                {
                    item = FindWorkspaceItem(item.WorkspaceId, launchedWindow.ToInt64());
                    if (item != null)
                    {
                        uint launchedProcessId;
                        NativeMethods.GetWindowThreadProcessId(launchedWindow, out launchedProcessId);
                        catalog.SetExecutablePath(launchedWindow.ToInt64(), GetProcessExecutablePath(launchedProcessId));
                        catalog.SetWindowAvailable(launchedWindow.ToInt64(), true);
                        window = launchedWindow;
                        return true;
                    }
                }
            }

            return TryResolveWorkspaceWindow(item, out window);
        }

        private System.Collections.Generic.HashSet<long> GetVisibleProcessWindows(string processName)
        {
            System.Collections.Generic.HashSet<long> handles = new System.Collections.Generic.HashSet<long>();
            NativeMethods.EnumWindows(delegate(IntPtr candidate, IntPtr data)
            {
                if (!IsCandidateWindow(candidate) || !NativeMethods.IsWindowVisible(candidate))
                {
                    return true;
                }

                uint processId;
                NativeMethods.GetWindowThreadProcessId(candidate, out processId);
                if (String.Equals(GetProcessName(processId), processName, StringComparison.OrdinalIgnoreCase))
                {
                    handles.Add(candidate.ToInt64());
                }

                return true;
            }, IntPtr.Zero);
            return handles;
        }

        private int GetProcessWindowCount(string processName)
        {
            int count = 0;
            NativeMethods.EnumWindows(delegate(IntPtr candidate, IntPtr data)
            {
                if (!IsCandidateWindow(candidate))
                {
                    return true;
                }

                uint processId;
                NativeMethods.GetWindowThreadProcessId(candidate, out processId);
                if (String.Equals(GetProcessName(processId), processName, StringComparison.OrdinalIgnoreCase))
                {
                    count++;
                }

                return true;
            }, IntPtr.Zero);
            return count;
        }

        private IntPtr WaitForNewProcessWindow(string processName, System.Collections.Generic.HashSet<long> existingHandles)
        {
            for (int attempt = 0; attempt < 20; attempt++)
            {
                IntPtr newWindow = IntPtr.Zero;
                NativeMethods.EnumWindows(delegate(IntPtr candidate, IntPtr data)
                {
                    if (!IsCandidateWindow(candidate) || !NativeMethods.IsWindowVisible(candidate))
                    {
                        return true;
                    }

                    uint processId;
                    NativeMethods.GetWindowThreadProcessId(candidate, out processId);
                    if (String.Equals(GetProcessName(processId), processName, StringComparison.OrdinalIgnoreCase)
                        && !existingHandles.Contains(candidate.ToInt64()))
                    {
                        newWindow = candidate;
                        return false;
                    }

                    return true;
                }, IntPtr.Zero);

                if (newWindow != IntPtr.Zero)
                {
                    return newWindow;
                }

                Thread.Sleep(100);
            }

            return IntPtr.Zero;
        }

        private static string GetProcessName(uint processId)
        {
            // Process.GetProcessById(...).ProcessName under .NET Framework loads
            // a system process snapshot per lookup. Foreground recovery calls
            // this once per HWND, including hundreds of background windows;
            // that blocked the UI timer for seconds when a new window activated.
            // Query only the target process, without retaining a PID/name cache
            // (PIDs can be reused after an application exits).
            IntPtr process = NativeMethods.OpenProcess(0x1000, false, processId);
            if (process == IntPtr.Zero)
            {
                return String.Empty;
            }

            try
            {
                System.Text.StringBuilder path = new System.Text.StringBuilder(1024);
                uint size = (uint)path.Capacity;
                if (!NativeMethods.QueryFullProcessImageName(process, 0, path, ref size))
                {
                    if (Marshal.GetLastWin32Error() != 122)
                    {
                        return String.Empty;
                    }

                    path = new System.Text.StringBuilder(32768);
                    size = (uint)path.Capacity;
                    if (!NativeMethods.QueryFullProcessImageName(process, 0, path, ref size))
                    {
                        return String.Empty;
                    }
                }

                return Path.GetFileName(path.ToString());
            }
            finally
            {
                NativeMethods.CloseHandle(process);
            }
        }

        private bool IsCandidateWindow(IntPtr window)
        {
            if (window == IntPtr.Zero || window == Handle || !NativeMethods.IsWindow(window) || IsProtectedDesktopWindow(window))
            {
                return false;
            }

            return NativeMethods.GetWindowTextLength(window) > 0;
        }

        private static bool IsProtectedDesktopWindow(IntPtr window)
        {
            if (window == IntPtr.Zero)
            {
                return true;
            }

            System.Text.StringBuilder className = new System.Text.StringBuilder(128);
            if (NativeMethods.GetClassName(window, className, className.Capacity) <= 0)
            {
                return false;
            }

            string value = className.ToString();
            return String.Equals(value, "Progman", StringComparison.OrdinalIgnoreCase)
                || String.Equals(value, "WorkerW", StringComparison.OrdinalIgnoreCase)
                || String.Equals(value, "SHELLDLL_DefView", StringComparison.OrdinalIgnoreCase)
                || String.Equals(value, "Shell_TrayWnd", StringComparison.OrdinalIgnoreCase)
                || String.Equals(value, "Shell_SecondaryTrayWnd", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsTitleBarDrag(IntPtr window, NativeMethods.Point cursor)
        {
            NativeMethods.Rect windowRectangle;
            NativeMethods.Rect clientRectangle;
            if (!NativeMethods.GetWindowRect(window, out windowRectangle) || !NativeMethods.GetClientRect(window, out clientRectangle))
            {
                return false;
            }

            NativeMethods.Point clientOrigin = new NativeMethods.Point();
            if (!NativeMethods.ClientToScreen(window, ref clientOrigin))
            {
                return false;
            }

            return IsChromeWindow(window)
                ? DragPreviewPolicy.IsChromeTitleBarPoint(cursor.Y, windowRectangle.Top, clientOrigin.Y)
                : DragPreviewPolicy.IsTitleBarPoint(cursor.Y, windowRectangle.Top, clientOrigin.Y);
        }

        private static bool IsChromeWindow(IntPtr window)
        {
            System.Text.StringBuilder className = new System.Text.StringBuilder(128);
            return NativeMethods.GetClassName(window, className, className.Capacity) > 0
                && String.Equals(className.ToString(), "Chrome_WidgetWin_1", StringComparison.OrdinalIgnoreCase);
        }

        private void BeginDragPreview(IntPtr window, NativeMethods.Point cursor)
        {
            ClearDragCandidate();
            dragSource = window;
            dragging = true;
            dragSourceWasMaximized = NativeMethods.IsZoomed(window);
            // Do not call PrintWindow synchronously from the 16 ms UI timer. Some
            // Electron/UWP windows do not return promptly, which used to prevent
            // the preview from being created and made WorkspaceSwitcher appear
            // hung while the user was dragging. The title-only preview is a
            // reliable fallback and is created before any optional rendering.
            dragPreview = new DragPreviewForm(null, GetWindowTitle(window));
            dragPreview.MoveToPointer(cursor);
            dragPreview.Show(this);
        }

        private static Bitmap CaptureWindow(IntPtr window)
        {
            NativeMethods.Rect rectangle;
            if (!NativeMethods.GetWindowRect(window, out rectangle))
            {
                return null;
            }

            int width = rectangle.Right - rectangle.Left;
            int height = rectangle.Bottom - rectangle.Top;
            if (width < 1 || height < 1)
            {
                return null;
            }

            try
            {
                Bitmap image = new Bitmap(width, height);
                using (Graphics graphics = Graphics.FromImage(image))
                {
                    IntPtr deviceContext = graphics.GetHdc();
                    bool rendered;
                    try
                    {
                        rendered = NativeMethods.PrintWindow(window, deviceContext, NativeMethods.PW_RENDERFULLCONTENT);
                    }
                    finally
                    {
                        graphics.ReleaseHdc(deviceContext);
                    }

                    if (!rendered)
                    {
                        image.Dispose();
                        return null;
                    }
                }

                return image;
            }
            catch (ExternalException)
            {
                return null;
            }
        }

        private void OnForegroundWindowChanged(IntPtr hook, uint eventType, IntPtr window, int objectId, int childId, uint eventThread, uint eventTime)
        {
            if (foregroundSyncSuppression > 0
                || eventType != NativeMethods.EVENT_SYSTEM_FOREGROUND
                || window == IntPtr.Zero
                || IsDisposed
                || !IsHandleCreated)
            {
                return;
            }

            try
            {
                BeginInvoke((Action)delegate { HandleForegroundWindow(window); });
            }
            catch (InvalidOperationException)
            {
            }
        }

        private void OnTrackedWindowStateChanged(IntPtr hook, uint eventType, IntPtr window, int objectId, int childId, uint eventThread, uint eventTime)
        {
            if ((eventType != NativeMethods.EVENT_SYSTEM_MINIMIZESTART && eventType != NativeMethods.EVENT_SYSTEM_MINIMIZEEND)
                || window == IntPtr.Zero
                || objectId != NativeMethods.OBJID_WINDOW
                || childId != NativeMethods.CHILDID_SELF
                || IsDisposed
                || !IsHandleCreated)
            {
                return;
            }

            try
            {
                BeginInvoke((Action)delegate { HandleTrackedWindowStateChanged(window, eventType); });
            }
            catch (InvalidOperationException)
            {
            }
        }

        private void HandleTrackedWindowStateChanged(IntPtr window, uint eventType)
        {
            if (isClosing || !NativeMethods.IsWindow(window))
            {
                return;
            }

            bool isMinimizeStart = eventType == NativeMethods.EVENT_SYSTEM_MINIMIZESTART;
            long windowHandle = window.ToInt64();
            bool isWorkspaceSwitcherAction = ConsumePendingWorkspaceMinimizeEvent(windowHandle, isMinimizeStart);
            if (isMinimizeStart && isWorkspaceSwitcherAction)
            {
                workspaceMinimizedWindows.Add(windowHandle);
            }
            else if (!isMinimizeStart || !isWorkspaceSwitcherAction)
            {
                workspaceMinimizedWindows.Remove(windowHandle);
            }

            WorkspaceItem item = FindWorkspaceItemByHandle(windowHandle);
            if (item == null)
            {
                return;
            }

            bool nextState = WorkspaceWindowStatePolicy.ApplyMinimizeEvent(
                item.IsUserMinimized,
                isMinimizeStart,
                isWorkspaceSwitcherAction);
            if (nextState != item.IsUserMinimized)
            {
                catalog.SetWindowUserMinimized(windowHandle, nextState);
                SaveState();
            }
        }

        private bool ConsumePendingWorkspaceMinimizeEvent(long windowHandle, bool isMinimizeStart)
        {
            return pendingWorkspaceMinimizeEvents.Remove(windowHandle) && isMinimizeStart;
        }

        private bool HasPendingWorkspaceMinimizeEvent(long windowHandle)
        {
            return pendingWorkspaceMinimizeEvents.Contains(windowHandle);
        }

        private void HandleForegroundWindow(IntPtr window)
        {
            if (foregroundSyncSuppression > 0)
            {
                return;
            }

            IntPtr currentForegroundWindow = NativeMethods.GetForegroundWindow();
            if (!ForegroundActivationPolicy.ShouldProcessWindowEvent(
                window.ToInt64(),
                currentForegroundWindow.ToInt64()))
            {
                return;
            }

            WorkspaceItem foregroundItem;
            if (!TryResolveForegroundWorkspaceItem(window, out foregroundItem))
            {
                return;
            }

            int workspaceId = foregroundItem.WorkspaceId;
            if (!ForegroundActivationPolicy.ShouldSwitchToWorkspace(activeWorkspace, workspaceId, isHandlingForegroundActivation))
            {
                return;
            }

            isHandlingForegroundActivation = true;
            try
            {
                if (foregroundItem.IsUserMinimized)
                {
                    catalog.SetWindowUserMinimized(foregroundItem.WindowHandle, false);
                    SaveState();
                }
                ShowWorkspace(workspaceId);
                ShowWorkspaceItem(foregroundItem, window, true);
                NativeMethods.SetForegroundWindow(window);
            }
            finally
            {
                isHandlingForegroundActivation = false;
            }
        }

        private bool TryResolveForegroundWorkspaceItem(IntPtr window, out WorkspaceItem item)
        {
            item = null;
            if (!IsCandidateWindow(window) || !NativeMethods.IsWindowVisible(window))
            {
                return false;
            }

            int existingWorkspaceId = catalog.GetWindowWorkspaceId(window.ToInt64());
            if (existingWorkspaceId != 0)
            {
                item = FindWorkspaceItem(existingWorkspaceId, window.ToInt64());
                return item != null;
            }

            uint processId;
            NativeMethods.GetWindowThreadProcessId(window, out processId);
            string processName = GetProcessName(processId);
            string title = GetWindowTitle(window);
            WorkspaceItem exactMatch = null;
            WorkspaceItem onlyProcessMatch = null;
            int processMatchCount = 0;

            foreach (WorkspaceItem savedItem in catalog.GetAllItems())
            {
                if (!String.Equals(savedItem.ProcessName, processName, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                processMatchCount++;
                onlyProcessMatch = savedItem;
                if (String.Equals(savedItem.Title, title, StringComparison.Ordinal))
                {
                    exactMatch = savedItem;
                    break;
                }
            }

            WorkspaceItem resolvedItem = exactMatch != null
                ? exactMatch
                : ForegroundWindowRecoveryPolicy.ShouldUseOnlyProcessMatch(
                    processMatchCount,
                    GetSavedProcessItemCount(processName),
                    GetProcessWindowCount(processName))
                    ? onlyProcessMatch
                    : null;
            if (resolvedItem == null)
            {
                return false;
            }

            if (resolvedItem.WindowHandle != window.ToInt64()
                && !catalog.RebindWindow(resolvedItem.WindowHandle, window.ToInt64()))
            {
                return false;
            }

            item = FindWorkspaceItem(resolvedItem.WorkspaceId, window.ToInt64());
            if (item == null)
            {
                return false;
            }

            catalog.SetExecutablePath(window.ToInt64(), GetProcessExecutablePath(processId));
            catalog.SetWindowAvailable(window.ToInt64(), true);
            SaveState();
            return true;
        }

        private WorkspaceItem FindWorkspaceItem(int workspaceId, long windowHandle)
        {
            foreach (WorkspaceItem item in catalog.GetWorkspaceItems(workspaceId))
            {
                if (item.WindowHandle == windowHandle)
                {
                    return item;
                }
            }

            return null;
        }

        private WorkspaceItem FindWorkspaceItemByHandle(long windowHandle)
        {
            foreach (WorkspaceItem item in catalog.GetAllItems())
            {
                if (item.WindowHandle == windowHandle)
                {
                    return item;
                }
            }

            return null;
        }

        private void CancelPendingDrag()
        {
            if (dragging && NativeMethods.IsWindow(dragSource))
            {
                ShowWindowUsingSavedState(dragSource, dragSourceWasMaximized);
            }

            EndDragPreview();
        }

        private void EndDragPreview()
        {
            if (dragPreview != null)
            {
                dragPreview.Close();
                dragPreview.Dispose();
                dragPreview = null;
            }

            dragSource = IntPtr.Zero;
            ClearDragCandidate();
            dragging = false;
            dragSourceWasMaximized = false;
            highlightedWorkspace = 0;
            highlightedAddBlock = false;
            Invalidate();
        }

        private void ClearDragCandidate()
        {
            dragCandidate = IntPtr.Zero;
            dragCandidateStart = new NativeMethods.Point();
        }

        private void AddWindowToWorkspace(IntPtr window, int workspaceId, bool wasMaximized)
        {
            int existingWorkspaceId = catalog.GetWindowWorkspaceId(window.ToInt64());
            if (existingWorkspaceId != 0)
            {
                catalog.MoveWindow(window.ToInt64(), workspaceId);
                catalog.SetWindowMaximized(window.ToInt64(), wasMaximized);
                catalog.SetWindowAvailable(window.ToInt64(), true);
                SaveState();
                return;
            }

            uint processId;
            NativeMethods.GetWindowThreadProcessId(window, out processId);
            string processName = "";
            try
            {
                processName = Process.GetProcessById((int)processId).ProcessName + ".exe";
            }
            catch (ArgumentException)
            {
                return;
            }

            string executablePath = GetProcessExecutablePath(processId);
            catalog.AssignWindow(workspaceId, window.ToInt64(), GetWindowTitle(window), processName, String.Empty);
            catalog.SetExecutablePath(window.ToInt64(), executablePath);
            catalog.SetLaunchProfile(
                window.ToInt64(),
                String.Empty,
                WorkspaceLaunchProfileParser.GetWorkingDirectory(executablePath));
            catalog.SetWindowMaximized(window.ToInt64(), wasMaximized);
            SaveState();

            WorkspaceItem item = FindWorkspaceItem(workspaceId, window.ToInt64());
            CaptureLaunchProfileIfMissing(item, window, processId, executablePath);
        }

        private static string GetProcessExecutablePath(uint processId)
        {
            try
            {
                using (Process process = Process.GetProcessById((int)processId))
                {
                    return process.MainModule.FileName;
                }
            }
            catch (Exception)
            {
                return String.Empty;
            }
        }

        private static string GetWindowTitle(IntPtr window)
        {
            int length = NativeMethods.GetWindowTextLength(window);
            System.Text.StringBuilder text = new System.Text.StringBuilder(length + 1);
            NativeMethods.GetWindowText(window, text, text.Capacity);
            return text.ToString();
        }

        private static string GetCommandLine(uint processId)
        {
            string result = String.Empty;
            using (ManualResetEvent completed = new ManualResetEvent(false))
            {
                ThreadPool.QueueUserWorkItem(delegate
                {
                    try
                    {
                        result = GetCommandLineFromWmi(processId);
                    }
                    finally
                    {
                        try
                        {
                            completed.Set();
                        }
                        catch (ObjectDisposedException)
                        {
                        }
                    }
                });
                completed.WaitOne(250);
            }

            return result;
        }

        private static string GetCommandLineFromWmi(uint processId)
        {
            try
            {
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher("SELECT CommandLine FROM Win32_Process WHERE ProcessId = " + processId))
                {
                    searcher.Options.Timeout = TimeSpan.FromMilliseconds(250);
                    using (ManagementObjectCollection results = searcher.Get())
                    {
                        foreach (ManagementObject result in results)
                        {
                            return result["CommandLine"] as string ?? String.Empty;
                        }
                    }
                }
            }
            catch (ManagementException)
            {
            }
            catch (UnauthorizedAccessException)
            {
            }
            catch (InvalidOperationException)
            {
            }
            catch (System.Runtime.InteropServices.COMException)
            {
            }

            return String.Empty;
        }

        private void ShowWorkspace(int workspaceId)
        {
            ShowWorkspace(workspaceId, 0, false);
        }

        private void ShowWorkspace(int workspaceId, long selectedWindowHandle)
        {
            ShowWorkspace(workspaceId, selectedWindowHandle, false);
        }

        private void ShowWorkspace(int workspaceId, long selectedWindowHandle, bool minimizeAllItems)
        {
            foregroundSyncSuppression++;
            try
            {
                ShowWorkspaceInternal(workspaceId, selectedWindowHandle, minimizeAllItems);
            }
            finally
            {
                foregroundSyncSuppression = Math.Max(0, foregroundSyncSuppression - 1);
            }
        }

        private void ShowWorkspaceInternal(int workspaceId, long selectedWindowHandle, bool minimizeAllItems)
        {
            bool keepPanelVisible = Visible;
            activeWorkspace = workspaceId;
            selectedApplicationWindowHandle = selectedWindowHandle;
            IntPtr firstWindow = IntPtr.Zero;
            foreach (int id in workspaceLayout.GetWorkspaceIds())
            {
                System.Collections.Generic.IList<WorkspaceItem> items = catalog.GetWorkspaceItems(id);
                foreach (WorkspaceItem item in items)
                {
                    IntPtr window;
                    if (!TryResolveWorkspaceWindow(item, out window))
                    {
                        catalog.SetWindowAvailable(item.WindowHandle, false);
                        continue;
                    }

                    if (!WorkspaceVisibilityPolicy.ShouldHide(id, workspaceId))
                    {
                        if (minimizeAllItems && selectedWindowHandle == 0
                            && WorkspaceFocusPolicy.ShouldMinimizeAllForWorkspaceClick(workspaceId, id, item.WindowHandle))
                        {
                            catalog.SetWindowMaximized(item.WindowHandle, NativeMethods.IsZoomed(window));
                            MinimizeWindowFromWorkspaceAction(window);
                        }
                        else if (selectedWindowHandle != 0 && item.WindowHandle != selectedWindowHandle
                            && NativeMethods.IsWindowVisible(window))
                        {
                            // Application clicks affect only the selected window.
                            // Preserve visible peers, including minimized peers,
                            // on every display. Hidden workspace peers can still
                            // be restored when switching to their workspace.
                            continue;
                        }
                        else
                        {
                            bool canActivate = ShowWorkspaceItem(item, window, false);
                            if (canActivate && firstWindow == IntPtr.Zero)
                            {
                                firstWindow = window;
                            }
                        }
                    }
                    else
                    {
                        CaptureMinimizedStateBeforeHiding(item, window);
                        catalog.SetWindowMaximized(item.WindowHandle, NativeMethods.IsZoomed(window));
                        NativeMethods.ShowWindow(window, NativeMethods.SW_HIDE);
                    }
                }
            }

            if (firstWindow != IntPtr.Zero)
            {
                NativeMethods.SetForegroundWindow(firstWindow);
            }

            if (keepPanelVisible)
            {
                EnsureAlwaysOnTop();
            }

            Invalidate();
            SaveState();
        }

        private void QueueWorkspaceItemClick(WorkspaceItem item)
        {
            if (item == null)
            {
                return;
            }

            pendingApplicationClick = item;
            applicationClickTimer.Stop();
            applicationClickTimer.Start();
        }

        private void FlushPendingWorkspaceItemClick()
        {
            applicationClickTimer.Stop();
            WorkspaceItem item = pendingApplicationClick;
            pendingApplicationClick = null;
            if (item != null)
            {
                FocusWorkspaceItem(item);
            }
        }

        private void CancelPendingWorkspaceItemClick()
        {
            applicationClickTimer.Stop();
            pendingApplicationClick = null;
        }

        private void ReleaseApplicationInputCapture()
        {
            NativeMethods.ReleaseCapture();
            Capture = false;
            panelResizeEdge = PanelResizeEdge.None;
            resizingWorkspaceId = 0;
            isDraggingPanel = false;
            workspaceCardPressed = 0;
            workspaceCardDropIndex = -1;
            if (isReorderingWorkspaces)
            {
                EndWorkspaceCardReorder();
            }
        }

        private void KeepPanelVisibleForApplicationFocus()
        {
            CancelPendingWorkspaceItemClick();
            ReleaseApplicationInputCapture();
            panelIsPassive = true;
            if (!Visible)
            {
                Show();
            }

            TopMost = true;
            NativeMethods.SetWindowPos(
                Handle,
                NativeMethods.HWND_TOPMOST,
                0,
                0,
                0,
                0,
                NativeMethods.SWP_NOMOVE | NativeMethods.SWP_NOSIZE | NativeMethods.SWP_NOACTIVATE | NativeMethods.SWP_SHOWWINDOW);
        }

        private void FocusWorkspaceItem(WorkspaceItem item)
        {
            try
            {
                foregroundSyncSuppression++;
                IntPtr window;
                if (!TryResolveWorkspaceWindow(item, out window))
                {
                    if (!TryLaunchWorkspaceApplication(item, out window))
                    {
                        return;
                    }
                }

                item = FindWorkspaceItem(item.WorkspaceId, window.ToInt64()) ?? item;
                catalog.SetWindowUserMinimized(item.WindowHandle, false);
                ShowWorkspace(item.WorkspaceId, window.ToInt64());
                ShowWorkspaceItem(item, window, true);
                NativeMethods.SetForegroundWindow(window);
            }
            finally
            {
                foregroundSyncSuppression = Math.Max(0, foregroundSyncSuppression - 1);
                KeepPanelVisibleForApplicationFocus();
            }
        }

        private void RestoreAllManagedWindows()
        {
            foreach (int id in workspaceLayout.GetWorkspaceIds())
            {
                foreach (WorkspaceItem item in catalog.GetWorkspaceItems(id))
                {
                    IntPtr window = new IntPtr(item.WindowHandle);
                    if (NativeMethods.IsWindow(window))
                    {
                        ShowWorkspaceItem(item, window, false);
                    }
                }
            }
        }

        private void ExitAndRestore()
        {
            SaveState();
            RestoreAllManagedWindows();
            Application.Exit();
        }

        private void LoadState()
        {
            try
            {
                if (!File.Exists(statePath))
                {
                    return;
                }

                WorkspaceStateSnapshot snapshot = WorkspaceStateStore.Deserialize(File.ReadAllText(statePath));
                workspaceLayout.Restore(snapshot.WorkspaceIds);
                foreach (WorkspaceItemSnapshot item in snapshot.Items)
                {
                    catalog.RestoreItem(item);
                }
                // Card heights are now content-driven. Older saved manual heights
                // are intentionally ignored so they cannot reintroduce oversized cards.
                if (snapshot.PanelWidth > 0 && snapshot.PanelHeight > 0)
                {
                    savedPanelLogicalSize = new Size(snapshot.PanelWidth, snapshot.PanelHeight);
                    hasSavedPanelLogicalSize = true;
                    savedPanelBounds = new Rectangle(snapshot.PanelX, snapshot.PanelY, 0, 0);
                    hasSavedPanelBounds = true;
                }
            }
            catch (Exception)
            {
                workspaceLayout.Restore(null);
            }
        }

        private static string GetWorkspaceDataRoot()
        {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                ".lm-exe",
                "workspace-switcher");
        }

        private static string GetWorkspaceStatePath()
        {
            return Path.Combine(GetWorkspaceDataRoot(), "config", "workspace-state.xml");
        }

        private void MigrateLegacyStateIfNeeded()
        {
            try
            {
                if (File.Exists(statePath))
                {
                    return;
                }

                string legacyPath = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "WorkspaceSwitcher",
                    "state.xml");
                if (!File.Exists(legacyPath))
                {
                    return;
                }

                string directory = Path.GetDirectoryName(statePath);
                Directory.CreateDirectory(directory);
                File.Copy(legacyPath, statePath, false);
            }
            catch (Exception)
            {
            }
        }

        private void SaveState()
        {
            try
            {
                WorkspaceStateSnapshot snapshot = new WorkspaceStateSnapshot();
                foreach (int workspaceId in workspaceLayout.GetWorkspaceIds())
                {
                    snapshot.WorkspaceIds.Add(workspaceId);
                }

                foreach (WorkspaceItem item in catalog.GetAllItems())
                {
                    snapshot.Items.Add(new WorkspaceItemSnapshot
                    {
                        WindowHandle = item.WindowHandle,
                        WorkspaceId = item.WorkspaceId,
                        Title = item.Title,
                        ProcessName = item.ProcessName,
                        ExecutablePath = item.ExecutablePath,
                        LaunchArguments = item.LaunchArguments,
                        WorkingDirectory = item.WorkingDirectory,
                        DisplayName = item.DisplayName,
                        IsMaximized = item.IsMaximized,
                        IsUserMinimized = item.IsUserMinimized
                    });
                }

                foreach (System.Collections.Generic.KeyValuePair<int, int> height in workspaceHeights)
                {
                    snapshot.Heights.Add(new WorkspaceHeightSnapshot
                    {
                        WorkspaceId = height.Key,
                        Height = WorkspaceResizePolicy.ClampHeight(height.Value)
                    });
                }

                Rectangle panelBounds = hasSavedPanelBounds ? savedPanelBounds : Bounds;
                if (panelBounds.Width > 0 && panelBounds.Height > 0)
                {
                    snapshot.PanelX = panelBounds.X;
                    snapshot.PanelY = panelBounds.Y;
                    Size logicalSize = hasSavedPanelLogicalSize
                        ? savedPanelLogicalSize
                        : UnscaleDeviceSize(panelBounds.Size, currentDpi);
                    snapshot.PanelWidth = logicalSize.Width;
                    snapshot.PanelHeight = logicalSize.Height;
                }

                string directory = Path.GetDirectoryName(statePath);
                Directory.CreateDirectory(directory);
                File.WriteAllText(statePath, WorkspaceStateStore.Serialize(snapshot));
            }
            catch (Exception)
            {
            }
        }

        private void MinimizeWindowFromWorkspaceAction(IntPtr window)
        {
            if (window == IntPtr.Zero || !NativeMethods.IsWindow(window) || NativeMethods.IsIconic(window))
            {
                return;
            }

            long windowHandle = window.ToInt64();
            pendingWorkspaceMinimizeEvents.Add(windowHandle);
            workspaceMinimizedWindows.Add(windowHandle);
            NativeMethods.ShowWindow(window, NativeMethods.SW_MINIMIZE);
            if (!NativeMethods.IsIconic(window))
            {
                pendingWorkspaceMinimizeEvents.Remove(windowHandle);
                workspaceMinimizedWindows.Remove(windowHandle);
            }
        }

        private void CaptureMinimizedStateBeforeHiding(WorkspaceItem item, IntPtr window)
        {
            if (item == null || window == IntPtr.Zero || !NativeMethods.IsWindow(window))
            {
                return;
            }

            long windowHandle = window.ToInt64();
            if (HasPendingWorkspaceMinimizeEvent(windowHandle))
            {
                return;
            }

            bool isMinimized = NativeMethods.IsIconic(window);
            if (isMinimized && workspaceMinimizedWindows.Contains(windowHandle))
            {
                return;
            }

            if (!isMinimized)
            {
                pendingWorkspaceMinimizeEvents.Remove(windowHandle);
                workspaceMinimizedWindows.Remove(windowHandle);
            }

            if (item.IsUserMinimized != isMinimized)
            {
                catalog.SetWindowUserMinimized(windowHandle, isMinimized);
            }
        }

        private bool ShowWorkspaceItem(WorkspaceItem item, IntPtr window, bool explicitFocus)
        {
            if (item != null && WorkspaceWindowStatePolicy.ShouldShowMinimized(item.IsUserMinimized, explicitFocus))
            {
                NativeMethods.ShowWindow(window, NativeMethods.SW_SHOWMINNOACTIVE);
                return false;
            }

            if (item != null)
            {
                if (windowStateEventHook == IntPtr.Zero && !NativeMethods.IsIconic(window))
                {
                    pendingWorkspaceMinimizeEvents.Remove(item.WindowHandle);
                    workspaceMinimizedWindows.Remove(item.WindowHandle);
                }
            }
            ShowWindowUsingSavedState(window, item != null && item.IsMaximized);
            return true;
        }

        private static void ShowWindowUsingSavedState(IntPtr window, bool isMaximized)
        {
            NativeMethods.ShowWindow(window, isMaximized ? NativeMethods.SW_SHOWMAXIMIZED : NativeMethods.SW_RESTORE);
        }

    }

    internal static class Program
    {
        private const string InstanceMutexName = "WorkspaceSwitcher.SingleInstance";
        private const string ShowRequestEventName = "WorkspaceSwitcher.ShowRequest";
        private static WorkspaceForm panel;
        private static EventWaitHandle showRequestEvent;
        private static RegisteredWaitHandle showRequestRegistration;

        [STAThread]
        private static void Main()
        {
            bool showPanelOnStart = false;
            foreach (string argument in Environment.GetCommandLineArgs())
            {
                if (String.Equals(argument, "--show", StringComparison.OrdinalIgnoreCase))
                {
                    showPanelOnStart = true;
                    break;
                }
            }

            bool ownsMutex;
            using (Mutex mutex = new Mutex(true, InstanceMutexName, out ownsMutex))
            {
                if (!ownsMutex)
                {
                    if (showPanelOnStart)
                    {
                        SignalShowRequest();
                    }
                    return;
                }

                EnablePerMonitorDpiAwareness();
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                panel = new WorkspaceForm();
                IntPtr panelHandle = panel.Handle;
                RegisterShowRequestListener(panelHandle);

                try
                {
                    if (showPanelOnStart)
                    {
                        panel.Show();
                    }
                    else
                    {
                        panel.Hide();
                    }
                    Application.Run();
                }
                finally
                {
                    UnregisterShowRequestListener();
                }
            }
        }

        private static void RegisterShowRequestListener(IntPtr panelHandle)
        {
            try
            {
                bool createdNew;
                showRequestEvent = new EventWaitHandle(
                    false,
                    EventResetMode.AutoReset,
                    ShowRequestEventName,
                    out createdNew);
                showRequestRegistration = ThreadPool.RegisterWaitForSingleObject(
                    showRequestEvent,
                    delegate(object state, bool timedOut)
                    {
                        if (!timedOut && NativeMethods.IsWindow(panelHandle))
                        {
                            NativeMethods.PostMessage(panelHandle, NativeMethods.WM_SHOW_PANEL, IntPtr.Zero, IntPtr.Zero);
                        }
                    },
                    null,
                    Timeout.Infinite,
                    false);
            }
            catch (Exception)
            {
                UnregisterShowRequestListener();
            }
        }

        private static void SignalShowRequest()
        {
            try
            {
                using (EventWaitHandle request = EventWaitHandle.OpenExisting(ShowRequestEventName))
                {
                    request.Set();
                }
            }
            catch (WaitHandleCannotBeOpenedException)
            {
            }
            catch (UnauthorizedAccessException)
            {
            }
            catch (System.Security.SecurityException)
            {
            }
        }

        private static void UnregisterShowRequestListener()
        {
            if (showRequestRegistration != null)
            {
                showRequestRegistration.Unregister(null);
                showRequestRegistration = null;
            }

            if (showRequestEvent != null)
            {
                showRequestEvent.Dispose();
                showRequestEvent = null;
            }
        }

        private static void EnablePerMonitorDpiAwareness()
        {
            try
            {
                if (NativeMethods.SetProcessDpiAwarenessContext(new IntPtr(-4)))
                {
                    return;
                }
            }
            catch (EntryPointNotFoundException)
            {
            }
            catch (DllNotFoundException)
            {
            }

            try
            {
                NativeMethods.SetProcessDpiAwareness(2);
            }
            catch (EntryPointNotFoundException)
            {
            }
            catch (DllNotFoundException)
            {
            }
        }

    }

}
