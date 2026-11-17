using System.Drawing;
using System.Drawing.Drawing2D;

namespace ToolHub.App
{
    internal static class ToolHubIcon
    {
        private static readonly Color Surface = Color.FromArgb(249, 250, 252);
        private static readonly Color Accent = Color.FromArgb(43, 108, 255);

        internal static void Draw(Graphics graphics, Rectangle bounds)
        {
            if (graphics == null || bounds.Width < 2 || bounds.Height < 2)
            {
                return;
            }

            float size = System.Math.Min(bounds.Width, bounds.Height);
            float left = bounds.Left + (bounds.Width - size) / 2F;
            float top = bounds.Top + (bounds.Height - size) / 2F;
            float scale = size / 82F;

            using (SolidBrush outerBrush = new SolidBrush(Surface))
            using (SolidBrush blueBrush = new SolidBrush(Accent))
            using (Pen whitePen = new Pen(Color.White, 5F * scale))
            {
                graphics.SmoothingMode = SmoothingMode.AntiAlias;
                graphics.FillEllipse(outerBrush, left, top, size, size);
                graphics.FillEllipse(
                    blueBrush,
                    left + 12F * scale,
                    top + 12F * scale,
                    size - 24F * scale,
                    size - 24F * scale);
                graphics.DrawArc(
                    whitePen,
                    left + 29F * scale,
                    top + 28F * scale,
                    28F * scale,
                    24F * scale,
                    35F,
                    285F);
                graphics.FillEllipse(
                    Brushes.White,
                    left + 48F * scale,
                    top + 42F * scale,
                    8F * scale,
                    8F * scale);
            }
        }
    }
}
