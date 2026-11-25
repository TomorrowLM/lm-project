using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Linq;
using System.Threading;
using System.Windows.Forms;
using ToolHub.Core;

namespace ToolHub.App
{
    public sealed class ToolHubForm : Form
    {
        private const int HubWidth = 360;
        private const int SearchWidth = 250;
        private const int SearchHeight = 72;
        private const int ActionLeft = 274;
        private const int ActionSize = 82;
        private const int RowTop = 18;
        private const int RowHeight = 76;
        private const int ToolHubHotKeyId = 0x4412;
        private const int WmHotKey = 0x0312;
        private const uint ModAlt = 0x0001;
        private const uint ModControl = 0x0002;

        private static readonly Color Surface = Color.FromArgb(249, 250, 252);
        private static readonly Color Ink = Color.FromArgb(17, 24, 45);
        private static readonly Color Muted = Color.FromArgb(143, 151, 166);
        private static readonly Color Hover = Color.FromArgb(237, 243, 255);
        private static readonly Color Accent = Color.FromArgb(43, 108, 255);
        private static readonly Color ExitInk = Color.FromArgb(177, 67, 84);
        private static readonly Color ExitHover = Color.FromArgb(255, 241, 243);

        private readonly IList<ToolHubTool> allTools;
        private readonly ToolHubLayout layout;
        private readonly IList<Process> launchedProcesses = new List<Process>();
        private IList<ToolHubTool> visibleTools;
        private readonly TextBox searchBox;
        private readonly System.Windows.Forms.Timer collapseTimer;
        private readonly System.Threading.Timer networkSpeedTimer;
        private readonly System.Windows.Forms.Timer dshStatusTimer;
        private int hoveredIndex = -1;
        private int hoveredDshAction = -1;
        private int networkSampleInProgress;
        private int resetNetworkBaseline;
        private long networkSampleGeneration;
        private int dshRefreshInProgress;
        private ulong previousReceivedBytes;
        private ulong previousSentBytes;
        private long previousNetworkSampleTimestamp;
        private bool hasPreviousNetworkSample;
        private bool networkSpeedVisible;
        private string networkDownloadRate = "--";
        private string networkUploadRate = "--";
        private Rectangle actionBounds;
        private bool isExpanded;
        private bool dshActionsExpanded;
        private bool dshBusy;
        private DshWebStatus dshStatus = new DshWebStatus(DshWebState.Unknown, 0, 3080, false, "尚未检测");
        private string dshOperationText = string.Empty;
        private bool isDragging;
        private bool dragFromActionButton;
        private bool dragMoved;
        private Point dragStartCursor;
        private Point dragStartLocation;
        private bool hotKeyRegistered;
        private bool hasShutdownLaunchedTools;

        public ToolHubForm(IList<ToolHubTool> tools)
        {
            allTools = tools ?? new List<ToolHubTool>();
            layout = new ToolHubLayout(allTools.Count);
            visibleTools = ToolHubCatalog.Filter(allTools, string.Empty);

            AutoScaleMode = AutoScaleMode.None;
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            TopMost = true;
            KeyPreview = true;
            ClientSize = new Size(HubWidth, layout.HubHeight);
            BackColor = Surface;
            try
            {
                Icon = System.Drawing.Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            }
            catch (Exception)
            {
            }
            DoubleBuffered = true;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                     ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);

            collapseTimer = new System.Windows.Forms.Timer { Interval = 250 };
            collapseTimer.Tick += delegate
            {
                collapseTimer.Stop();
                if (isExpanded && !isDragging && !IsCursorWithinExpandedBounds())
                {
                    SetExpanded(false);
                }
            };

            networkSpeedTimer = new System.Threading.Timer(SampleNetworkTraffic, null,
                Timeout.Infinite, Timeout.Infinite);

            dshStatusTimer = new System.Windows.Forms.Timer { Interval = 2000 };
            dshStatusTimer.Tick += delegate { RefreshDshStatus(); };

            searchBox = new TextBox
            {
                BorderStyle = BorderStyle.None,
                BackColor = Surface,
                ForeColor = Muted,
                Font = new Font("Microsoft YaHei UI", 16F, FontStyle.Regular, GraphicsUnit.Pixel),
                Location = new Point(31, layout.SearchTop + 23),
                Size = new Size(SearchWidth - 48, 33),
                TabStop = true
            };
            searchBox.TextChanged += delegate
            {
                visibleTools = ToolHubCatalog.Filter(allTools, searchBox.Text);
                hoveredIndex = -1;
                if (dshActionsExpanded && FindDshVisibleIndex() < 0)
                {
                    SetDshActionsExpanded(false);
                }
                UpdateNetworkSpeedVisibility();
                Invalidate();
            };
            searchBox.GotFocus += delegate { UpdateNetworkSpeedVisibility(); };
            searchBox.LostFocus += delegate { UpdateNetworkSpeedVisibility(); };
            searchBox.KeyDown += delegate(object sender, KeyEventArgs e)
            {
                if (e.KeyCode == Keys.Enter)
                {
                    LaunchFirstVisibleTool();
                    e.Handled = true;
                    e.SuppressKeyPress = true;
                }
            };
            NativeMethods.SetCueBanner(searchBox, "向工具中心提问");
            Controls.Add(searchBox);

            SetExpanded(false);
            PositionNearCursor();
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            hotKeyRegistered = NativeMethods.RegisterHotKey(
                Handle,
                ToolHubHotKeyId,
                ModControl | ModAlt,
                (uint)Keys.F12);
            if (networkSpeedVisible)
            {
                StartNetworkSampling();
            }
        }

        protected override void OnHandleDestroyed(EventArgs e)
        {
            if (hotKeyRegistered)
            {
                NativeMethods.UnregisterHotKey(Handle, ToolHubHotKeyId);
                hotKeyRegistered = false;
            }

            StopNetworkSampling();
            dshStatusTimer.Stop();

            base.OnHandleDestroyed(e);
        }

        protected override void WndProc(ref Message message)
        {
            if (message.Msg == WmHotKey && message.WParam.ToInt32() == ToolHubHotKeyId)
            {
                ToggleVisibility();
                return;
            }

            base.WndProc(ref message);
        }

        private void ToggleVisibility()
        {
            if (Visible)
            {
                SetExpanded(false);
                Hide();
                return;
            }

            SetExpanded(false);
            PositionNearCursor();
            Show();
            BringToFront();
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            Graphics graphics = e.Graphics;
            graphics.SmoothingMode = SmoothingMode.AntiAlias;
            graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
            graphics.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
            graphics.Clear(Surface);

            using (GraphicsPath mainPath = CreateRoundedPath(new Rectangle(0, 0, HubWidth, layout.MainPanelHeight), 28))
            using (SolidBrush mainBrush = new SolidBrush(Surface))
            {
                graphics.FillPath(mainBrush, mainPath);
            }

            DrawRows(graphics);
            DrawSearchSurface(graphics);
            DrawNetworkSpeed(graphics);
            DrawActionButton(graphics);
        }

        protected override void OnMouseEnter(EventArgs e)
        {
            base.OnMouseEnter(e);
            collapseTimer.Stop();
            if (!isExpanded)
            {
                SetExpanded(true);
            }
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            base.OnMouseDown(e);
            if (e.Button != MouseButtons.Left || !IsDragHandle(e.Location))
            {
                return;
            }

            collapseTimer.Stop();
            isDragging = true;
            dragFromActionButton = true;
            dragMoved = false;
            dragStartCursor = Cursor.Position;
            dragStartLocation = Location;
            Capture = true;
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            base.OnMouseMove(e);
            if (isDragging)
            {
                Point cursor = Cursor.Position;
                int deltaX = cursor.X - dragStartCursor.X;
                int deltaY = cursor.Y - dragStartCursor.Y;
                Size dragSize = SystemInformation.DragSize;
                if (!dragMoved && Math.Abs(deltaX) < dragSize.Width && Math.Abs(deltaY) < dragSize.Height)
                {
                    return;
                }

                dragMoved = true;
                Location = new Point(
                    dragStartLocation.X + deltaX,
                    dragStartLocation.Y + deltaY);
                return;
            }

            int nextHovered = GetRowIndex(e.Location);
            int nextDshAction = GetDshActionIndex(e.Location);
            if (actionBounds.Contains(e.Location))
            {
                nextHovered = -1;
            }

            if (nextHovered != hoveredIndex || nextDshAction != hoveredDshAction)
            {
                hoveredIndex = nextHovered;
                hoveredDshAction = nextDshAction;
                Invalidate();
            }
        }

        protected override void OnMouseLeave(EventArgs e)
        {
            base.OnMouseLeave(e);
            if (hoveredIndex != -1)
            {
                hoveredIndex = -1;
                Invalidate();
            }
            if (hoveredDshAction != -1)
            {
                hoveredDshAction = -1;
                Invalidate();
            }

            if (isExpanded && !isDragging)
            {
                collapseTimer.Start();
            }
        }

        protected override void OnMouseUp(MouseEventArgs e)
        {
            base.OnMouseUp(e);
            if (e.Button == MouseButtons.Left && isDragging)
            {
                bool shouldLaunchTool = dragFromActionButton && !dragMoved;
                isDragging = false;
                dragFromActionButton = false;
                dragMoved = false;
                Capture = false;
                if (shouldLaunchTool)
                {
                    LaunchFirstVisibleTool();
                }
                return;
            }

            if (e.Button != MouseButtons.Left)
            {
                return;
            }

            if (actionBounds.Contains(e.Location))
            {
                LaunchFirstVisibleTool();
                return;
            }

            int dshActionIndex = GetDshActionIndex(e.Location);
            if (dshActionIndex >= 0)
            {
                HandleDshAction(dshActionIndex);
                return;
            }

            int dshRowIndex = FindDshVisibleIndex();
            if (dshActionsExpanded && dshStatus != null && dshStatus.State == DshWebState.Unknown &&
                dshRowIndex >= 0 &&
                GetDshStatusBounds(RowTop + dshRowIndex * RowHeight).Contains(e.Location))
            {
                MessageBox.Show(this, dshStatus.Message, "DSH 检测详情",
                    MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            int rowIndex = GetRowIndex(e.Location);
            if (rowIndex == Math.Min(visibleTools.Count, layout.ToolCount))
            {
                ExitApplication();
                return;
            }

            if (rowIndex >= 0 && rowIndex < visibleTools.Count && rowIndex < layout.ToolCount)
            {
                LaunchTool(visibleTools[rowIndex]);
            }
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
        {
            if (keyData == Keys.Escape)
            {
                Close();
                return true;
            }

            if (keyData == (Keys.Control | Keys.F))
            {
                searchBox.Focus();
                searchBox.SelectAll();
                return true;
            }

            return base.ProcessCmdKey(ref msg, keyData);
        }

        private void SetExpanded(bool expanded)
        {
            if (!expanded)
            {
                collapseTimer.Stop();
                SetDshActionsExpanded(false);
            }

            isExpanded = expanded;
            searchBox.Visible = expanded;
            UpdateNetworkSpeedVisibility();
            Region = new Region(expanded ? BuildWindowPath() : BuildCollapsedPath());
            Invalidate();
        }

        private void UpdateNetworkSpeedVisibility()
        {
            bool shouldShow = NetworkSpeedDisplayPolicy.ShouldShow(
                isExpanded,
                searchBox != null && searchBox.Focused,
                searchBox != null && !string.IsNullOrEmpty(searchBox.Text));
            if (networkSpeedVisible == shouldShow)
            {
                return;
            }

            networkSpeedVisible = shouldShow;
            searchBox.Size = new Size(shouldShow ? 127 : SearchWidth - 48, 33);
            if (shouldShow)
            {
                networkDownloadRate = "--";
                networkUploadRate = "--";
                StartNetworkSampling();
            }
            else
            {
                StopNetworkSampling();
                networkDownloadRate = "--";
                networkUploadRate = "--";
            }

            Invalidate();
        }

        private void StopNetworkSampling()
        {
            if (networkSpeedTimer == null)
            {
                return;
            }

            networkSpeedTimer.Change(Timeout.Infinite, Timeout.Infinite);
            Interlocked.Increment(ref networkSampleGeneration);
        }

        private void StartNetworkSampling()
        {
            Interlocked.Exchange(ref resetNetworkBaseline, 1);
            Interlocked.Increment(ref networkSampleGeneration);
            networkSpeedTimer.Change(0, 1000);
        }

        private void SampleNetworkTraffic(object state)
        {
            if (Interlocked.CompareExchange(ref networkSampleInProgress, 1, 0) != 0)
            {
                return;
            }

            try
            {
                long generation = Interlocked.Read(ref networkSampleGeneration);
                ulong receivedBytes;
                ulong sentBytes;
                string downloadText = "--";
                string uploadText = "--";
                if (NetworkTrafficSampler.TryGetPhysicalInterfaceCounters(out receivedBytes, out sentBytes))
                {
                    long timestamp = Stopwatch.GetTimestamp();
                    bool resetBaseline = Interlocked.Exchange(ref resetNetworkBaseline, 0) != 0;
                    if (!resetBaseline && hasPreviousNetworkSample)
                    {
                        double elapsedSeconds = (double)(timestamp - previousNetworkSampleTimestamp) /
                                                Stopwatch.Frequency;
                        double downloadBytesPerSecond;
                        double uploadBytesPerSecond;
                        if (NetworkTrafficRateCalculator.TryCalculate(
                            previousReceivedBytes,
                            previousSentBytes,
                            receivedBytes,
                            sentBytes,
                            TimeSpan.FromSeconds(elapsedSeconds),
                            out downloadBytesPerSecond,
                            out uploadBytesPerSecond))
                        {
                            downloadText = NetworkTrafficRateCalculator.FormatBytesPerSecond(downloadBytesPerSecond);
                            uploadText = NetworkTrafficRateCalculator.FormatBytesPerSecond(uploadBytesPerSecond);
                        }
                    }

                    previousReceivedBytes = receivedBytes;
                    previousSentBytes = sentBytes;
                    previousNetworkSampleTimestamp = timestamp;
                    hasPreviousNetworkSample = true;
                }
                else
                {
                    hasPreviousNetworkSample = false;
                    Interlocked.Exchange(ref resetNetworkBaseline, 1);
                }

                if (!IsHandleCreated || IsDisposed)
                {
                    return;
                }

                BeginInvoke((MethodInvoker)delegate
                {
                    if (IsDisposed || !networkSpeedVisible ||
                        generation != Interlocked.Read(ref networkSampleGeneration))
                    {
                        return;
                    }

                    networkDownloadRate = downloadText;
                    networkUploadRate = uploadText;
                    Invalidate();
                });
            }
            catch (InvalidOperationException)
            {
                // The window can lose its handle while a background sample is being posted.
            }
            catch (Exception)
            {
                // A failed optional network sample must never interrupt the tool hub.
            }
            finally
            {
                Interlocked.Exchange(ref networkSampleInProgress, 0);
            }
        }

        private bool IsCursorWithinExpandedBounds()
        {
            Rectangle screenBounds = RectangleToScreen(ClientRectangle);
            return screenBounds.Contains(Cursor.Position);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                if (collapseTimer != null)
                {
                    collapseTimer.Stop();
                    collapseTimer.Dispose();
                }
                if (dshStatusTimer != null)
                {
                    dshStatusTimer.Stop();
                    dshStatusTimer.Dispose();
                }

            }

            base.Dispose(disposing);

            if (disposing && networkSpeedTimer != null)
            {
                Interlocked.Increment(ref networkSampleGeneration);
                networkSpeedTimer.Dispose();
            }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            ShutdownLaunchedTools();
            base.OnFormClosing(e);
        }

        private void DrawRows(Graphics graphics)
        {
            using (Font labelFont = new Font("Microsoft YaHei UI", 19F, FontStyle.Regular, GraphicsUnit.Pixel))
            using (Font unavailableFont = new Font("Microsoft YaHei UI", 19F, FontStyle.Regular, GraphicsUnit.Pixel))
            using (SolidBrush textBrush = new SolidBrush(Ink))
            using (SolidBrush disabledBrush = new SolidBrush(Muted))
            using (Pen hoverPen = new Pen(Hover, 1F))
            {
                for (int i = 0; i < visibleTools.Count && i < layout.ToolCount; i++)
                {
                    ToolHubTool tool = visibleTools[i];
                    int top = RowTop + i * RowHeight;
                    if (i == hoveredIndex)
                    {
                        using (GraphicsPath rowPath = CreateRoundedPath(new Rectangle(15, top + 2, HubWidth - 30, 66), 19))
                        using (SolidBrush hoverBrush = new SolidBrush(Hover))
                        {
                            graphics.FillPath(hoverBrush, rowPath);
                            graphics.DrawPath(hoverPen, rowPath);
                        }
                    }

                    DrawToolIcon(graphics, tool.Id, new Point(34, top + 19), tool.IsAvailable ? Ink : Muted);
                    if (tool.Id == "dsh" && dshActionsExpanded)
                    {
                        DrawDshActions(graphics, tool, top, textBrush, disabledBrush);
                    }
                    else
                    {
                        graphics.DrawString(tool.Label, tool.IsAvailable ? labelFont : unavailableFont,
                            tool.IsAvailable ? textBrush : disabledBrush, 84F, top + 21F);
                    }
                }

                if (visibleTools.Count == 0)
                {
                    graphics.DrawString("没有匹配的工具", labelFont, disabledBrush, 34F, RowTop + 32F);
                }

                DrawExitRow(graphics, Math.Min(visibleTools.Count, layout.ToolCount));
            }
        }

        private void DrawExitRow(Graphics graphics, int rowIndex)
        {
            int top = RowTop + rowIndex * RowHeight;
            using (Font labelFont = new Font("Microsoft YaHei UI", 19F, FontStyle.Regular, GraphicsUnit.Pixel))
            using (SolidBrush textBrush = new SolidBrush(ExitInk))
            using (Pen hoverPen = new Pen(ExitHover, 1F))
            {
                if (hoveredIndex == rowIndex)
                {
                    using (GraphicsPath rowPath = CreateRoundedPath(new Rectangle(15, top + 2, HubWidth - 30, 66), 19))
                    using (SolidBrush hoverBrush = new SolidBrush(ExitHover))
                    {
                        graphics.FillPath(hoverBrush, rowPath);
                        graphics.DrawPath(hoverPen, rowPath);
                    }
                }

                DrawExitIcon(graphics, new Point(34, top + 18));
                graphics.DrawString("退出工具中心", labelFont, textBrush, 84F, top + 21F);
            }
        }

        private void DrawSearchSurface(Graphics graphics)
        {
            using (GraphicsPath path = CreateRoundedPath(new Rectangle(7, layout.SearchTop, SearchWidth, SearchHeight), 38))
            using (SolidBrush brush = new SolidBrush(Surface))
            {
                graphics.FillPath(brush, path);
            }
        }

        private void DrawNetworkSpeed(Graphics graphics)
        {
            if (!networkSpeedVisible)
            {
                return;
            }

            float top = layout.SearchTop;
            using (Font rateFont = new Font("Microsoft YaHei UI", 12F, FontStyle.Regular, GraphicsUnit.Pixel))
            using (SolidBrush uploadBrush = new SolidBrush(Color.FromArgb(31, 153, 101)))
            using (SolidBrush downloadBrush = new SolidBrush(Accent))
            using (StringFormat format = new StringFormat(StringFormatFlags.NoWrap))
            {
                format.Trimming = StringTrimming.EllipsisCharacter;
                graphics.DrawString("↑ " + networkUploadRate, rateFont, uploadBrush,
                    new RectangleF(164F, top + 15F, 84F, 17F), format);
                graphics.DrawString("↓ " + networkDownloadRate, rateFont, downloadBrush,
                    new RectangleF(164F, top + 38F, 84F, 17F), format);
            }
        }

        private void DrawActionButton(Graphics graphics)
        {
            actionBounds = new Rectangle(ActionLeft, layout.SearchTop, ActionSize, ActionSize);
            ToolHubIcon.Draw(graphics, actionBounds);
        }

        private void DrawToolIcon(Graphics graphics, string id, Point origin, Color color)
        {
            using (Pen pen = new Pen(color, 2.2F))
            {
                pen.StartCap = LineCap.Round;
                pen.EndCap = LineCap.Round;
                pen.LineJoin = LineJoin.Round;

                if (id == "workspace")
                {
                    Point[] hexagon =
                    {
                        new Point(origin.X + 5, origin.Y + 2),
                        new Point(origin.X + 17, origin.Y + 2),
                        new Point(origin.X + 23, origin.Y + 12),
                        new Point(origin.X + 17, origin.Y + 22),
                        new Point(origin.X + 5, origin.Y + 22),
                        new Point(origin.X - 1, origin.Y + 12),
                        new Point(origin.X + 5, origin.Y + 2)
                    };
                    graphics.DrawLines(pen, hexagon);
                    graphics.DrawLine(pen, origin.X + 7, origin.Y + 2, origin.X + 13, origin.Y + 12);
                    graphics.DrawLine(pen, origin.X + 13, origin.Y + 12, origin.X + 7, origin.Y + 22);
                }
                else if (id == "wallpaper")
                {
                    using (GraphicsPath monitor = CreateRoundedPath(new Rectangle(origin.X, origin.Y + 2, 27, 21), 4))
                    {
                        graphics.DrawPath(pen, monitor);
                    }
                    graphics.DrawLine(pen, origin.X + 5, origin.Y + 23, origin.X + 1, origin.Y + 27);
                    graphics.DrawLine(pen, origin.X + 22, origin.Y + 23, origin.X + 26, origin.Y + 27);
                    graphics.DrawArc(pen, origin.X + 8, origin.Y + 11, 8, 8, 205, 140);
                    graphics.DrawLine(pen, origin.X + 14, origin.Y + 15, origin.X + 19, origin.Y + 10);
                }
                else if (id == "system-diagnostics")
                {
                    graphics.DrawLine(pen, origin.X + 1, origin.Y + 25, origin.X + 28, origin.Y + 25);
                    graphics.DrawLine(pen, origin.X + 3, origin.Y + 23, origin.X + 3, origin.Y + 4);
                    Point[] pulse =
                    {
                        new Point(origin.X + 5, origin.Y + 17),
                        new Point(origin.X + 10, origin.Y + 17),
                        new Point(origin.X + 13, origin.Y + 9),
                        new Point(origin.X + 17, origin.Y + 21),
                        new Point(origin.X + 20, origin.Y + 14),
                        new Point(origin.X + 26, origin.Y + 14)
                    };
                    graphics.DrawLines(pen, pulse);
                }
                else if (id == "dsh")
                {
                    using (GraphicsPath browser = CreateRoundedPath(new Rectangle(origin.X, origin.Y + 3, 27, 21), 4))
                    {
                        graphics.DrawPath(pen, browser);
                    }
                    graphics.DrawLine(pen, origin.X + 1, origin.Y + 9, origin.X + 26, origin.Y + 9);
                    graphics.DrawEllipse(pen, origin.X + 4, origin.Y + 5, 1, 1);
                    graphics.DrawEllipse(pen, origin.X + 8, origin.Y + 5, 1, 1);
                    graphics.DrawLine(pen, origin.X + 7, origin.Y + 16, origin.X + 12, origin.Y + 16);
                    graphics.DrawLine(pen, origin.X + 12, origin.Y + 16, origin.X + 15, origin.Y + 13);
                    graphics.DrawLine(pen, origin.X + 15, origin.Y + 13, origin.X + 19, origin.Y + 18);
                    graphics.DrawLine(pen, origin.X + 19, origin.Y + 18, origin.X + 23, origin.Y + 14);
                }
                else
                {
                    graphics.DrawEllipse(pen, origin.X + 2, origin.Y + 4, 17, 17);
                    graphics.DrawLine(pen, origin.X + 17, origin.Y + 8, origin.X + 24, origin.Y + 2);
                    graphics.DrawLine(pen, origin.X + 24, origin.Y + 2, origin.X + 28, origin.Y + 6);
                    graphics.DrawLine(pen, origin.X + 24, origin.Y + 2, origin.X + 27, origin.Y - 2);
                    graphics.DrawLine(pen, origin.X + 11, origin.Y + 21, origin.X + 11, origin.Y + 27);
                    graphics.DrawLine(pen, origin.X + 6, origin.Y + 27, origin.X + 17, origin.Y + 27);
                }
            }
        }

        private void DrawExitIcon(Graphics graphics, Point origin)
        {
            using (Pen pen = new Pen(ExitInk, 2.4F))
            {
                pen.StartCap = LineCap.Round;
                pen.EndCap = LineCap.Round;
                graphics.DrawArc(pen, origin.X + 2, origin.Y + 3, 23, 23, 45, 270);
                graphics.DrawLine(pen, origin.X + 14, origin.Y, origin.X + 14, origin.Y + 13);
            }
        }

        private bool IsDragHandle(Point point)
        {
            return actionBounds.Contains(point);
        }

        private int GetRowIndex(Point point)
        {
            int rowCount = Math.Min(visibleTools.Count, layout.ToolCount) + 1;
            if (point.X < 10 || point.X > HubWidth - 10 || point.Y < RowTop || point.Y >= RowTop + rowCount * RowHeight)
            {
                return -1;
            }

            return (point.Y - RowTop) / RowHeight;
        }

        private void DrawDshActions(Graphics graphics, ToolHubTool tool, int top, Brush textBrush, Brush disabledBrush)
        {
            using (Font titleFont = new Font("Microsoft YaHei UI", 17F, FontStyle.Regular, GraphicsUnit.Pixel))
            using (Font statusFont = new Font("Microsoft YaHei UI", 12F, FontStyle.Regular, GraphicsUnit.Pixel))
            using (Font actionFont = new Font("Microsoft YaHei UI", 12F, FontStyle.Regular, GraphicsUnit.Pixel))
            using (StringFormat centered = new StringFormat())
            using (StringFormat statusFormat = new StringFormat())
            using (SolidBrush statusBrush = new SolidBrush(GetDshStatusColor()))
            {
                centered.Alignment = StringAlignment.Center;
                centered.LineAlignment = StringAlignment.Center;
                statusFormat.FormatFlags = StringFormatFlags.NoWrap;
                statusFormat.Trimming = StringTrimming.EllipsisCharacter;
                graphics.DrawString(tool.Label, titleFont, (Brush)textBrush, 84F, top + 4F);

                string statusText = dshBusy
                    ? dshOperationText
                    : GetDshStatusText();
                graphics.DrawString(statusText, statusFont,
                    string.IsNullOrEmpty(statusText) ? disabledBrush : statusBrush,
                    GetDshStatusBounds(top), statusFormat);

                string[] labels = { "启动", "暂停", "重启", "打开" };
                for (int i = 0; i < labels.Length; i++)
                {
                    Rectangle bounds = GetDshActionBounds(i, top);
                    bool enabled = IsDshActionEnabled(i);
                    Color borderColor = enabled ? Color.FromArgb(210, 221, 238) : Color.FromArgb(231, 234, 240);
                    Color fillColor = i == hoveredDshAction && enabled ? Hover : Color.FromArgb(246, 249, 253);
                    Color labelColor = enabled ? (i == 0 ? Accent : Ink) : Muted;
                    using (GraphicsPath buttonPath = CreateRoundedPath(bounds, 9))
                    using (SolidBrush fillBrush = new SolidBrush(fillColor))
                    using (Pen borderPen = new Pen(borderColor, 1F))
                    using (SolidBrush labelBrush = new SolidBrush(labelColor))
                    {
                        graphics.FillPath(fillBrush, buttonPath);
                        graphics.DrawPath(borderPen, buttonPath);
                        graphics.DrawString(labels[i], actionFont, labelBrush, bounds, centered);
                    }
                }
            }
        }

        private void SetDshActionsExpanded(bool expanded)
        {
            if (dshActionsExpanded == expanded)
            {
                return;
            }

            dshActionsExpanded = expanded;
            hoveredDshAction = -1;
            if (expanded)
            {
                dshOperationText = string.Empty;
                dshStatus = new DshWebStatus(DshWebState.Unknown, 0, 3080, false, "正在检测…");
                dshStatusTimer.Start();
                RefreshDshStatus();
            }
            else if (dshStatusTimer != null)
            {
                dshStatusTimer.Stop();
            }
            Invalidate();
        }

        private void RefreshDshStatus()
        {
            if (!isExpanded || !dshActionsExpanded || dshBusy || IsDisposed ||
                Interlocked.CompareExchange(ref dshRefreshInProgress, 1, 0) != 0)
            {
                return;
            }

            ThreadPool.QueueUserWorkItem(delegate
            {
                DshWebHostResponse response = null;
                Exception failure = null;
                try
                {
                    response = DshWebHostClient.Request("STATUS");
                }
                catch (Exception exception)
                {
                    failure = exception;
                }
                finally
                {
                    Interlocked.Exchange(ref dshRefreshInProgress, 0);
                }

                if (IsDisposed || !IsHandleCreated)
                {
                    return;
                }

                try
                {
                    BeginInvoke((MethodInvoker)delegate
                    {
                        if (failure != null)
                        {
                            dshStatus = new DshWebStatus(DshWebState.Unknown, 0, 3080, false,
                                "检测失败：" + failure.Message);
                        }
                        else if (response != null)
                        {
                            dshStatus = response.Status;
                        }
                        Invalidate();
                    });
                }
                catch (InvalidOperationException)
                {
                }
            });
        }

        private int FindDshVisibleIndex()
        {
            for (int i = 0; i < visibleTools.Count; i++)
            {
                if (visibleTools[i].Id == "dsh")
                {
                    return i;
                }
            }
            return -1;
        }

        private Rectangle GetDshActionBounds(int actionIndex, int rowTop)
        {
            return new Rectangle(84 + actionIndex * 64, rowTop + 48, 59, 23);
        }

        private Rectangle GetDshStatusBounds(int rowTop)
        {
            return new Rectangle(84, rowTop + 25, HubWidth - 104, 17);
        }

        private int GetDshActionIndex(Point point)
        {
            if (!isExpanded || !dshActionsExpanded)
            {
                return -1;
            }

            int rowIndex = FindDshVisibleIndex();
            if (rowIndex < 0)
            {
                return -1;
            }

            int top = RowTop + rowIndex * RowHeight;
            for (int i = 0; i < 4; i++)
            {
                if (GetDshActionBounds(i, top).Contains(point))
                {
                    return i;
                }
            }
            return -1;
        }

        private bool IsDshActionEnabled(int actionIndex)
        {
            if (dshBusy || dshStatus == null)
            {
                return false;
            }

            if (actionIndex == 0)
            {
                return dshStatus.State == DshWebState.Stopped;
            }
            return dshStatus.State == DshWebState.Running;
        }

        private string GetDshStatusText()
        {
            if (dshStatus == null)
            {
                return "正在检测…";
            }

            if (dshStatus.State == DshWebState.Running)
            {
                string host = string.IsNullOrWhiteSpace(dshStatus.Host) ? "127.0.0.1" : dshStatus.Host;
                return "运行中 · " + host + ":" + dshStatus.Port.ToString();
            }
            if (dshStatus.State == DshWebState.Stopped)
            {
                return "已停止";
            }
            if (dshStatus.State == DshWebState.Multiple)
            {
                return "发现多个实例，已禁用控制";
            }
            return dshStatus.Message == "尚未检测" || dshStatus.Message == "正在检测…"
                ? "正在检测…"
                : dshStatus.Message;
        }

        private Color GetDshStatusColor()
        {
            if (dshStatus != null && dshStatus.State == DshWebState.Running)
            {
                return Color.FromArgb(31, 145, 96);
            }
            if (dshStatus != null && dshStatus.State == DshWebState.Multiple)
            {
                return ExitInk;
            }
            return Muted;
        }

        private void HandleDshAction(int actionIndex)
        {
            if (!IsDshActionEnabled(actionIndex))
            {
                return;
            }

            if (actionIndex == 0)
            {
                RunDshAction("START", "正在启动…");
            }
            else if (actionIndex == 1)
            {
                RunDshAction("PAUSE", "正在暂停…");
            }
            else if (actionIndex == 2)
            {
                ConfirmDshRestart("RESTART", "正在重启…");
            }
            else if (actionIndex == 3)
            {
                RunDshAction("OPEN", "正在打开…");
            }
        }

        private void ConfirmDshRestart(string command, string progressText)
        {
            DialogResult answer = MessageBox.Show(this,
                "重启 DSH Web 会中断当前浏览器连接和正在运行的 Agent 任务。要继续吗？",
                "重启 DSH Web",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Warning);
            if (answer == DialogResult.Yes)
            {
                RunDshAction(command, progressText);
            }
        }

        private void RunDshAction(string command, string progressText)
        {
            if (dshBusy)
            {
                return;
            }

            dshBusy = true;
            dshOperationText = progressText;
            Invalidate();
            ThreadPool.QueueUserWorkItem(delegate
            {
                DshWebHostResponse response = null;
                Exception failure = null;
                try
                {
                    response = DshWebHostClient.Request(command);
                }
                catch (Exception exception)
                {
                    failure = exception;
                }

                if (IsDisposed || !IsHandleCreated)
                {
                    return;
                }

                try
                {
                    BeginInvoke((MethodInvoker)delegate
                    {
                        dshBusy = false;
                        dshOperationText = string.Empty;
                        if (failure != null)
                        {
                            dshStatus = new DshWebStatus(DshWebState.Unknown, 0, 3080, false, failure.Message);
                            MessageBox.Show(this, failure.Message, "DSH Web", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        }
                        else if (response != null)
                        {
                            dshStatus = response.Status;
                            if (response.Result.NeedsRestart)
                            {
                                DialogResult answer = MessageBox.Show(this,
                                    "当前 DSH 由其他方式启动，ToolHub 无法读取它的启动认证链接。\n\n" +
                                    "重启一次以取得新链接吗？当前连接和正在运行的 Agent 任务可能中断。",
                                    "需要重启 DSH Web",
                                    MessageBoxButtons.YesNo,
                                    MessageBoxIcon.Warning);
                                if (answer == DialogResult.Yes)
                                {
                                    RunDshAction("RESTART_OPEN", "正在重启并打开…");
                                    return;
                                }
                            }
                            else if (!response.Result.Succeeded)
                            {
                                MessageBox.Show(this, response.Result.Message, "DSH Web",
                                    MessageBoxButtons.OK, MessageBoxIcon.Warning);
                            }
                        }
                        Invalidate();
                        RefreshDshStatus();
                    });
                }
                catch (InvalidOperationException)
                {
                }
            });
        }

        private void ExitApplication()
        {
            Close();
        }

        private void TrackLaunchedProcess(Process process)
        {
            if (process != null)
            {
                launchedProcesses.Add(process);
            }
        }

        private void ShutdownLaunchedTools()
        {
            if (hasShutdownLaunchedTools)
            {
                return;
            }

            hasShutdownLaunchedTools = true;
            foreach (Process process in launchedProcesses.ToArray())
            {
                try
                {
                    bool closeRequested = !process.HasExited && process.CloseMainWindow();
                    if (!process.HasExited)
                    {
                        closeRequested = NativeMethods.RequestProcessClose(process) || closeRequested;
                    }

                    if (closeRequested && !process.HasExited)
                    {
                        process.WaitForExit(2000);
                    }
                }
                catch (InvalidOperationException)
                {
                    // The child can exit between HasExited and CloseMainWindow.
                }
                catch (System.ComponentModel.Win32Exception)
                {
                    // A child without a closeable window is left untouched.
                }
                finally
                {
                    process.Dispose();
                }
            }

            launchedProcesses.Clear();
        }

        private void LaunchFirstVisibleTool()
        {
            if (visibleTools.Count > 0)
            {
                LaunchTool(visibleTools[0]);
            }
        }

        private void LaunchTool(ToolHubTool tool)
        {
            if (tool.Id == "dsh")
            {
                SetDshActionsExpanded(!dshActionsExpanded);
                return;
            }

            if (!tool.IsAvailable)
            {
                MessageBox.Show(this,
                    "未找到工具入口：\n" + tool.EntryPath,
                    "工具暂不可用",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
                return;
            }

            try
            {
                ToolHubLaunchRequest request = ToolHubLauncher.CreateRequest(tool, Environment.GetEnvironmentVariable("ComSpec"));
                bool showChildWindow = tool.LaunchKind == ToolHubLaunchKind.Executable;
                ProcessStartInfo startInfo = new ProcessStartInfo
                {
                    FileName = request.FileName,
                    Arguments = request.Arguments,
                    WorkingDirectory = request.WorkingDirectory,
                    UseShellExecute = request.UseShellExecute,
                    CreateNoWindow = !showChildWindow,
                    WindowStyle = showChildWindow ? ProcessWindowStyle.Normal : ProcessWindowStyle.Hidden
                };
                TrackLaunchedProcess(Process.Start(startInfo));
                SetExpanded(false);
            }
            catch (Exception exception)
            {
                MessageBox.Show(this,
                    "启动工具失败：\n" + exception.Message,
                    "工具中心",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
            }
        }

        private void PositionNearCursor()
        {
            Screen screen = Screen.FromPoint(Cursor.Position);
            Point cursor = Cursor.Position;
            int left = cursor.X + 18;
            int top = cursor.Y + 18;
            if (left + Width > screen.WorkingArea.Right)
            {
                left = screen.WorkingArea.Right - Width - 8;
            }
            if (top + Height > screen.WorkingArea.Bottom)
            {
                top = screen.WorkingArea.Bottom - Height - 8;
            }

            Location = new Point(Math.Max(screen.WorkingArea.Left + 8, left),
                Math.Max(screen.WorkingArea.Top + 8, top));
        }

        private GraphicsPath BuildWindowPath()
        {
            GraphicsPath path = new GraphicsPath();
            path.AddPath(CreateRoundedPath(new Rectangle(0, 0, HubWidth, layout.MainPanelHeight), 28), false);
            path.AddPath(CreateRoundedPath(new Rectangle(7, layout.SearchTop, SearchWidth, SearchHeight), 38), false);
            path.AddEllipse(new Rectangle(ActionLeft, layout.SearchTop, ActionSize, ActionSize));
            return path;
        }

        private GraphicsPath BuildCollapsedPath()
        {
            GraphicsPath path = new GraphicsPath();
            path.AddEllipse(new Rectangle(ActionLeft, layout.SearchTop, ActionSize, ActionSize));
            return path;
        }

        private static GraphicsPath CreateRoundedPath(Rectangle rectangle, int radius)
        {
            int diameter = radius * 2;
            GraphicsPath path = new GraphicsPath();
            path.AddArc(rectangle.X, rectangle.Y, diameter, diameter, 180, 90);
            path.AddArc(rectangle.Right - diameter, rectangle.Y, diameter, diameter, 270, 90);
            path.AddArc(rectangle.Right - diameter, rectangle.Bottom - diameter, diameter, diameter, 0, 90);
            path.AddArc(rectangle.X, rectangle.Bottom - diameter, diameter, diameter, 90, 90);
            path.CloseFigure();
            return path;
        }

        private static class NativeMethods
        {
            private const int EmSetCueBanner = 0x1501;

            [System.Runtime.InteropServices.DllImport("user32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
            private static extern IntPtr SendMessage(IntPtr windowHandle, int message, IntPtr wParam, string lParam);

            [System.Runtime.InteropServices.DllImport("user32.dll", SetLastError = true)]
            public static extern bool RegisterHotKey(IntPtr windowHandle, int id, uint modifiers, uint virtualKey);

            [System.Runtime.InteropServices.DllImport("user32.dll", SetLastError = true)]
            public static extern bool UnregisterHotKey(IntPtr windowHandle, int id);

            private const int WM_CLOSE = 0x0010;

            private delegate bool EnumWindowsCallback(IntPtr windowHandle, IntPtr lParam);

            [System.Runtime.InteropServices.DllImport("user32.dll")]
            private static extern bool EnumWindows(EnumWindowsCallback callback, IntPtr lParam);

            [System.Runtime.InteropServices.DllImport("user32.dll")]
            private static extern uint GetWindowThreadProcessId(IntPtr windowHandle, out uint processId);

            [System.Runtime.InteropServices.DllImport("user32.dll", SetLastError = true)]
            private static extern bool PostMessage(IntPtr windowHandle, uint message, IntPtr wParam, IntPtr lParam);

            public static bool RequestProcessClose(Process process)
            {
                if (process == null)
                {
                    return false;
                }

                uint targetProcessId = unchecked((uint)process.Id);
                bool closeRequested = false;
                EnumWindows(delegate(IntPtr windowHandle, IntPtr lParam)
                {
                    uint processId;
                    GetWindowThreadProcessId(windowHandle, out processId);
                    if (processId == targetProcessId)
                    {
                        closeRequested = PostMessage(windowHandle, WM_CLOSE, IntPtr.Zero, IntPtr.Zero) || closeRequested;
                    }

                    return true;
                }, IntPtr.Zero);
                return closeRequested;
            }

            public static void SetCueBanner(Control control, string text)
            {
                SendMessage(control.Handle, EmSetCueBanner, IntPtr.Zero, text);
            }
        }
    }

    internal static class NetworkTrafficSampler
    {
        private const byte HardwareInterfaceFlag = 0x01;
        private const int IfOperStatusUp = 1;

        [System.Runtime.InteropServices.StructLayout(
            System.Runtime.InteropServices.LayoutKind.Sequential,
            CharSet = System.Runtime.InteropServices.CharSet.Unicode,
            Pack = 8)]
        private struct MibIfRow2
        {
            public ulong InterfaceLuid;
            public uint InterfaceIndex;
            public Guid InterfaceGuid;
            [System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.ByValTStr, SizeConst = 257)]
            public string Alias;
            [System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.ByValTStr, SizeConst = 257)]
            public string Description;
            public uint PhysicalAddressLength;
            [System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.ByValArray, SizeConst = 32, ArraySubType = System.Runtime.InteropServices.UnmanagedType.U1)]
            public byte[] PhysicalAddress;
            [System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.ByValArray, SizeConst = 32, ArraySubType = System.Runtime.InteropServices.UnmanagedType.U1)]
            public byte[] PermanentPhysicalAddress;
            public uint Mtu;
            public uint Type;
            public uint TunnelType;
            public uint MediaType;
            public uint PhysicalMediumType;
            public uint AccessType;
            public uint DirectionType;
            public byte InterfaceAndOperStatusFlags;
            public uint OperStatus;
            public uint AdminStatus;
            public uint MediaConnectState;
            public Guid NetworkGuid;
            public uint ConnectionType;
            public ulong TransmitLinkSpeed;
            public ulong ReceiveLinkSpeed;
            public ulong InOctets;
            public ulong InUcastPkts;
            public ulong InNUcastPkts;
            public ulong InDiscards;
            public ulong InErrors;
            public ulong InUnknownProtos;
            public ulong InUcastOctets;
            public ulong InMulticastOctets;
            public ulong InBroadcastOctets;
            public ulong OutOctets;
            public ulong OutUcastPkts;
            public ulong OutNUcastPkts;
            public ulong OutDiscards;
            public ulong OutErrors;
            public ulong OutUcastOctets;
            public ulong OutMulticastOctets;
            public ulong OutBroadcastOctets;
            public ulong OutQLen;
        }

        [System.Runtime.InteropServices.StructLayout(
            System.Runtime.InteropServices.LayoutKind.Sequential,
            Pack = 8)]
        private struct MibIfTable2Header
        {
            public uint NumEntries;
            public MibIfRow2 FirstRow;
        }

        [System.Runtime.InteropServices.DllImport("iphlpapi.dll", ExactSpelling = true)]
        private static extern uint GetIfTable2(out IntPtr table);

        [System.Runtime.InteropServices.DllImport("iphlpapi.dll", ExactSpelling = true)]
        private static extern void FreeMibTable(IntPtr memory);

        public static bool TryGetPhysicalInterfaceCounters(out ulong receivedBytes, out ulong sentBytes)
        {
            receivedBytes = 0;
            sentBytes = 0;
            IntPtr table = IntPtr.Zero;
            try
            {
                if (GetIfTable2(out table) != 0 || table == IntPtr.Zero)
                {
                    return false;
                }

                int rowOffset = System.Runtime.InteropServices.Marshal.OffsetOf(
                    typeof(MibIfTable2Header), "FirstRow").ToInt32();
                int rowSize = System.Runtime.InteropServices.Marshal.SizeOf(typeof(MibIfRow2));
                int rowStride = (rowSize + 7) & ~7;
                int hardwareFlagsOffset = System.Runtime.InteropServices.Marshal.OffsetOf(
                    typeof(MibIfRow2), "InterfaceAndOperStatusFlags").ToInt32();
                int operStatusOffset = System.Runtime.InteropServices.Marshal.OffsetOf(
                    typeof(MibIfRow2), "OperStatus").ToInt32();
                int inOctetsOffset = System.Runtime.InteropServices.Marshal.OffsetOf(
                    typeof(MibIfRow2), "InOctets").ToInt32();
                int outOctetsOffset = System.Runtime.InteropServices.Marshal.OffsetOf(
                    typeof(MibIfRow2), "OutOctets").ToInt32();
                uint entryCount = unchecked((uint)System.Runtime.InteropServices.Marshal.ReadInt32(table));

                for (uint i = 0; i < entryCount; i++)
                {
                    int currentOffset = checked(rowOffset + (int)i * rowStride);
                    IntPtr row = IntPtr.Add(table, currentOffset);
                    byte flags = System.Runtime.InteropServices.Marshal.ReadByte(row, hardwareFlagsOffset);
                    int operStatus = System.Runtime.InteropServices.Marshal.ReadInt32(row, operStatusOffset);
                    if ((flags & HardwareInterfaceFlag) == 0 || operStatus != IfOperStatusUp)
                    {
                        continue;
                    }

                    ulong currentReceived = unchecked((ulong)System.Runtime.InteropServices.Marshal.ReadInt64(row, inOctetsOffset));
                    ulong currentSent = unchecked((ulong)System.Runtime.InteropServices.Marshal.ReadInt64(row, outOctetsOffset));
                    receivedBytes = SaturatingAdd(receivedBytes, currentReceived);
                    sentBytes = SaturatingAdd(sentBytes, currentSent);
                }

                return true;
            }
            catch (Exception)
            {
                receivedBytes = 0;
                sentBytes = 0;
                return false;
            }
            finally
            {
                if (table != IntPtr.Zero)
                {
                    FreeMibTable(table);
                }
            }
        }

        private static ulong SaturatingAdd(ulong current, ulong value)
        {
            return ulong.MaxValue - current < value ? ulong.MaxValue : current + value;
        }
    }

    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            bool createdNew;
            using (Mutex mutex = new Mutex(true, "Local\\WindowsToolHub.SingleInstance", out createdNew))
            {
                if (!createdNew)
                {
                    return;
                }

                EnablePerMonitorDpi();
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                string windowRoot = ToolHubPathResolver.FindWindowRoot(AppDomain.CurrentDomain.BaseDirectory);
                Application.Run(new ToolHubForm(ToolHubCatalog.GetTools(windowRoot)));
            }
        }

        private static void EnablePerMonitorDpi()
        {
            try
            {
                if (NativeMethods.SetProcessDpiAwareness(2) != 0)
                {
                    NativeMethods.SetProcessDpiAware();
                }
            }
            catch (DllNotFoundException)
            {
                NativeMethods.SetProcessDpiAware();
            }
            catch (EntryPointNotFoundException)
            {
                NativeMethods.SetProcessDpiAware();
            }
        }

        private static class NativeMethods
        {
            [System.Runtime.InteropServices.DllImport("shcore.dll")]
            public static extern int SetProcessDpiAwareness(int awareness);

            [System.Runtime.InteropServices.DllImport("user32.dll")]
            public static extern bool SetProcessDpiAware();
        }
    }
}
