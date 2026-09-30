using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace WorkspaceSwitcher.App
{
internal static class LiveWallpaperBackdrop
{
    private const int GlassTextureAlpha = 174;
    private const int GlassTintArgb = unchecked((int)0x493B243F);
    private const int WallpaperBlurRadius = 48;
    private const int WallpaperBlurPasses = 3;
        private const uint SpiGetDesktopWallpaper = 0x0073;
        private static string sourcePath = String.Empty;
        private static DateTime sourceWriteTimeUtc;
        private static long sourceLength;
        private static Bitmap sourceImage;
        private static Bitmap liveSourceImage;
        private static Rectangle liveSourceBounds;
        private static long liveFrameVersion;
        private static Bitmap renderedImage;
        private static Size renderedSize;
        private static Rectangle renderedScreenBounds;
        private static long renderedLiveFrameVersion;
        private static DateTime shellCaptureUtc;
        private static bool? lastShellCaptureResult;
        private static Bitmap blurredWallpaperSurface;
        private static Size blurredWallpaperSurfaceSize;
        private static Rectangle blurredWallpaperVirtualScreen;

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern uint SystemParametersInfo(uint action, uint parameter, StringBuilder value, uint flags);

        internal static bool TryRender(
            Graphics graphics,
            Rectangle bounds,
            Rectangle panelScreenBounds,
            Rectangle screenBounds,
            int radius)
        {
            if (graphics == null
                || bounds.Width < 2
                || bounds.Height < 2
                || panelScreenBounds.Width < 2
                || panelScreenBounds.Height < 2
                || screenBounds.Width < 2
                || screenBounds.Height < 2
                || !EnsureImages(bounds.Size, panelScreenBounds, screenBounds))
            {
                return false;
            }

            using (GraphicsPath path = WorkspaceVisuals.CreateRoundedPath(bounds, radius))
            {
                GraphicsState state = graphics.Save();
                graphics.SetClip(path, CombineMode.Intersect);
                if (blurredWallpaperSurface != null && !blurredWallpaperVirtualScreen.IsEmpty)
                {
                    Rectangle sourceCrop = GetSurfaceCrop(
                        panelScreenBounds,
                        blurredWallpaperVirtualScreen,
                        blurredWallpaperSurface.Size);
                    if (sourceCrop.Width < 2 || sourceCrop.Height < 2)
                    {
                        graphics.Restore(state);
                        return false;
                    }

                    DrawTranslucentGlassTexture(graphics, blurredWallpaperSurface, bounds, sourceCrop);
                }
                else
                {
                    graphics.DrawImageUnscaled(renderedImage, bounds.Location);
                }
        using (Brush glassTint = new SolidBrush(Color.FromArgb(GlassTintArgb)))
                {
                    graphics.FillRectangle(glassTint, bounds);
                }
                graphics.Restore(state);
            }

            return true;
        }

        internal static void Dispose()
        {
            DisposeImage(ref renderedImage);
            DisposeImage(ref liveSourceImage);
            DisposeImage(ref sourceImage);
            DisposeImage(ref blurredWallpaperSurface);
            sourcePath = String.Empty;
            liveSourceBounds = Rectangle.Empty;
            liveFrameVersion = 0;
            renderedSize = Size.Empty;
            renderedScreenBounds = Rectangle.Empty;
            renderedLiveFrameVersion = 0;
            shellCaptureUtc = DateTime.MinValue;
            lastShellCaptureResult = null;
            blurredWallpaperSurfaceSize = Size.Empty;
            blurredWallpaperVirtualScreen = Rectangle.Empty;
        }

        internal static void SetLiveFrame(Bitmap frame, Rectangle sourceBounds)
        {
            Bitmap copy = null;
            if (frame != null)
            {
                copy = new Bitmap(frame.Width, frame.Height, PixelFormat.Format32bppPArgb);
                using (Graphics graphics = Graphics.FromImage(copy))
                {
                    graphics.DrawImageUnscaled(frame, 0, 0);
                }
            }

            DisposeImage(ref liveSourceImage);
            liveSourceImage = copy;
            liveSourceBounds = copy == null ? Rectangle.Empty : sourceBounds;
            liveFrameVersion++;
            DisposeImage(ref renderedImage);
            renderedSize = Size.Empty;
            renderedScreenBounds = Rectangle.Empty;
            renderedLiveFrameVersion = 0;
        }

        private static bool EnsureImages(Size targetSize, Rectangle panelScreenBounds, Rectangle screenBounds)
        {
            bool renderedChanged = renderedImage == null
                || renderedSize != targetSize
                || renderedScreenBounds != panelScreenBounds;

            string path = ResolveWallpaperPath();
            if (String.IsNullOrWhiteSpace(path) || !File.Exists(path))
            {
                Rectangle virtualScreen = System.Windows.Forms.SystemInformation.VirtualScreen;
                bool shellFrameChanged = EnsureShellWallpaperFrame(virtualScreen);
                if (liveSourceImage != null && liveSourceBounds.Contains(panelScreenBounds))
                {
                    return TryRenderLiveFrame(targetSize, panelScreenBounds, renderedChanged || shellFrameChanged);
                }

                return false;
            }

            // The hidden-state desktop sample is the only source that is
            // guaranteed to match the pixels currently behind the panel. Use
            // it before consulting the wallpaper file, which may be a stale
            // or protected DynamicTheme cache entry.
            if (liveSourceImage != null && liveSourceBounds == screenBounds)
            {
                return TryRenderLiveFrame(targetSize, screenBounds, renderedChanged) || renderedImage != null;
            }

            FileInfo info;
            try
            {
                info = new FileInfo(path);
            }
            catch (IOException)
            {
                return false;
            }
            catch (UnauthorizedAccessException)
            {
                return false;
            }

            bool sourceChanged = !String.Equals(sourcePath, path, StringComparison.OrdinalIgnoreCase)
                || sourceWriteTimeUtc != info.LastWriteTimeUtc
                || sourceLength != info.Length
                || sourceImage == null;
            if (!sourceChanged && !renderedChanged)
            {
                return true;
            }

            if (sourceChanged)
            {
                Bitmap loaded;
                try
                {
                    using (Image image = Image.FromFile(path))
                    {
                        loaded = new Bitmap(image.Width, image.Height, PixelFormat.Format32bppPArgb);
                        using (Graphics copy = Graphics.FromImage(loaded))
                        {
                            copy.DrawImageUnscaled(image, 0, 0);
                        }
                    }
                }
                catch (Exception)
                {
                    return TryRenderLiveFrame(targetSize, screenBounds, renderedChanged) || renderedImage != null;
                }

                DisposeImage(ref sourceImage);
                sourceImage = loaded;
                sourcePath = path;
                sourceWriteTimeUtc = info.LastWriteTimeUtc;
                sourceLength = info.Length;
                DisposeImage(ref renderedImage);
                DisposeImage(ref blurredWallpaperSurface);
                blurredWallpaperSurfaceSize = Size.Empty;
                blurredWallpaperVirtualScreen = Rectangle.Empty;
            }

            Rectangle wallpaperVirtualScreen = System.Windows.Forms.SystemInformation.VirtualScreen;
            if (EnsureWallpaperSurface(wallpaperVirtualScreen))
            {
                renderedSize = targetSize;
                renderedScreenBounds = panelScreenBounds;
                renderedLiveFrameVersion = 0;
                return true;
            }

            if (renderedImage == null || renderedChanged)
            {
                DisposeImage(ref renderedImage);
                renderedImage = CreateBlurredCrop(sourceImage, GetWallpaperCrop(sourceImage.Size, targetSize, screenBounds), targetSize);
                renderedSize = targetSize;
                renderedScreenBounds = screenBounds;
                renderedLiveFrameVersion = 0;
            }

            return renderedImage != null;
        }

        private static bool EnsureShellWallpaperFrame(Rectangle virtualScreen)
        {
            if (virtualScreen.Width < 2 || virtualScreen.Height < 2)
            {
                return false;
            }

            DateTime now = DateTime.UtcNow;
            if (liveSourceImage != null
                && liveSourceBounds == virtualScreen
                && (now - shellCaptureUtc).TotalMilliseconds < 1000)
            {
                return false;
            }

            using (Bitmap captured = DesktopShellWallpaper.Capture(virtualScreen))
            {
                shellCaptureUtc = now;
                bool captureSucceeded = captured != null;
                if (!lastShellCaptureResult.HasValue || lastShellCaptureResult.Value != captureSucceeded)
                {
                    lastShellCaptureResult = captureSucceeded;
                    try
                    {
                        string diagnosticPath = Path.Combine(Path.GetTempPath(), "WorkspaceSwitcher-glass-runtime.log");
                        File.AppendAllText(
                            diagnosticPath,
                            DateTime.Now.ToString("O") + " shellWallpaperCapture result=" + captureSucceeded + Environment.NewLine);
                    }
                    catch (Exception)
                    {
                    }
                }
                if (captured == null)
                {
                    return false;
                }

                SetLiveFrame(captured, virtualScreen);
                return true;
            }
        }

        private static bool EnsureWallpaperSurface(Rectangle virtualScreen)
        {
            if (sourceImage == null || virtualScreen.Width < 2 || virtualScreen.Height < 2)
            {
                return false;
            }

            Size targetSize = GetBlurSurfaceSize(virtualScreen.Size);
            if (blurredWallpaperSurface != null
                && blurredWallpaperSurfaceSize == targetSize
                && blurredWallpaperVirtualScreen == virtualScreen)
            {
                return true;
            }

            Rectangle crop = GetWallpaperCrop(sourceImage.Size, virtualScreen.Size, virtualScreen);
            Bitmap surface = CreateBlurredCrop(sourceImage, crop, targetSize);
            if (surface == null)
            {
                return false;
            }

            DisposeImage(ref blurredWallpaperSurface);
            blurredWallpaperSurface = surface;
            blurredWallpaperSurfaceSize = targetSize;
            blurredWallpaperVirtualScreen = virtualScreen;
            return true;
        }

        private static Size GetBlurSurfaceSize(Size virtualScreen)
        {
            const int maximumDimension = 1024;
            const int minimumDimension = 256;
            double ratio = virtualScreen.Width / (double)virtualScreen.Height;
            int width;
            int height;
            if (ratio >= 1d)
            {
                width = maximumDimension;
                height = Math.Max(minimumDimension, (int)Math.Round(width / ratio));
            }
            else
            {
                height = maximumDimension;
                width = Math.Max(minimumDimension, (int)Math.Round(height * ratio));
            }

            return new Size(width, height);
        }

        private static bool TryRenderLiveFrame(Size targetSize, Rectangle screenBounds, bool sizeChanged)
        {
            if (liveSourceImage == null || liveSourceBounds.IsEmpty)
            {
                return false;
            }

            bool frameChanged = renderedLiveFrameVersion != liveFrameVersion;
            if (!frameChanged && !sizeChanged && renderedImage != null)
            {
                return true;
            }

            Rectangle liveCrop = GetRelativeCrop(liveSourceImage.Size, liveSourceBounds, screenBounds);
            if (liveCrop.Width < 2 || liveCrop.Height < 2)
            {
                return false;
            }

            DisposeImage(ref renderedImage);
            renderedImage = CreateBlurredCrop(liveSourceImage, liveCrop, targetSize);
            renderedSize = targetSize;
            renderedScreenBounds = screenBounds;
            renderedLiveFrameVersion = liveFrameVersion;
            return renderedImage != null;
        }

        private static string GetWallpaperPath()
        {
            StringBuilder value = new StringBuilder(1024);
            return SystemParametersInfo(SpiGetDesktopWallpaper, (uint)value.Capacity, value, 0) != 0
                ? value.ToString()
                : String.Empty;
        }

        private static string ResolveWallpaperPath()
        {
            string path = GetWallpaperPath();
            if (!String.IsNullOrWhiteSpace(path) && File.Exists(path))
            {
                return path;
            }

            return String.Empty;
        }

        private static void DrawTranslucentGlassTexture(
            Graphics graphics,
            Bitmap texture,
            Rectangle destination,
            Rectangle sourceCrop)
        {
            using (ImageAttributes attributes = new ImageAttributes())
            {
                ColorMatrix matrix = new ColorMatrix();
            matrix.Matrix00 = 0.88f;
            matrix.Matrix11 = 0.82f;
            matrix.Matrix22 = 0.90f;
            matrix.Matrix33 = GlassTextureAlpha / 255f;
                attributes.SetColorMatrix(matrix, ColorMatrixFlag.Default, ColorAdjustType.Bitmap);
                graphics.DrawImage(
                    texture,
                    destination,
                    sourceCrop.X,
                    sourceCrop.Y,
                    sourceCrop.Width,
                    sourceCrop.Height,
                    GraphicsUnit.Pixel,
                    attributes);
            }
        }

        private static Bitmap CreateBlurredCrop(Bitmap source, Rectangle crop, Size targetSize)
        {
            if (source == null || targetSize.Width < 2 || targetSize.Height < 2)
            {
                return null;
            }

            Size sampleSize = GetBlurSampleSize(targetSize);
            using (Bitmap sample = new Bitmap(sampleSize.Width, sampleSize.Height, PixelFormat.Format32bppPArgb))
            {
                using (Graphics sampler = Graphics.FromImage(sample))
                {
                    ConfigureImageQuality(sampler);
                    sampler.DrawImage(source, new Rectangle(0, 0, sample.Width, sample.Height), crop, GraphicsUnit.Pixel);
                }

        using (Bitmap blurred = CreateLowFrequencyBlur(sample, WallpaperBlurRadius, WallpaperBlurPasses))
                {
                    Bitmap result = new Bitmap(targetSize.Width, targetSize.Height, PixelFormat.Format32bppPArgb);
                    using (Graphics graphics = Graphics.FromImage(result))
                    {
                        ConfigureImageQuality(graphics);
                        graphics.DrawImage(blurred, new Rectangle(Point.Empty, targetSize));
                    }
                    return result;
                }
            }
        }

        private static Size GetBlurSampleSize(Size targetSize)
        {
            const int maximumDimension = 256;
            const int minimumDimension = 64;
            double ratio = targetSize.Width / (double)targetSize.Height;
            int width;
            int height;
            if (ratio >= 1d)
            {
                width = maximumDimension;
                height = Math.Max(minimumDimension, Math.Min(maximumDimension, (int)Math.Round(width / ratio)));
            }
            else
            {
                height = maximumDimension;
                width = Math.Max(minimumDimension, Math.Min(maximumDimension, (int)Math.Round(height * ratio)));
            }

            return new Size(width, height);
        }

        // Repeated separable box blurs preserve broad wallpaper shapes while
        // removing recognizable texture and avoiding discrete color-field bands.
        private static Bitmap CreateLowFrequencyBlur(Bitmap source, int radius, int passes)
        {
            Bitmap current = CloneBitmap(source);
            for (int pass = 0; pass < passes; pass++)
            {
                Bitmap horizontal = BoxBlur(current, radius, true);
                Bitmap vertical = BoxBlur(horizontal, radius, false);
                horizontal.Dispose();
                if (pass > 0)
                {
                    current.Dispose();
                }
                current = vertical;
            }

            return current;
        }

        private static Bitmap CloneBitmap(Bitmap source)
        {
            Bitmap copy = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppPArgb);
            using (Graphics graphics = Graphics.FromImage(copy))
            {
                graphics.DrawImageUnscaled(source, 0, 0);
            }
            return copy;
        }

        private static Bitmap BoxBlur(Bitmap source, int radius, bool horizontal)
        {
            Bitmap result = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppPArgb);
            Rectangle rectangle = new Rectangle(0, 0, source.Width, source.Height);
            BitmapData sourceData = source.LockBits(rectangle, ImageLockMode.ReadOnly, PixelFormat.Format32bppPArgb);
            BitmapData resultData = result.LockBits(rectangle, ImageLockMode.WriteOnly, PixelFormat.Format32bppPArgb);
            try
            {
                int sourceStride = Math.Abs(sourceData.Stride);
                int resultStride = Math.Abs(resultData.Stride);
                byte[] sourceBytes = new byte[sourceStride * source.Height];
                byte[] resultBytes = new byte[resultStride * result.Height];
                Marshal.Copy(sourceData.Scan0, sourceBytes, 0, sourceBytes.Length);

                for (int y = 0; y < source.Height; y++)
                for (int x = 0; x < source.Width; x++)
                {
                    int blue = 0;
                    int green = 0;
                    int red = 0;
                    int alpha = 0;
                    int count = 0;
                    for (int offset = -radius; offset <= radius; offset++)
                    {
                        int sampleX = horizontal ? Math.Max(0, Math.Min(source.Width - 1, x + offset)) : x;
                        int sampleY = horizontal ? y : Math.Max(0, Math.Min(source.Height - 1, y + offset));
                        int index = sampleY * sourceStride + sampleX * 4;
                        blue += sourceBytes[index];
                        green += sourceBytes[index + 1];
                        red += sourceBytes[index + 2];
                        alpha += sourceBytes[index + 3];
                        count++;
                    }

                    int destination = y * resultStride + x * 4;
                    resultBytes[destination] = (byte)(blue / count);
                    resultBytes[destination + 1] = (byte)(green / count);
                    resultBytes[destination + 2] = (byte)(red / count);
                    resultBytes[destination + 3] = (byte)(alpha / count);
                }

                Marshal.Copy(resultBytes, 0, resultData.Scan0, resultBytes.Length);
            }
            finally
            {
                source.UnlockBits(sourceData);
                result.UnlockBits(resultData);
            }

            return result;
        }

        private static Rectangle GetRelativeCrop(Size sourceSize, Rectangle sourceBounds, Rectangle targetBounds)
        {
            Rectangle crop = new Rectangle(
                targetBounds.Left - sourceBounds.Left,
                targetBounds.Top - sourceBounds.Top,
                targetBounds.Width,
                targetBounds.Height);
            crop.Intersect(new Rectangle(Point.Empty, sourceSize));
            return crop;
        }

        private static Rectangle GetSurfaceCrop(Rectangle screenBounds, Rectangle virtualScreen, Size surfaceSize)
        {
            Rectangle visibleBounds = Rectangle.Intersect(screenBounds, virtualScreen);
            if (visibleBounds.Width < 2 || visibleBounds.Height < 2)
            {
                return Rectangle.Empty;
            }

            int left = (int)Math.Floor((visibleBounds.Left - virtualScreen.Left) * surfaceSize.Width / (double)virtualScreen.Width);
            int top = (int)Math.Floor((visibleBounds.Top - virtualScreen.Top) * surfaceSize.Height / (double)virtualScreen.Height);
            int right = (int)Math.Ceiling((visibleBounds.Right - virtualScreen.Left) * surfaceSize.Width / (double)virtualScreen.Width);
            int bottom = (int)Math.Ceiling((visibleBounds.Bottom - virtualScreen.Top) * surfaceSize.Height / (double)virtualScreen.Height);
            Rectangle crop = new Rectangle(left, top, Math.Max(1, right - left), Math.Max(1, bottom - top));
            crop.Intersect(new Rectangle(Point.Empty, surfaceSize));
            return crop;
        }

        private static Rectangle GetWallpaperCrop(Size source, Size target, Rectangle screenBounds)
        {
            Rectangle virtualScreen = System.Windows.Forms.SystemInformation.VirtualScreen;
            if (virtualScreen.Width < 2 || virtualScreen.Height < 2)
            {
                return GetCoverCrop(source, target);
            }

            double scale = Math.Max(
                source.Width / (double)virtualScreen.Width,
                source.Height / (double)virtualScreen.Height);
            double scaledWidth = virtualScreen.Width * scale;
            double scaledHeight = virtualScreen.Height * scale;
            double cropLeft = (source.Width - scaledWidth) / 2d;
            double cropTop = (source.Height - scaledHeight) / 2d;
            double left = cropLeft + (screenBounds.Left - virtualScreen.Left) * scale;
            double top = cropTop + (screenBounds.Top - virtualScreen.Top) * scale;
            double width = Math.Max(1d, screenBounds.Width * scale);
            double height = Math.Max(1d, screenBounds.Height * scale);

            Rectangle crop = new Rectangle(
                (int)Math.Round(left),
                (int)Math.Round(top),
                Math.Max(1, (int)Math.Round(width)),
                Math.Max(1, (int)Math.Round(height)));
            crop.Intersect(new Rectangle(Point.Empty, source));
            return crop.Width > 1 && crop.Height > 1 ? crop : GetCoverCrop(source, target);
        }

        private static Rectangle GetCoverCrop(Size source, Size target)
        {
            double sourceRatio = source.Width / (double)source.Height;
            double targetRatio = target.Width / (double)target.Height;
            if (sourceRatio > targetRatio)
            {
                int width = Math.Max(1, (int)Math.Round(source.Height * targetRatio));
                return new Rectangle((source.Width - width) / 2, 0, width, source.Height);
            }

            int height = Math.Max(1, (int)Math.Round(source.Width / targetRatio));
            return new Rectangle(0, (source.Height - height) / 2, source.Width, height);
        }

        private static void ConfigureImageQuality(Graphics graphics)
        {
            graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
            graphics.CompositingQuality = CompositingQuality.HighQuality;
            graphics.SmoothingMode = SmoothingMode.HighQuality;
            graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
        }

        private static void DisposeImage(ref Bitmap image)
        {
            if (image != null)
            {
                image.Dispose();
                image = null;
            }
        }
    }

    internal static class LiveDesktopBackdrop
    {
        private static bool capturing;

        internal static Bitmap CaptureDesktopRegion(Rectangle bounds)
        {
            if (capturing || bounds.Width < 2 || bounds.Height < 2)
            {
                return null;
            }

            capturing = true;
            try
            {
                Bitmap frame = new Bitmap(bounds.Width, bounds.Height, PixelFormat.Format32bppPArgb);
                using (Graphics graphics = Graphics.FromImage(frame))
                {
                    graphics.CopyFromScreen(bounds.Location, Point.Empty, bounds.Size, CopyPixelOperation.SourceCopy);
                }

                return frame;
            }
            catch (Exception)
            {
                return null;
            }
            finally
            {
                capturing = false;
            }
        }

        internal static Bitmap CaptureBehindPanel(IntPtr window, Rectangle bounds)
        {
            if (window == IntPtr.Zero)
            {
                return null;
            }

            return CaptureDesktopRegion(bounds);
        }
    }
}
