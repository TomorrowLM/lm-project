using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

namespace ToolHub.Launcher
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            string toolHubAppDirectory = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(
                Path.DirectorySeparatorChar,
                Path.AltDirectorySeparatorChar);
            string toolHubArtifact = Directory.GetParent(toolHubAppDirectory).FullName;
            string artifactRoot = Directory.GetParent(toolHubArtifact).FullName;
            string workspaceAppDirectory = Path.Combine(artifactRoot, "workspace-switcher", "app");
            string toolHubPath = Path.Combine(toolHubAppDirectory, "ToolHub.exe");

            ApplyPendingFile(toolHubPath);
            ApplyPendingFile(Path.Combine(toolHubAppDirectory, "ToolHub.Core.dll"));
            ApplyPendingFile(Path.Combine(workspaceAppDirectory, "WorkspaceSwitcher.exe"));
            ApplyPendingFile(Path.Combine(workspaceAppDirectory, "WorkspaceSwitcher.Core.dll"));

            if (!File.Exists(toolHubPath))
            {
                MessageBox.Show(
                    "未找到 ToolHub 应用：\n" + toolHubPath,
                    "工具中心",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
                return;
            }

            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = toolHubPath,
                    WorkingDirectory = toolHubAppDirectory,
                    UseShellExecute = true
                });
            }
            catch (Exception exception)
            {
                MessageBox.Show(
                    "启动工具中心失败：\n" + exception.Message,
                    "工具中心",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
            }
        }

        private static void ApplyPendingFile(string targetPath)
        {
            string pendingPath = targetPath + ".next";
            if (!File.Exists(pendingPath))
            {
                return;
            }

            try
            {
                File.Copy(pendingPath, targetPath, true);
                File.Delete(pendingPath);
            }
            catch (IOException)
            {
                // A still-running process can keep the target locked. The next launch retries it.
            }
            catch (UnauthorizedAccessException)
            {
                // Keep the staged file so a later elevated deployment can apply it.
            }
        }
    }
}
