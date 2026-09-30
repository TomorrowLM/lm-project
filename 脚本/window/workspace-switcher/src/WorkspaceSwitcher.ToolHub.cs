using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using WorkspaceSwitcher.Core;

namespace WorkspaceSwitcher.App
{
    internal static class ToolHubPathResolver
    {
        public static string FindWindowRoot(string applicationDirectory)
        {
            string current = Path.GetFullPath(applicationDirectory ?? String.Empty);
            for (int depth = 0; depth < 6 && !String.IsNullOrEmpty(current); depth++)
            {
                if (Directory.Exists(Path.Combine(current, "workspace-switcher"))
                    && Directory.Exists(Path.Combine(current, "Wallpaper-GUI"))
                    && Directory.Exists(Path.Combine(current, "desktop-black-screen-repair")))
                {
                    return current;
                }

                DirectoryInfo parent = Directory.GetParent(current.TrimEnd(Path.DirectorySeparatorChar));
                current = parent == null ? String.Empty : parent.FullName;
            }

            return Path.GetFullPath(Path.Combine(applicationDirectory ?? String.Empty, "..", ".."));
        }
    }

    internal sealed class ToolHubForm : Form
    {
        private const int HubWidth = 360;
        private const int HubHeight = 450;
        private const int MainPanelHeight = 280;
        private const int SearchTop = 306;
        private const int SearchWidth = 250;
        private const int SearchHeight = 72;
        private const int ActionLeft = 274;
        private const int ActionSize = 82;
        private const int RowTop = 18;
        private const int RowHeight = 76;

        private static readonly Color TransparentColor = Color.Magenta;
        private static readonly Color PanelColor = Color.FromArgb(249, 250, 252);
        private static readonly Color InkColor = Color.FromArgb(17, 24, 45);
        private static readonly Color MutedColor = Color.FromArgb(143, 151, 166);
        private static readonly Color HoverColor = Color.FromArgb(237, 243, 255);
        private static readonly Color AccentColor = Color.FromArgb(43, 108, 255);

        private readonly WorkspaceForm workspacePanel;
        private readonly IList<ToolHubItem> allTools;
        private IList<ToolHubItem> visibleTools;
        private readonly TextBox searchBox;
        private readonly Font labelFont = new Font("Microsoft YaHei UI", 17.5f, FontStyle.Regular, GraphicsUnit.Pixel);
        private readonly Font emptyFont = new Font("Microsoft YaHei UI", 15f, FontStyle.Regular, GraphicsUnit.Pixel);
        private int hoveredIndex = -1;

        public ToolHubForm(WorkspaceForm workspacePanel, IList<ToolHubItem> tools)
        {
            this.workspacePanel = workspacePanel;
            allTools = tools ?? new List<ToolHubItem>();
            visibleTools = ToolHubCatalog.Filter(allTools, String.Empty);

            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            TopMost = true;
            KeyPreview = true;
            ClientSize = new Size(HubWidth, HubHeight);
            BackColor = TransparentColor;
            TransparencyKey = TransparentColor;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);
            Region = CreateHubRegion();

            searchBox = new TextBox
            {
                BorderStyle = BorderStyle.None,
                BackColor = PanelColor,
                ForeColor = InkColor,
                Font = new Font("Microsoft YaHei UI", 16f, FontStyle.Regular, GraphicsUnit.Pixel),
                Location = new Point(38, SearchTop + 17),
                Size = new Size(SearchWidth - 56, 36),
                TabStop = true
            };
            searchBox.TextChanged += delegate
            {
                visibleTools = ToolHubCatalog.Filter(allTools, searchBox.Text);
                hoveredIndex = -1;
                Invalidate();
            };
            searchBox.KeyDown += delegate(object sender, KeyEventArgs args)
            {
                if (args.KeyCode == Keys.Enter)
                {
                    LaunchFirstVisibleTool();
                    args.SuppressKeyPress = true;
                }
            };
            Controls.Add(searchBox);
            SetSearchCueText(searchBox, "搜索工具");
        }

        protected override bool ShowWithoutActivation
        {
            get { return false; }
        }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams createParams = base.CreateParams;
                createParams.ExStyle |= 0x00000080;
                return createParams;
            }
        }

        protected override void OnLoad(EventArgs e)
        {
            base.OnLoad(e);
            PositionNearCursor();
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            searchBox.Focus();
            searchBox.SelectAll();
        }

        protected override void OnResize(EventArgs e)
        {
            base.OnResize(e);
            Region = CreateHubRegion();
        }

        protected override void OnPaintBackground(PaintEventArgs e)
        {
            e.Graphics.Clear(TransparentColor);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            Graphics graphics = e.Graphics;
            graphics.SmoothingMode = SmoothingMode.AntiAlias;
            graphics.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            DrawRoundedFill(graphics, new Rectangle(0, 0, HubWidth, MainPanelHeight), 34, PanelColor);
            DrawRoundedFill(graphics, new Rectangle(0, SearchTop, SearchWidth, SearchHeight), 36, PanelColor);
            DrawActionButton(graphics, new Rectangle(ActionLeft, SearchTop - 1, ActionSize, ActionSize));

            if (visibleTools.Count == 0)
            {
                TextRenderer.DrawText(
                    graphics,
                    "没有匹配工具",
                    emptyFont,
                    new Rectangle(34, 120, HubWidth - 68, 40),
                    MutedColor,
                    TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
                return;
            }

            for (int index = 0; index < visibleTools.Count; index++)
            {
                ToolHubItem tool = visibleTools[index];
                Rectangle row = GetRowBounds(index);
                if (index == hoveredIndex)
                {
                    DrawRoundedFill(graphics, new Rectangle(row.Left + 8, row.Top + 5, row.Width - 16, row.Height - 10), 18, HoverColor);
                }

                Color color = tool.IsAvailable ? InkColor : MutedColor;
                DrawToolIcon(graphics, tool.Id, new Rectangle(30, row.Top + 17, 38, 38), color);
                TextRenderer.DrawText(
                    graphics,
                    tool.Label,
                    labelFont,
                    new Rectangle(82, row.Top, 246, row.Height),
                    color,
                    TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPadding);
            }
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            base.OnMouseMove(e);
            int nextHoveredIndex = -1;
            if (e.Y >= RowTop && e.Y < MainPanelHeight && e.X >= 12 && e.X < HubWidth - 12)
            {
                int candidate = (e.Y - RowTop) / RowHeight;
                if (candidate >= 0 && candidate < visibleTools.Count && GetRowBounds(candidate).Contains(e.Location))
                {
                    nextHoveredIndex = candidate;
                }
            }

            if (nextHoveredIndex != hoveredIndex)
            {
                hoveredIndex = nextHoveredIndex;
                Cursor = hoveredIndex >= 0 || GetActionBounds().Contains(e.Location) ? Cursors.Hand : Cursors.Default;
                Invalidate();
            }
        }

        protected override void OnMouseLeave(EventArgs e)
        {
            base.OnMouseLeave(e);
            hoveredIndex = -1;
            Cursor = Cursors.Default;
            Invalidate();
        }

        protected override void OnMouseUp(MouseEventArgs e)
        {
            base.OnMouseUp(e);
            if (e.Button != MouseButtons.Left)
            {
                return;
            }

            if (GetActionBounds().Contains(e.Location))
            {
                LaunchFirstVisibleTool();
                return;
            }

            if (hoveredIndex >= 0 && hoveredIndex < visibleTools.Count)
            {
                LaunchTool(visibleTools[hoveredIndex]);
            }
        }

        protected override bool ProcessCmdKey(ref Message message, Keys keyData)
        {
            if (keyData == Keys.Escape)
            {
                Hide();
                return true;
            }

            return base.ProcessCmdKey(ref message, keyData);
        }

        private void LaunchFirstVisibleTool()
        {
            if (visibleTools.Count > 0)
            {
                LaunchTool(visibleTools[0]);
            }
        }

        private void LaunchTool(ToolHubItem tool)
        {
            if (!tool.IsAvailable)
            {
                MessageBox.Show(this, "找不到工具入口：\n" + tool.EntryPath, "工具不可用", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            try
            {
                if (tool.LaunchKind == ToolHubLaunchKind.WorkspacePanel)
                {
                    Program.ShowWorkspacePanel();
                }
                else
                {
                    string commandShell = Environment.GetEnvironmentVariable("ComSpec");
                    ProcessStartInfo startInfo = new ProcessStartInfo
                    {
                        FileName = String.IsNullOrEmpty(commandShell) ? "cmd.exe" : commandShell,
                        Arguments = "/c call \"" + tool.EntryPath + "\"",
                        WorkingDirectory = tool.WorkingDirectory,
                        UseShellExecute = false,
                        CreateNoWindow = false
                    };
                    Process.Start(startInfo);
                }

                Hide();
            }
            catch (Exception exception)
            {
                MessageBox.Show(this, exception.Message, "启动工具失败", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void PositionNearCursor()
        {
            Point cursor = Cursor.Position;
            Screen screen = Screen.FromPoint(cursor);
            int left = cursor.X - Width / 2;
            int top = cursor.Y - 40;
            left = Math.Max(screen.WorkingArea.Left + 12, Math.Min(left, screen.WorkingArea.Right - Width - 12));
            top = Math.Max(screen.WorkingArea.Top + 12, Math.Min(top, screen.WorkingArea.Bottom - Height - 12));
            Location = new Point(left, top);
        }

        private Rectangle GetRowBounds(int index)
        {
            return new Rectangle(12, RowTop + index * RowHeight, HubWidth - 24, RowHeight);
        }

        private Rectangle GetActionBounds()
        {
            return new Rectangle(ActionLeft, SearchTop - 1, ActionSize, ActionSize);
        }

        private Region CreateHubRegion()
        {
            using (GraphicsPath path = new GraphicsPath())
            {
                path.AddPath(CreateRoundedPath(new Rectangle(0, 0, HubWidth, MainPanelHeight), 34), false);
                path.AddPath(CreateRoundedPath(new Rectangle(0, SearchTop, SearchWidth, SearchHeight), 36), false);
                path.AddEllipse(GetActionBounds());
                return new Region(path);
            }
        }

        private static GraphicsPath CreateRoundedPath(Rectangle rectangle, int radius)
        {
            int diameter = Math.Min(radius * 2, Math.Min(rectangle.Width, rectangle.Height));
            GraphicsPath path = new GraphicsPath();
            path.AddArc(rectangle.Left, rectangle.Top, diameter, diameter, 180, 90);
            path.AddArc(rectangle.Right - diameter, rectangle.Top, diameter, diameter, 270, 90);
            path.AddArc(rectangle.Right - diameter, rectangle.Bottom - diameter, diameter, diameter, 0, 90);
            path.AddArc(rectangle.Left, rectangle.Bottom - diameter, diameter, diameter, 90, 90);
            path.CloseFigure();
            return path;
        }

        private static void DrawRoundedFill(Graphics graphics, Rectangle rectangle, int radius, Color color)
        {
            using (GraphicsPath path = CreateRoundedPath(rectangle, radius))
            using (SolidBrush brush = new SolidBrush(color))
            {
                graphics.FillPath(brush, path);
            }
        }

        private static void DrawActionButton(Graphics graphics, Rectangle bounds)
        {
            using (SolidBrush outerBrush = new SolidBrush(Color.White))
            using (SolidBrush blueBrush = new SolidBrush(AccentColor))
            {
                graphics.FillEllipse(outerBrush, bounds);
                Rectangle inner = new Rectangle(bounds.Left + 12, bounds.Top + 12, bounds.Width - 24, bounds.Height - 24);
                graphics.FillEllipse(blueBrush, inner);
            }

            using (Pen highlight = new Pen(Color.FromArgb(230, 243, 249, 255), 5f))
            {
                Rectangle arc = new Rectangle(bounds.Left + 29, bounds.Top + 27, 20, 20);
                graphics.DrawArc(highlight, arc, 25, 285);
            }
        }

        private static void DrawToolIcon(Graphics graphics, string toolId, Rectangle bounds, Color color)
        {
            using (Pen pen = new Pen(color, 2.1f))
            {
                pen.StartCap = LineCap.Round;
                pen.EndCap = LineCap.Round;
                pen.LineJoin = LineJoin.Round;

                if (toolId == "workspace")
                {
                    Point[] shape =
                    {
                        new Point(bounds.Left + 11, bounds.Top + 2),
                        new Point(bounds.Left + 25, bounds.Top + 2),
                        new Point(bounds.Right - 2, bounds.Top + 13),
                        new Point(bounds.Right - 9, bounds.Top + 25),
                        new Point(bounds.Left + 16, bounds.Bottom - 2),
                        new Point(bounds.Left + 4, bounds.Top + 18),
                        new Point(bounds.Left + 11, bounds.Top + 2)
                    };
                    graphics.DrawLines(pen, shape);
                    graphics.DrawLine(pen, bounds.Left + 11, bounds.Top + 2, bounds.Left + 18, bounds.Top + 14);
                    graphics.DrawLine(pen, bounds.Left + 4, bounds.Top + 18, bounds.Left + 16, bounds.Top + 18);
                }
                else if (toolId == "wallpaper")
                {
                    Rectangle monitor = new Rectangle(bounds.Left + 3, bounds.Top + 4, bounds.Width - 6, bounds.Height - 12);
                    using (GraphicsPath monitorPath = CreateRoundedPath(monitor, 5))
                    {
                        graphics.DrawPath(pen, monitorPath);
                    }
                    graphics.DrawLine(pen, bounds.Left + 14, bounds.Bottom - 5, bounds.Left + 24, bounds.Bottom - 5);
                    graphics.DrawLine(pen, bounds.Left + 19, bounds.Bottom - 10, bounds.Left + 19, bounds.Bottom - 5);
                    graphics.DrawArc(pen, bounds.Left + 10, bounds.Top + 13, 17, 14, 205, 115);
                }
                else
                {
                    graphics.DrawArc(pen, bounds.Left + 8, bounds.Top + 5, 20, 28, 205, 130);
                    graphics.DrawArc(pen, bounds.Left + 10, bounds.Top + 10, 16, 18, 205, 130);
                    graphics.DrawLine(pen, bounds.Left + 19, bounds.Top + 33, bounds.Left + 19, bounds.Bottom - 1);
                    graphics.DrawLine(pen, bounds.Left + 13, bounds.Bottom - 2, bounds.Left + 25, bounds.Bottom - 2);
                    graphics.DrawLine(pen, bounds.Left + 5, bounds.Top + 17, bounds.Left + 5, bounds.Top + 26);
                    graphics.DrawLine(pen, bounds.Right - 5, bounds.Top + 17, bounds.Right - 5, bounds.Top + 26);
                }
            }
        }

        private static void SetSearchCueText(TextBox textBox, string text)
        {
            SendMessage(textBox.Handle, 0x1501, IntPtr.Zero, text);
        }

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr SendMessage(IntPtr windowHandle, int message, IntPtr wParam, string lParam);
    }
}
