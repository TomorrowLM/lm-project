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
        internal const int WM_HOTKEY = 0x0312;
        internal const int WM_CLOSE = 0x0010;
        internal const int WM_ERASEBKGND = 0x0014;
        internal const int WM_MOUSEACTIVATE = 0x0021;
        internal const int WM_NCHITTEST = 0x0084;
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
        internal const uint MOD_ALT = 0x0001;
        internal const uint MOD_CONTROL = 0x0002;
        internal const int SW_HIDE = 0;
        internal const int SW_SHOWNOACTIVATE = 4;
        internal const int SW_MINIMIZE = 6;
        internal const int SW_SHOWMAXIMIZED = 3;
        internal const int SW_RESTORE = 9;
        internal static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
        internal const uint SWP_NOSIZE = 0x0001;
        internal const uint SWP_NOMOVE = 0x0002;
        internal const uint SWP_NOZORDER = 0x0004;
        internal const uint SWP_NOACTIVATE = 0x0010;
        internal const uint SWP_SHOWWINDOW = 0x0040;
        internal const int VK_LBUTTON = 0x01;
        internal const uint EVENT_SYSTEM_FOREGROUND = 0x0003;
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
        internal static extern bool GetWindowRect(IntPtr hWnd, out Rect rectangle);

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

            using (Font font = new Font(WorkspaceVisualMetrics.FontFamilyName, 10f, FontStyle.Bold, GraphicsUnit.Pixel))
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
        public const int CardTop = 122;
        public const int CardGap = 12;
        public const int CardHeight = 112;
        public const int AddBlockHeight = 158;
        public const int SideMargin = 20;
        public const int PanelWidth = 520;
        public const int PanelHeight = 820;
        public const int PanelMinimumWidth = 360;
        public const int PanelMinimumHeight = 360;
        public const int PanelMaximumWidth = 760;
        public const int PanelMaximumHeight = 0;
        public const int PanelResizeGrip = 12;
        public const int PanelRadius = 20;
        public const int PanelBorderInset = 1;
        public const int PanelBorderArgb = unchecked((int)0x4AFFFFFF);
        public const int GridGap = 12;
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
        public const int DisplayTabTop = 54;
        public const int DisplayTabHeight = 42;
        public const int DisplayTabGap = 8;
        public const int DisplayTabRadius = 10;
        public const float TitleFontSize = 28.8f;
        public const float ItemFontSize = 21.6f;
        public const float AddTitleFontSize = 28.8f;
        public const float SmallFontSize = 18f;
        public const int HideButtonWidth = 81;
        public const int HideButtonHeight = 39;
        public const int HideButtonRadius = 9;
        public const int HideButtonTopMargin = 8;
        public const float HideButtonFontSize = 27f;
        public const int RefreshButtonWidth = 126;
        public const int RefreshButtonHeight = 39;
        public const int RefreshButtonRadius = 9;
        public const int DeleteButtonWidth = 76;
        public const int DeleteButtonHeight = 31;
        public const int DeleteButtonRadius = 9;
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
            using (Font font = new Font(WorkspaceVisualMetrics.FontFamilyName, 10f, FontStyle.Bold, GraphicsUnit.Pixel))
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
        private bool usingRegisteredHotKey;
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
        private bool hasSavedPanelBounds;
        private bool nativeGlassBackdropApplied;
        private readonly System.Windows.Forms.Timer applicationClickTimer = new System.Windows.Forms.Timer();
        private readonly System.Windows.Forms.Timer glassRefreshTimer = new System.Windows.Forms.Timer();
        private WorkspaceItem pendingApplicationClick;

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                DisposeDisplayContextMenu();
                applicationClickTimer.Dispose();
                glassRefreshTimer.Dispose();
            }

            base.Dispose(disposing);
        }

        public WorkspaceForm()
        {
            statePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "WorkspaceSwitcher", "state.xml");
            AutoScaleMode = AutoScaleMode.Dpi;
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
            MouseDown += delegate(object sender, MouseEventArgs args)
            {
                if (args.Button != MouseButtons.Left)
                {
                    return;
                }

                panelResizeEdge = WorkspacePanelLayout.GetResizeEdgeAt(args.Location, ClientSize, WorkspaceVisualMetrics.PanelResizeGrip);
                if (panelResizeEdge != PanelResizeEdge.None)
                {
                    panelResizeStartScreen = PointToScreen(args.Location);
                    panelResizeStartBounds = Bounds;
                    ignoreNextClick = true;
                    Capture = true;
                    return;
                }

                int resizeWorkspaceId = GetResizeHandleAt(args.X, args.Y);
                if (resizeWorkspaceId != 0)
                {
                    resizingWorkspaceId = resizeWorkspaceId;
                    resizeStartY = args.Y;
                    resizeStartHeight = GetWorkspaceCardHeight(resizeWorkspaceId);
                    ignoreNextClick = true;
                    Capture = true;
                    return;
                }

                if (CanDragPanelAt(args.Location))
                {
                    isDraggingPanel = true;
                    panelDragStartScreen = PointToScreen(args.Location);
                    panelDragStartLocation = Location;
                    ignoreNextClick = true;
                    Capture = true;
                    return;
                }

                if (GetDeleteButtonWorkspaceAt(args.X, args.Y) != 0)
                {
                    workspaceCardPressed = 0;
                    Capture = false;
                    return;
                }

                workspaceCardPressed = GetWorkspaceAt(args.X, args.Y);
                workspaceCardPressPoint = args.Location;
            Capture = true;
            };
            MouseMove += delegate(object sender, MouseEventArgs args)
            {
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
                        SetWorkspaceHeight(resizingWorkspaceId, resizeStartHeight + args.Y - resizeStartY);
                        Invalidate();
                    }
                    return;
                }

                if (args.Button == MouseButtons.None)
                {
                    PanelResizeEdge edge = WorkspacePanelLayout.GetResizeEdgeAt(args.Location, ClientSize, WorkspaceVisualMetrics.PanelResizeGrip);
                    Cursor = GetPanelResizeCursor(edge);
                    if (edge == PanelResizeEdge.None)
                    {
                        Cursor = GetResizeHandleAt(args.X, args.Y) == 0 ? (CanDragPanelAt(args.Location) ? Cursors.SizeAll : Cursors.Default) : Cursors.SizeNS;
                    }

                    int nextHoveredWorkspaceId = GetWorkspaceAt(args.X, args.Y);
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

                if (!isReorderingWorkspaces && WorkspaceDragPolicy.ShouldStartReorder(workspaceCardPressed, args.X - workspaceCardPressPoint.X, args.Y - workspaceCardPressPoint.Y))
                {
                    isReorderingWorkspaces = true;
                    workspaceGhost = new WorkspaceDragGhostForm("工作区 " + workspaceCardPressed);
                    workspaceGhost.MoveToPointer(PointToScreen(args.Location));
                    workspaceGhost.Show(this);
                }

                if (isReorderingWorkspaces)
                {
                    workspaceCardDropIndex = GetWorkspaceInsertIndex(args.Y);
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

                if (ignoreNextClick)
                {
                    ignoreNextClick = false;
                    CancelPendingWorkspaceItemClick();
                    return;
                }

                DisplayTabLayout displayTab = GetDisplayTabAt(args.X, args.Y);
                if (displayTab != null)
                {
                    CancelPendingWorkspaceItemClick();
                    selectedDisplayDeviceName = displayTab.DeviceName ?? String.Empty;
                    Invalidate();
                    return;
                }

                if (IsHideButtonAt(args.X, args.Y))
                {
                    CancelPendingWorkspaceItemClick();
                    Hide();
                    return;
                }

                if (IsRefreshButtonAt(args.X, args.Y))
                {
                    CancelPendingWorkspaceItemClick();
                    RefreshWorkspaceState();
                    return;
                }

                if (IsAddBlockAt(args.Y))
                {
                    CancelPendingWorkspaceItemClick();
                    CreateWorkspaceFromAddBlock();
                    return;
                }

                int workspaceToDelete = GetDeleteButtonWorkspaceAt(args.X, args.Y);
                if (workspaceToDelete != 0)
                {
                    CancelPendingWorkspaceItemClick();
                    ConfirmWorkspaceDeletion(workspaceToDelete);
                    return;
                }

                WorkspaceItem selectedItem = GetWorkspaceItemAt(args.X, args.Y);
                if (selectedItem != null)
                {
                    workspaceCardPressed = 0;
                    QueueWorkspaceItemClick(selectedItem);
                    return;
                }

                CancelPendingWorkspaceItemClick();
                int id = GetWorkspaceAt(args.X, args.Y);
                int pressedWorkspaceId = workspaceCardPressed;
                workspaceCardPressed = 0;
                if (WorkspaceCardClickPolicy.ShouldActivate(pressedWorkspaceId, id))
                {
                    ShowWorkspace(pressedWorkspaceId, 0, true);
                }
            };
            MouseUp += delegate(object sender, MouseEventArgs args)
            {
                if (args.Button == MouseButtons.Right)
                {
                    CancelPendingWorkspaceItemClick();
                    WorkspaceItem contextItem = GetWorkspaceItemAt(args.X, args.Y);
                    if (contextItem != null)
                    {
                        ShowDisplayContextMenu(contextItem, PointToScreen(args.Location));
                        return;
                    }

                    if (args.Y < CardTop)
                    {
                        ExitAndRestore();
                    }
                }
                else if (args.Button == MouseButtons.Left && panelResizeEdge != PanelResizeEdge.None)
                {
                    panelResizeEdge = PanelResizeEdge.None;
                    hasSavedPanelBounds = true;
                    savedPanelBounds = Bounds;
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
                if (args.Button == MouseButtons.Left)
                {
                    CancelPendingWorkspaceItemClick();
                    WorkspaceItem selectedItem = GetWorkspaceItemAt(args.X, args.Y);
                    if (selectedItem != null)
                    {
                        ToggleWindowMaximize(selectedItem);
                    }
                    else
                    {
                        ToggleSingleWindowMaximize(GetWorkspaceAt(args.X, args.Y));
                    }
                }
            };
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            // Use Win32 Acrylic. The compositor performs the blur behind the
            // client area; this form never samples or repaints the desktop.
            nativeGlassBackdropApplied = GlassWindowBackdrop.TryApply(Handle);
            usingRegisteredHotKey = NativeMethods.RegisterHotKey(Handle, HotKeyId, NativeMethods.MOD_CONTROL | NativeMethods.MOD_ALT, NativeMethods.VK_SPACE);
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
            UninstallKeyboardHook();
            if (foregroundEventHook != IntPtr.Zero)
            {
                NativeMethods.UnhookWinEvent(foregroundEventHook);
                foregroundEventHook = IntPtr.Zero;
            }

            nativeGlassBackdropApplied = false;
            foregroundEventCallback = null;
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
            if (message.Msg == NativeMethods.WM_HOTKEY && message.WParam.ToInt32() == HotKeyId)
            {
                TogglePanel();
                return;
            }

            if (message.Msg == NativeMethods.WM_MOUSEACTIVATE)
            {
                message.Result = new IntPtr(NativeMethods.MA_NOACTIVATE);
                return;
            }

            if (panelIsPassive && message.Msg == NativeMethods.WM_NCHITTEST)
            {
                int screenX = unchecked((short)(long)message.LParam);
                int screenY = unchecked((short)(((long)message.LParam) >> 16));
                Point clientPoint = PointToClient(new Point(screenX, screenY));
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

        private bool IsPanelInteractiveAt(Point clientPoint)
        {
            if (!ClientRectangle.Contains(clientPoint))
            {
                return false;
            }

            if (GetDisplayTabAt(clientPoint.X, clientPoint.Y) != null
                || IsHideButtonAt(clientPoint.X, clientPoint.Y)
                || IsRefreshButtonAt(clientPoint.X, clientPoint.Y)
                || IsAddBlockAt(clientPoint.Y)
                || GetDeleteButtonWorkspaceAt(clientPoint.X, clientPoint.Y) != 0
                || GetResizeHandleAt(clientPoint.X, clientPoint.Y) != 0
                || WorkspacePanelLayout.GetResizeEdgeAt(clientPoint, ClientSize, WorkspaceVisualMetrics.PanelResizeGrip) != PanelResizeEdge.None
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
            if (Visible && IsHandleCreated)
            {
                // The handle-created attempt can report success before DWM has
                // attached the Acrylic surface. Always reapply after the popup
                // is visible, then make one queued retry for the compositor.
                nativeGlassBackdropApplied = false;
                TryAttachNativeGlassBackdrop();
                BeginInvoke((MethodInvoker)(() =>
                {
                    nativeGlassBackdropApplied = false;
                    TryAttachNativeGlassBackdrop();
                }));
            }
            dragTimer.Enabled = Visible;
            if (Visible)
            {
                PlaceAtCenter();
                EnsureAlwaysOnTop();
                Invalidate();
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

            if (ClientSize.Width < WorkspaceVisualMetrics.PanelRadius * 2
                || ClientSize.Height < WorkspaceVisualMetrics.PanelRadius * 2)
            {
                return;
            }

            using (System.Drawing.Drawing2D.GraphicsPath path = WorkspaceVisuals.CreateRoundedPath(
                GetPanelShapeBounds(),
                GetPanelShapeRadius()))
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
            // When native Acrylic is available, Windows already composites
            // the exact pixels behind this window. Do not paint a second
            // wallpaper-file approximation over it: DynamicTheme files may
            // use a different crop than the desktop compositor.
            bool wallpaperGlassRendered = false;
            if (!nativeGlassBackdropApplied)
            {
                wallpaperGlassRendered = WallpaperGlassSurface.TryRender(
                    graphics,
                    ClientRectangle,
                    panelScreenBounds,
                    screenBounds,
                    WorkspaceVisualMetrics.PanelRadius);
            }
            if (!wallpaperGlassRendered && !nativeGlassBackdropApplied)
            {
                graphics.Clear(Color.FromArgb(WorkspaceVisualMetrics.PanelBackgroundArgb));
            }
            using (System.Drawing.Drawing2D.GraphicsPath panelPath = WorkspaceVisuals.CreateRoundedPath(
                GetPanelShapeBounds(), GetPanelShapeRadius()))
            using (Pen glassBorder = new Pen(Color.FromArgb(WorkspaceVisualMetrics.PanelBorderArgb), 1f))
            {
                graphics.DrawPath(glassBorder, panelPath);
            }
            using (Font titleFont = new Font(WorkspaceVisualMetrics.FontFamilyName, WorkspaceVisualMetrics.TitleFontSize, FontStyle.Bold, GraphicsUnit.Pixel))
            using (Font itemFont = new Font(WorkspaceVisualMetrics.FontFamilyName, WorkspaceVisualMetrics.ItemFontSize, FontStyle.Regular, GraphicsUnit.Pixel))
            using (Font addTitleFont = new Font(WorkspaceVisualMetrics.FontFamilyName, WorkspaceVisualMetrics.AddTitleFontSize, FontStyle.Bold, GraphicsUnit.Pixel))
            using (Font smallFont = new Font(WorkspaceVisualMetrics.FontFamilyName, WorkspaceVisualMetrics.SmallFontSize, FontStyle.Regular, GraphicsUnit.Pixel))
            using (Font displayTabFont = new Font(WorkspaceVisualMetrics.FontFamilyName, 15f, FontStyle.Regular, GraphicsUnit.Pixel))
            using (Brush muted = new SolidBrush(Color.FromArgb(WorkspaceVisualMetrics.MutedTextArgb)))
            {
                DrawDisplayTabs(graphics, displayTabFont);
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
            }
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

        private static int GetItemTopOffset()
        {
            using (Font titleFont = new Font(WorkspaceVisualMetrics.FontFamilyName, WorkspaceVisualMetrics.TitleFontSize, FontStyle.Bold, GraphicsUnit.Pixel))
            {
                return GetItemTopOffset(titleFont);
            }
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
            int fullWidth = ClientSize.Width - WorkspaceVisualMetrics.SideMargin * 2;
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
            using (Font titleFont = new Font(WorkspaceVisualMetrics.FontFamilyName, WorkspaceVisualMetrics.TitleFontSize, FontStyle.Bold, GraphicsUnit.Pixel))
            using (Font font = new Font(WorkspaceVisualMetrics.FontFamilyName, WorkspaceVisualMetrics.ItemFontSize, FontStyle.Regular, GraphicsUnit.Pixel))
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
            bool savedPanelIsOversized = hasSavedPanelBounds
                && savedPanelBounds.Width > WorkspaceVisualMetrics.PanelMaximumWidth;
            if (hasSavedPanelBounds && !savedPanelIsOversized)
            {
                Size size = WorkspacePanelLayout.ClampPanelSize(
                    savedPanelBounds.Size,
                    new Size(WorkspaceVisualMetrics.PanelMinimumWidth, WorkspaceVisualMetrics.PanelMinimumHeight),
                    GetPanelMaximumSize(area));
                int left = Math.Max(area.Left, Math.Min(savedPanelBounds.Left, area.Right - size.Width));
                int top = Math.Max(area.Top, Math.Min(savedPanelBounds.Top, area.Bottom - size.Height));
                Bounds = new Rectangle(left, top, size.Width, size.Height);
                savedPanelBounds = Bounds;
                return;
            }

            Size defaultSize = WorkspacePanelLayout.ClampPanelSize(
                new Size(WorkspaceVisualMetrics.PanelWidth, WorkspaceVisualMetrics.PanelHeight),
                new Size(WorkspaceVisualMetrics.PanelMinimumWidth, WorkspaceVisualMetrics.PanelMinimumHeight),
                GetPanelMaximumSize(area));
            Bounds = WorkspacePanelLayout.GetTopRightBounds(area, defaultSize);
            savedPanelBounds = Bounds;
            hasSavedPanelBounds = true;
        }

        private static Size GetPanelMaximumSize(Rectangle area)
        {
            return new Size(
                Math.Min(WorkspaceVisualMetrics.PanelMaximumWidth, area.Width),
                area.Height);
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

            return WorkspacePanelLayout.GetResizeEdgeAt(location, ClientSize, WorkspaceVisualMetrics.PanelResizeGrip) == PanelResizeEdge.None;
        }

        private Rectangle GetHideButtonBounds()
        {
            return new Rectangle(
                ClientSize.Width - HideButtonWidth - WorkspaceVisualMetrics.SideMargin,
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
            using (Font font = new Font(WorkspaceVisualMetrics.FontFamilyName, WorkspaceVisualMetrics.HideButtonFontSize, FontStyle.Regular, GraphicsUnit.Pixel))
            {
                graphics.FillPath(fill, path);
                graphics.DrawPath(border, path);
                Size textSize = TextRenderer.MeasureText("隐藏", font, new Size(80, 30), TextFormatFlags.NoPadding);
                DrawText(graphics, "隐藏", font, new Point(button.Left + (button.Width - textSize.Width) / 2, button.Top + (button.Height - textSize.Height) / 2), Color.FromArgb(WorkspaceVisualMetrics.MutedTextArgb));
            }
        }

        private System.Collections.Generic.IList<DisplayTabLayout> GetDisplayTabs()
        {
            System.Collections.Generic.List<DisplayTabLayout> tabs = new System.Collections.Generic.List<DisplayTabLayout>();
            Screen[] screens = Screen.AllScreens;
            int count = screens.Length + 1;
            int availableWidth = ClientSize.Width - WorkspaceVisualMetrics.SideMargin * 2 - WorkspaceVisualMetrics.DisplayTabGap * (count - 1);
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

                Size textSize = TextRenderer.MeasureText(tab.Label, font, new Size(tab.Bounds.Width, tab.Bounds.Height), TextFormatFlags.NoPadding);
                DrawText(
                    graphics,
                    tab.Label,
                    font,
                    new Point(tab.Bounds.Left + (tab.Bounds.Width - textSize.Width) / 2, tab.Bounds.Top + (tab.Bounds.Height - textSize.Height) / 2),
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
                card.Top + 10,
                WorkspaceVisualMetrics.DeleteButtonWidth,
                WorkspaceVisualMetrics.DeleteButtonHeight);
        }

        private int GetDeleteButtonWorkspaceAt(int clientX, int clientY)
        {
            foreach (int workspaceId in workspaceLayout.GetWorkspaceIds())
            {
                if (workspaceId > 1 && GetDeleteButtonBounds(workspaceId).Contains(clientX, clientY))
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
            using (Font font = new Font(WorkspaceVisualMetrics.FontFamilyName, 16f, FontStyle.Bold, GraphicsUnit.Pixel))
            {
                graphics.FillPath(fill, path);
                graphics.DrawPath(border, path);
                string label = "删除";
                Size textSize = TextRenderer.MeasureText(label, font, new Size(button.Width, button.Height), TextFormatFlags.NoPadding);
                DrawText(graphics, label, font, new Point(button.Left + (button.Width - textSize.Width) / 2, button.Top + (button.Height - textSize.Height) / 2), Color.FromArgb(WorkspaceVisualMetrics.DeleteButtonArgb));
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
                new Size(WorkspaceVisualMetrics.PanelMinimumWidth, WorkspaceVisualMetrics.PanelMinimumHeight),
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
            hasSavedPanelBounds = true;
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
                ShowWindowUsingSavedState(window, item.IsMaximized);
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

            using (Font font = new Font(WorkspaceVisualMetrics.FontFamilyName, WorkspaceVisualMetrics.ItemFontSize, FontStyle.Regular, GraphicsUnit.Pixel))
            {
                foreach (int workspaceId in workspaceLayout.GetWorkspaceIds())
                {
                    Rectangle card = GetWorkspaceCardBounds(workspaceId);
                    foreach (WorkspaceItemLayout layout in GetWorkspaceItemLayouts(card, workspaceId, font))
                    {
                        if (layout.Item.WindowHandle == item.WindowHandle)
                        {
                            return RectangleToScreen(layout.Bounds);
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

            NativeMethods.Rect rawBounds;
            if (!NativeMethods.GetWindowRect(window, out rawBounds))
            {
                return;
            }

            Screen sourceScreen = Screen.FromHandle(window);
            Rectangle sourceBounds = Rectangle.FromLTRB(rawBounds.Left, rawBounds.Top, rawBounds.Right, rawBounds.Bottom);
            Rectangle targetBounds = MapWindowBoundsToDisplay(sourceBounds, sourceScreen.WorkingArea, targetScreen.WorkingArea);
            NativeMethods.SetWindowPos(
                window,
                IntPtr.Zero,
                targetBounds.Left,
                targetBounds.Top,
                targetBounds.Width,
                targetBounds.Height,
                NativeMethods.SWP_NOZORDER | NativeMethods.SWP_NOACTIVATE);
            Invalidate();
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
                DrawText(graphics, plus, titleFont, new Point(addBlock.Left + (addBlock.Width - plusSize.Width) / 2, addBlock.Top + 14), Color.FromArgb(WorkspaceVisualMetrics.MutedTextArgb));
                string label = "新增工作区";
                Size labelSize = TextRenderer.MeasureText(label, titleFont, new Size(500, 50), TextFormatFlags.NoPadding);
                DrawText(graphics, label, titleFont, new Point(addBlock.Left + (addBlock.Width - labelSize.Width) / 2, addBlock.Top + 52), Color.FromArgb(WorkspaceVisualMetrics.TextArgb));
                string hint = "点击创建，或把窗口拖到这里";
                Size hintSize = TextRenderer.MeasureText(hint, smallFont, new Size(600, 40), TextFormatFlags.NoPadding);
                DrawText(graphics, hint, smallFont, new Point(addBlock.Left + (addBlock.Width - hintSize.Width) / 2, addBlock.Top + 94), Color.FromArgb(WorkspaceVisualMetrics.MutedTextArgb));
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
            return new Rectangle(WorkspaceVisualMetrics.SideMargin, firstCard.Bottom + CardGap, ClientSize.Width - WorkspaceVisualMetrics.SideMargin * 2, AddBlockHeight);
        }

        private int GetGridStartTop()
        {
            return GetWorkspaceCardBounds(1).Bottom + CardGap + AddBlockHeight + CardGap;
        }

        private bool IsAddBlockAt(int clientY)
        {
            return GetAddBlockBounds().Contains(20, clientY);
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
            foreach (int workspaceId in workspaceLayout.GetWorkspaceIds())
            {
                Rectangle card = GetWorkspaceCardBounds(workspaceId);
                if (clientX >= card.Left && clientX <= card.Right && clientY >= card.Bottom - 8 && clientY <= card.Bottom + 4)
                {
                    return workspaceId;
                }
            }

            return 0;
        }

        private int GetWorkspaceInsertIndex(int clientY)
        {
            System.Collections.Generic.IList<int> ids = workspaceLayout.GetWorkspaceIds();
            for (int index = 1; index < ids.Count; index++)
            {
                Rectangle card = GetWorkspaceCardBounds(ids[index]);
                if (clientY < card.Top + card.Height / 2)
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

        private void ToggleSingleWindowMaximize(int workspaceId)
        {
            if (workspaceId == 0)
            {
                return;
            }

            System.Collections.Generic.IList<WorkspaceItem> items = catalog.GetWorkspaceItems(workspaceId);
            if (items.Count != 1)
            {
                return;
            }

            WorkspaceItem item = items[0];
            IntPtr window = new IntPtr(item.WindowHandle);
            if (!NativeMethods.IsWindow(window))
            {
                catalog.RemoveWindow(item.WindowHandle);
                return;
            }

            ShowWorkspace(workspaceId);
            bool shouldMaximize = !NativeMethods.IsZoomed(window);
            catalog.SetWindowMaximized(item.WindowHandle, shouldMaximize);
            ShowWindowUsingSavedState(window, shouldMaximize);
            NativeMethods.SetForegroundWindow(window);
            Invalidate();
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

                ShowWorkspace(item.WorkspaceId, window.ToInt64(), true);
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
            foreach (int workspaceId in workspaceLayout.GetWorkspaceIds())
            {
                foreach (WorkspaceItem item in catalog.GetWorkspaceItems(workspaceId))
                {
                    IntPtr window;
                    bool available = TryResolveWorkspaceWindow(item, out window);
                    catalog.SetWindowAvailable(item.WindowHandle, available);
                }
            }

            SaveState();
            Invalidate();
        }

        private Rectangle GetRefreshButtonBounds()
        {
            return new Rectangle(
                ClientSize.Width - WorkspaceVisualMetrics.SideMargin - WorkspaceVisualMetrics.HideButtonWidth - 8 - WorkspaceVisualMetrics.RefreshButtonWidth,
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
            using (Font font = new Font(WorkspaceVisualMetrics.FontFamilyName, 16f, FontStyle.Regular, GraphicsUnit.Pixel))
            {
                graphics.FillPath(fill, path);
                graphics.DrawPath(border, path);
                string label = "刷新工作区";
                Size textSize = TextRenderer.MeasureText(label, font, new Size(button.Width, button.Height), TextFormatFlags.NoPadding);
                DrawText(graphics, label, font, new Point(button.Left + (button.Width - textSize.Width) / 2, button.Top + (button.Height - textSize.Height) / 2), Color.FromArgb(WorkspaceVisualMetrics.AccentArgb));
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

            int clientX = cursor.X - Left;
            int clientY = cursor.Y - Top;
            int newHighlight = dragging && Bounds.Contains(cursor.X, cursor.Y)
                ? GetWorkspaceAt(clientX, clientY)
                : 0;
            bool newAddHighlight = dragging && Bounds.Contains(cursor.X, cursor.Y) && IsAddBlockAt(clientY);
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
            return GetWorkspaceAt(ClientSize.Width / 2, clientY);
        }

        private int GetWorkspaceAt(int clientX, int clientY)
        {
            foreach (int workspaceId in workspaceLayout.GetWorkspaceIds())
            {
                if (GetWorkspaceCardBounds(workspaceId).Contains(clientX, clientY))
                {
                    return workspaceId;
                }
            }

            return 0;
        }

        private WorkspaceItem GetWorkspaceItemAt(int clientY)
        {
            return GetWorkspaceItemAt(ClientSize.Width / 2, clientY);
        }

        private WorkspaceItem GetWorkspaceItemAt(int clientX, int clientY)
        {
            int workspaceId = GetWorkspaceAt(clientX, clientY);
            if (workspaceId == 0)
            {
                return null;
            }

            Rectangle card = GetWorkspaceCardBounds(workspaceId);
            using (Font font = new Font(WorkspaceVisualMetrics.FontFamilyName, WorkspaceVisualMetrics.ItemFontSize, FontStyle.Regular, GraphicsUnit.Pixel))
            {
                foreach (WorkspaceItemLayout layout in GetWorkspaceItemLayouts(card, workspaceId, font))
                {
                    if (layout.Bounds.Contains(clientX, clientY))
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
                catalog.SetExecutablePath(window.ToInt64(), GetProcessExecutablePath(liveProcessId));
                catalog.SetWindowAvailable(window.ToInt64(), true);
                return true;
            }

            IntPtr exactMatch = IntPtr.Zero;
            IntPtr onlyProcessMatch = IntPtr.Zero;
            int processMatchCount = 0;
            NativeMethods.EnumWindows(delegate(IntPtr candidate, IntPtr data)
            {
                if (!IsWorkspaceItemWindow(item, candidate, true))
                {
                    return true;
                }

                processMatchCount++;
                onlyProcessMatch = candidate;
                if (String.Equals(GetWindowTitle(candidate), item.Title, StringComparison.Ordinal))
                {
                    exactMatch = candidate;
                    return false;
                }

                return true;
            }, IntPtr.Zero);

            IntPtr resolved = exactMatch != IntPtr.Zero
                ? exactMatch
                : processMatchCount == 1 && GetSavedProcessItemCount(item.ProcessName) == 1
                    ? onlyProcessMatch
                    : IntPtr.Zero;
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
            catalog.SetExecutablePath(resolved.ToInt64(), GetProcessExecutablePath(resolvedProcessId));
            catalog.SetWindowAvailable(resolved.ToInt64(), true);

            window = resolved;
            return true;
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

            bool forceNewWindow = String.Equals(item.ProcessName, "Code.exe", StringComparison.OrdinalIgnoreCase);
            System.Collections.Generic.HashSet<long> existingProcessWindows = forceNewWindow
                ? GetVisibleProcessWindows(item.ProcessName)
                : null;

            try
            {
                ProcessStartInfo startInfo = new ProcessStartInfo
                {
                    FileName = executable,
                    UseShellExecute = true
                };
                if (forceNewWindow)
                {
                    startInfo.Arguments = "--new-window";
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

            if (forceNewWindow)
            {
                IntPtr launchedWindow = WaitForNewProcessWindow(item.ProcessName, existingProcessWindows);
                if (launchedWindow == IntPtr.Zero || !catalog.RebindWindow(item.WindowHandle, launchedWindow.ToInt64()))
                {
                    return false;
                }

                item = FindWorkspaceItem(item.WorkspaceId, launchedWindow.ToInt64());
                if (item == null)
                {
                    return false;
                }

                uint launchedProcessId;
                NativeMethods.GetWindowThreadProcessId(launchedWindow, out launchedProcessId);
                catalog.SetExecutablePath(launchedWindow.ToInt64(), GetProcessExecutablePath(launchedProcessId));
                catalog.SetWindowAvailable(launchedWindow.ToInt64(), true);
                window = launchedWindow;
                return true;
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
            try
            {
                return Process.GetProcessById((int)processId).ProcessName + ".exe";
            }
            catch (ArgumentException)
            {
                return String.Empty;
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

            return DragPreviewPolicy.IsTitleBarPoint(cursor.Y, windowRectangle.Top, clientOrigin.Y);
        }

        private void BeginDragPreview(IntPtr window, NativeMethods.Point cursor)
        {
            ClearDragCandidate();
            dragSource = window;
            dragging = true;
            dragSourceWasMaximized = NativeMethods.IsZoomed(window);
            dragPreview = new DragPreviewForm(CaptureWindow(window), GetWindowTitle(window));
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

        private void HandleForegroundWindow(IntPtr window)
        {
            if (foregroundSyncSuppression > 0)
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
                ShowWorkspace(workspaceId);
                ShowWindowUsingSavedState(window, foregroundItem.IsMaximized);
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
                : processMatchCount == 1 ? onlyProcessMatch : null;
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

            catalog.AssignWindow(workspaceId, window.ToInt64(), GetWindowTitle(window), processName, GetCommandLine(processId));
            catalog.SetExecutablePath(window.ToInt64(), GetProcessExecutablePath(processId));
            catalog.SetWindowMaximized(window.ToInt64(), wasMaximized);
            SaveState();
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
            try
            {
                using (ManagementObjectSearcher searcher = new ManagementObjectSearcher("SELECT CommandLine FROM Win32_Process WHERE ProcessId = " + processId))
                using (ManagementObjectCollection results = searcher.Get())
                {
                    foreach (ManagementObject result in results)
                    {
                        return result["CommandLine"] as string ?? String.Empty;
                    }
                }
            }
            catch (ManagementException)
            {
            }
            catch (UnauthorizedAccessException)
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
            string selectedDisplayDeviceName = GetWindowDisplayDeviceName(new IntPtr(selectedWindowHandle));
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
                        if (minimizeAllItems
                            && (selectedWindowHandle == 0
                                ? WorkspaceFocusPolicy.ShouldMinimizeAllForWorkspaceClick(workspaceId, id, item.WindowHandle)
                                : WorkspaceFocusPolicy.ShouldMinimizePeerForApplicationFocus(workspaceId, id, selectedWindowHandle, item.WindowHandle)))
                        {
                            catalog.SetWindowMaximized(item.WindowHandle, NativeMethods.IsZoomed(window));
                            NativeMethods.ShowWindow(window, NativeMethods.SW_MINIMIZE);
                        }
                        else if (WorkspaceFocusPolicy.ShouldMinimizePeerOnDisplay(
                            workspaceId,
                            id,
                            selectedWindowHandle,
                            item.WindowHandle,
                            selectedDisplayDeviceName,
                            GetWindowDisplayDeviceName(window)))
                        {
                            catalog.SetWindowMaximized(item.WindowHandle, NativeMethods.IsZoomed(window));
                            NativeMethods.ShowWindow(window, NativeMethods.SW_MINIMIZE);
                        }
                        else
                        {
                            ShowWindowUsingSavedState(window, item.IsMaximized);
                            if (firstWindow == IntPtr.Zero)
                            {
                                firstWindow = window;
                            }
                        }
                    }
                    else
                    {
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

                ShowWorkspace(item.WorkspaceId, window.ToInt64());
                ShowWindowUsingSavedState(window, item.IsMaximized);
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
                        ShowWindowUsingSavedState(window, item.IsMaximized);
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
                foreach (WorkspaceHeightSnapshot height in snapshot.Heights)
                {
                    if (height.WorkspaceId >= 1 && height.WorkspaceId <= WorkspaceLayout.MaximumWorkspaceCount)
                    {
                        workspaceHeights[height.WorkspaceId] = WorkspaceResizePolicy.ClampHeight(height.Height);
                    }
                }
                if (snapshot.PanelWidth > 0 && snapshot.PanelHeight > 0)
                {
                    savedPanelBounds = new Rectangle(snapshot.PanelX, snapshot.PanelY, snapshot.PanelWidth, snapshot.PanelHeight);
                    hasSavedPanelBounds = true;
                }
            }
            catch (Exception)
            {
                workspaceLayout.Restore(null);
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
                        DisplayName = item.DisplayName,
                        IsMaximized = item.IsMaximized
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
                    snapshot.PanelWidth = panelBounds.Width;
                    snapshot.PanelHeight = panelBounds.Height;
                }

                string directory = Path.GetDirectoryName(statePath);
                Directory.CreateDirectory(directory);
                File.WriteAllText(statePath, WorkspaceStateStore.Serialize(snapshot));
            }
            catch (Exception)
            {
            }
        }

        private static void ShowWindowUsingSavedState(IntPtr window, bool isMaximized)
        {
            NativeMethods.ShowWindow(window, isMaximized ? NativeMethods.SW_SHOWMAXIMIZED : NativeMethods.SW_RESTORE);
        }

    }

    internal static class Program
    {
        private static WorkspaceForm panel;

        [STAThread]
        private static void Main()
        {
            bool ownsMutex;
            using (Mutex mutex = new Mutex(true, "WorkspaceSwitcher.SingleInstance", out ownsMutex))
            {
                if (!ownsMutex)
                {
                    return;
                }

                EnablePerMonitorDpiAwareness();
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                panel = new WorkspaceForm();
                IntPtr panelHandle = panel.Handle;
                bool showPanelOnStart = false;
                foreach (string argument in Environment.GetCommandLineArgs())
                {
                    if (String.Equals(argument, "--show", StringComparison.OrdinalIgnoreCase))
                    {
                        showPanelOnStart = true;
                        break;
                    }
                }

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
