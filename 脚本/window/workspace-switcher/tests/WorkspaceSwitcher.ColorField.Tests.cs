using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Reflection;

internal static class ColorFieldTests
{
    private static MethodInfo render;
    private static MethodInfo cropRender;
    private static void Check(bool value, string message)
    {
        if (!value) throw new Exception(message);
        Console.WriteLine("PASS " + message);
    }
    private static Bitmap Field(Bitmap image)
    {
        return (Bitmap)render.Invoke(null, new object[] { image, 32, 3 });
    }
    private static Bitmap Crop(Bitmap image, Rectangle crop)
    {
        return (Bitmap)cropRender.Invoke(null, new object[] { image, crop, new Size(320, 400) });
    }
    public static int Main(string[] args)
    {
        try
        {
            Assembly app = Assembly.LoadFrom(args[0]);
            Type type = app.GetType("WorkspaceSwitcher.App.LiveWallpaperBackdrop", true);
            render = type.GetMethod("CreateLowFrequencyBlur", BindingFlags.NonPublic | BindingFlags.Static);
            cropRender = type.GetMethod("CreateBlurredCrop", BindingFlags.NonPublic | BindingFlags.Static);
            Check(render != null, "Low-frequency blur renderer exists");
            Check(cropRender != null, "Blurred crop renderer exists");
            FieldInfo textureAlpha = type.GetField("GlassTextureAlpha", BindingFlags.NonPublic | BindingFlags.Static);
            FieldInfo tintArgb = type.GetField("GlassTintArgb", BindingFlags.NonPublic | BindingFlags.Static);
            FieldInfo blurRadius = type.GetField("WallpaperBlurRadius", BindingFlags.NonPublic | BindingFlags.Static);
            Check(textureAlpha != null && (int)textureAlpha.GetValue(null) == 174,
                "Glass keeps the wallpaper texture translucent");
            Check(tintArgb != null && (int)tintArgb.GetValue(null) == unchecked((int)0x493B243F),
                "Glass uses the dark purple-brown reference tint");
            Check(blurRadius != null && (int)blurRadius.GetValue(null) == 48,
                "Glass uses a strong enough blur radius for the reference material");
            Type shellWallpaper = app.GetType("WorkspaceSwitcher.App.DesktopShellWallpaper", true);
            MethodInfo captureShellWallpaper = shellWallpaper.GetMethod("Capture", BindingFlags.NonPublic | BindingFlags.Static);
            Check(captureShellWallpaper != null, "Desktop shell wallpaper capture exists");
            using (Bitmap input = new Bitmap(256, 256))
            {
                using (Graphics g = Graphics.FromImage(input)) g.Clear(Color.FromArgb(20, 70, 170));
                using (Bitmap output = Field(input))
                {
                    Color c = output.GetPixel(150, 200);
                    Check(Math.Abs(c.R - 20) <= 2 && Math.Abs(c.G - 70) <= 2 && Math.Abs(c.B - 170) <= 2,
                        "Uniform wallpaper preserves its color");
                    Check(output.GetPixel(0, 0).A == 255 && output.GetPixel(255, 255).A == 255,
                        "Edges are opaque without black or transparent seams");
                }
                for (int y = 0; y < 256; y++)
                for (int x = 0; x < 256; x++)
                    input.SetPixel(x, y, ((x / 16 + y / 16) % 2 == 0) ? Color.Black : Color.White);
                using (Bitmap output = Field(input))
                {
                    int low = 255, high = 0;
                    for (int y = 0; y < output.Height; y += 8)
                    for (int x = 0; x < output.Width; x += 8)
                    {
                        int value = output.GetPixel(x, y).R;
                        low = Math.Min(low, value); high = Math.Max(high, value);
                    }
                    Check(high - low < 40, "High contrast wallpaper texture is removed");
                }
                using (Graphics g = Graphics.FromImage(input))
                {
                    g.Clear(Color.Blue);
                    g.FillRectangle(Brushes.Orange, 128, 0, 128, 256);
                }
                using (Bitmap left = Crop(input, new Rectangle(0, 0, 128, 256)))
                using (Bitmap right = Crop(input, new Rectangle(128, 0, 128, 256)))
                {
                    Check(left.GetPixel(150, 200).B > 240 && right.GetPixel(150, 200).R > 240,
                        "Different panel locations sample different colors");
                }
                using (Bitmap whole = Crop(input, new Rectangle(0, 0, 256, 256)))
                {
                    Check(whole.GetPixel(0, 200).B > whole.GetPixel(319, 200).B + 50,
                        "Broad color differences survive smoothing");
                    int maxStep = 0;
                    for (int x = 1; x < 320; x++)
                        maxStep = Math.Max(maxStep, Math.Abs(whole.GetPixel(x, 200).B - whole.GetPixel(x - 1, 200).B));
                    Check(maxStep < 8, "Color transitions have no hard edges");
                }
            }

            MethodInfo tryRender = type.GetMethod("TryRender", BindingFlags.NonPublic | BindingFlags.Static);
            MethodInfo surfaceCrop = type.GetMethod("GetSurfaceCrop", BindingFlags.NonPublic | BindingFlags.Static);
            Check(surfaceCrop != null, "Wallpaper surface crop calculation exists");
            Rectangle cropForRightPanel = (Rectangle)surfaceCrop.Invoke(null, new object[] {
                new Rectangle(1200, 100, 400, 800),
                new Rectangle(0, 0, 1920, 1080),
                new Size(1024, 576)
            });
            Check(cropForRightPanel.X > 500 && cropForRightPanel.Y > 40 && cropForRightPanel.Width < 250,
                "Wallpaper crop follows the panel's screen position");
            MethodInfo setLiveFrame = type.GetMethod("SetLiveFrame", BindingFlags.NonPublic | BindingFlags.Static);
            Check(setLiveFrame != null, "Live desktop frame setter exists");
            using (Bitmap frame = new Bitmap(520, 650))
            {
                using (Graphics g = Graphics.FromImage(frame))
                {
                    g.Clear(Color.FromArgb(230, 30, 50));
                    g.FillRectangle(Brushes.DeepSkyBlue, 260, 0, 260, 650);
                }
                setLiveFrame.Invoke(null, new object[] { frame, new Rectangle(0, 0, 520, 650) });
            }
            using (Bitmap livePreview = new Bitmap(520, 650))
            using (Graphics liveGraphics = Graphics.FromImage(livePreview))
            {
                bool liveOk = (bool)tryRender.Invoke(null, new object[] {
                    liveGraphics,
                    new Rectangle(0, 0, 520, 650),
                    new Rectangle(0, 0, 520, 650),
                    new Rectangle(0, 0, 520, 650),
                    28 });
                Check(liveOk, "Actual captured desktop frame renders successfully");
                Color liveColor = livePreview.GetPixel(130, 325);
                Check(liveColor.R > liveColor.B + 60, "Current desktop sample is preferred over a stale wallpaper file");
                Check(livePreview.GetPixel(130, 325).A < 255, "Glass texture remains translucent");
                livePreview.Save(args[1], ImageFormat.Png);
            }
            type.GetMethod("Dispose", BindingFlags.NonPublic | BindingFlags.Static).Invoke(null, null);

            // The production path must not replace an unreadable dynamic
            // wallpaper cache entry with a fixed img0.jpg fallback.
            type.GetMethod("Dispose", BindingFlags.NonPublic | BindingFlags.Static).Invoke(null, null);
            using (Bitmap preview = new Bitmap(520, 650))
            using (Graphics g = Graphics.FromImage(preview))
            {
                bool ok = (bool)tryRender.Invoke(null, new object[] {
                    g,
                    new Rectangle(0, 0, 520, 650),
                    new Rectangle(0, 0, 520, 650),
                    new Rectangle(0, 0, 520, 650),
                    28 });
                Check(!ok, "Unreadable wallpaper does not fall back to a fixed image");
            }

            FieldInfo sourceImageField = type.GetField("sourceImage", BindingFlags.NonPublic | BindingFlags.Static);
            MethodInfo ensureSurface = type.GetMethod("EnsureWallpaperSurface", BindingFlags.NonPublic | BindingFlags.Static);
            Check(sourceImageField != null && ensureSurface != null, "Wallpaper surface can be built from a verified source");
            sourceImageField.SetValue(null, new Bitmap(520, 650));
            bool surfaceCreated = (bool)ensureSurface.Invoke(null, new object[] { new Rectangle(0, 0, 520, 650) });
            Check(surfaceCreated, "Wallpaper blur surface is created from a verified source");
            FieldInfo surfaceField = type.GetField("blurredWallpaperSurface", BindingFlags.NonPublic | BindingFlags.Static);
            Check(surfaceField != null, "Wallpaper blur surface cache exists");
            object firstSurface = surfaceField.GetValue(null);
            Check(firstSurface != null, "Wallpaper blur surface cache contains the source texture");
            using (Bitmap movedPreview = new Bitmap(520, 650))
            using (Graphics movedGraphics = Graphics.FromImage(movedPreview))
            {
                bool movedOk = (bool)ensureSurface.Invoke(null, new object[] { new Rectangle(0, 0, 520, 650) });
                Check(movedOk, "Moved wallpaper surface remains renderable");
            }
            Check(Object.ReferenceEquals(firstSurface, surfaceField.GetValue(null)),
                "Moving the panel reuses the cached wallpaper blur surface");
            type.GetMethod("Dispose", BindingFlags.NonPublic | BindingFlags.Static).Invoke(null, null);
            Console.WriteLine("Preview: " + Path.GetFullPath(args[1]));
            return 0;
        }
        catch (Exception e) { Console.Error.WriteLine(e); return 1; }
    }
}
