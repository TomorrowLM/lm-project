using System.Drawing;

namespace WorkspaceSwitcher.App
{
    internal static class WallpaperGlassSurface
    {
        internal static bool TryRender(
            Graphics graphics,
            Rectangle bounds,
            Rectangle panelScreenBounds,
            Rectangle screenBounds,
            int radius)
        {
            // This path reads the verified Windows wallpaper file and renders
            // a cached low-frequency blur at the panel's current screen crop.
            // It never captures the screen or changes desktop state.
            return LiveWallpaperBackdrop.TryRender(
                graphics,
                bounds,
                panelScreenBounds,
                screenBounds,
                radius);
        }
    }
}
