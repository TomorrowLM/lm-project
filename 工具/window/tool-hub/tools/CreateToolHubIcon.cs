using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using ToolHub.App;

internal static class CreateToolHubIcon
{
    private static readonly int[] Sizes = { 256, 48, 32, 16 };

    private static void Main(string[] args)
    {
        if (args.Length != 1)
        {
            Console.Error.WriteLine("Usage: CreateToolHubIcon.exe output.ico");
            Environment.Exit(2);
        }

        List<byte[]> pngs = new List<byte[]>();
        foreach (int size in Sizes)
        {
            using (Bitmap bitmap = new Bitmap(size, size, PixelFormat.Format32bppArgb))
            using (Graphics graphics = Graphics.FromImage(bitmap))
            using (MemoryStream stream = new MemoryStream())
            {
                graphics.Clear(Color.Transparent);
                ToolHubIcon.Draw(graphics, new Rectangle(0, 0, size, size));
                bitmap.Save(stream, ImageFormat.Png);
                pngs.Add(stream.ToArray());
            }
        }

        using (FileStream file = new FileStream(args[0], FileMode.Create, FileAccess.Write, FileShare.None))
        using (BinaryWriter writer = new BinaryWriter(file))
        {
            writer.Write((ushort)0);
            writer.Write((ushort)1);
            writer.Write((ushort)Sizes.Length);
            int offset = 6 + 16 * Sizes.Length;
            for (int i = 0; i < Sizes.Length; i++)
            {
                int size = Sizes[i];
                writer.Write((byte)(size == 256 ? 0 : size));
                writer.Write((byte)(size == 256 ? 0 : size));
                writer.Write((byte)0);
                writer.Write((byte)0);
                writer.Write((ushort)1);
                writer.Write((ushort)32);
                writer.Write((uint)pngs[i].Length);
                writer.Write((uint)offset);
                offset += pngs[i].Length;
            }

            foreach (byte[] png in pngs)
            {
                writer.Write(png);
            }
        }
    }
}
