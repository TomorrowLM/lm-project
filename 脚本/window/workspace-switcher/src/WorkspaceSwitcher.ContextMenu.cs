using System;
using System.Drawing;
using System.Windows.Forms;

namespace WorkspaceSwitcher.App
{
    internal static class DisplayMenuPlacementPolicy
    {
        public static Point GetLocation(Point pointer, Size menuSize, Rectangle workingArea, int offset)
        {
            int x = pointer.X + offset;
            int y = pointer.Y + offset;
            if (x + menuSize.Width > workingArea.Right)
            {
                x = pointer.X - menuSize.Width - offset;
            }
            if (y + menuSize.Height > workingArea.Bottom)
            {
                y = pointer.Y - menuSize.Height - offset;
            }

            x = Math.Max(workingArea.Left, Math.Min(x, workingArea.Right - menuSize.Width));
            y = Math.Max(workingArea.Top, Math.Min(y, workingArea.Bottom - menuSize.Height));
            return new Point(x, y);
        }

        public static Point GetLocation(Point pointer, Size menuSize, Rectangle targetBounds, Rectangle workingArea, int offset)
        {
            Point[] candidates = new Point[]
            {
                new Point(targetBounds.Right + offset, targetBounds.Top),
                new Point(targetBounds.Left - menuSize.Width - offset, targetBounds.Top),
                new Point(targetBounds.Left, targetBounds.Bottom + offset),
                new Point(targetBounds.Left, targetBounds.Top - menuSize.Height - offset)
            };
            foreach (Point candidate in candidates)
            {
                Rectangle candidateBounds = new Rectangle(candidate, menuSize);
                if (workingArea.Contains(candidateBounds) && !candidateBounds.IntersectsWith(targetBounds))
                {
                    return candidate;
                }
            }

            return GetLocation(pointer, menuSize, workingArea, offset);
        }
    }

    internal sealed class GlassContextMenuStrip : ContextMenuStrip
    {
        internal GlassContextMenuStrip()
        {
            AutoSize = false;
            MinimumSize = new Size(220, 0);
            BackColor = Color.FromArgb(238, 248, 251, 255);
            ForeColor = Color.FromArgb(WorkspaceVisualMetrics.TextArgb);
            Font = new Font(WorkspaceVisualMetrics.FontFamilyName, 16f, FontStyle.Regular, GraphicsUnit.Pixel);
            Padding = new Padding(8);
            ShowImageMargin = false;
            ShowCheckMargin = false;
            Renderer = new GlassContextMenuRenderer();
        }

        protected override void OnOpened(EventArgs e)
        {
            base.OnOpened(e);
            UpdateRegion();
        }

        protected override void OnSizeChanged(EventArgs e)
        {
            base.OnSizeChanged(e);
            UpdateRegion();
        }

        private void UpdateRegion()
        {
            if (Width < 2 || Height < 2)
            {
                return;
            }

            using (System.Drawing.Drawing2D.GraphicsPath path = WorkspaceVisuals.CreateRoundedPath(
                new Rectangle(0, 0, Width, Height), 14))
            {
                Region previous = Region;
                Region = new Region(path);
                if (previous != null)
                {
                    previous.Dispose();
                }
            }
        }
    }

    internal sealed class GlassContextMenuRenderer : ToolStripProfessionalRenderer
    {
        internal GlassContextMenuRenderer()
            : base(new ProfessionalColorTable())
        {
            RoundedEdges = false;
        }

        protected override void OnRenderToolStripBackground(ToolStripRenderEventArgs e)
        {
            using (Brush fill = new SolidBrush(Color.FromArgb(238, 248, 251, 255)))
            {
                e.Graphics.FillRectangle(fill, e.AffectedBounds);
            }
        }

        protected override void OnRenderToolStripBorder(ToolStripRenderEventArgs e)
        {
            using (Pen border = new Pen(Color.FromArgb(190, 255, 255, 255), 1f))
            {
                e.Graphics.DrawRectangle(border, 0, 0, e.ToolStrip.Width - 1, e.ToolStrip.Height - 1);
            }
        }

        protected override void OnRenderMenuItemBackground(ToolStripItemRenderEventArgs e)
        {
            if (!e.Item.Selected || !e.Item.Enabled)
            {
                return;
            }

            Rectangle bounds = new Rectangle(3, 2, e.Item.Width - 6, e.Item.Height - 4);
            using (System.Drawing.Drawing2D.GraphicsPath path = WorkspaceVisuals.CreateRoundedPath(bounds, 9))
            using (Brush fill = new SolidBrush(Color.FromArgb(45, 42, 103, 226)))
            using (Pen border = new Pen(Color.FromArgb(100, 42, 103, 226), 1f))
            {
                e.Graphics.FillPath(fill, path);
                e.Graphics.DrawPath(border, path);
            }
        }

        protected override void OnRenderItemText(ToolStripItemTextRenderEventArgs e)
        {
            e.TextColor = e.Item.Enabled
                ? Color.FromArgb(WorkspaceVisualMetrics.TextArgb)
                : Color.FromArgb(WorkspaceVisualMetrics.MutedTextArgb);
            base.OnRenderItemText(e);
        }
    }
}
