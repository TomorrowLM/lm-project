using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

namespace ToolHub.Installer
{
    internal sealed class InstallerForm : Form
    {
        private readonly string sourceRoot;
        private readonly string artifactRoot;
        private readonly Label statusLabel;

        public InstallerForm(string sourceRoot, string artifactRoot)
        {
            this.sourceRoot = sourceRoot;
            this.artifactRoot = artifactRoot;

            Text = "Windows ToolHub Installer";
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(460, 180);
            Font = new Font("Microsoft YaHei UI", 9F);

            Label title = new Label
            {
                AutoSize = false,
                Location = new Point(22, 18),
                Size = new Size(416, 24),
                Text = "Synchronize Windows tools into the user runtime directory.",
                Font = new Font("Microsoft YaHei UI", 10F, FontStyle.Bold)
            };
            Controls.Add(title);

            Label paths = new Label
            {
                AutoSize = false,
                Location = new Point(22, 50),
                Size = new Size(416, 48),
                Text = "Source: " + sourceRoot + Environment.NewLine + "Target: " + artifactRoot,
                ForeColor = Color.FromArgb(90, 98, 112)
            };
            Controls.Add(paths);

            Button syncButton = new Button
            {
                Location = new Point(22, 120),
                Size = new Size(128, 32),
                Text = "Sync tools",
                UseVisualStyleBackColor = true
            };
            syncButton.Click += delegate { RunSync(false); };
            Controls.Add(syncButton);

            Button startButton = new Button
            {
                Location = new Point(160, 120),
                Size = new Size(150, 32),
                Text = "Sync and start",
                UseVisualStyleBackColor = true
            };
            startButton.Click += delegate { RunSync(true); };
            Controls.Add(startButton);

            statusLabel = new Label
            {
                AutoSize = false,
                Location = new Point(322, 125),
                Size = new Size(116, 24),
                Text = "Ready",
                ForeColor = Color.FromArgb(90, 98, 112),
                TextAlign = ContentAlignment.MiddleRight
            };
            Controls.Add(statusLabel);
        }

        private void RunSync(bool startAfterSync)
        {
            string scriptPath = Path.Combine(sourceRoot, "tools", "sync-window-tools.ps1");
            if (!File.Exists(scriptPath))
            {
                MessageBox.Show(this,
                    "The synchronization script was not found:\n" + scriptPath,
                    "ToolHub Installer",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
                return;
            }

            try
            {
                string arguments = "-NoProfile -ExecutionPolicy Bypass -File " + Quote(scriptPath) +
                    " -ProjectRoot " + Quote(sourceRoot) +
                    " -ArtifactRoot " + Quote(artifactRoot) +
                    " -SkipInstaller";
                if (startAfterSync)
                {
                    arguments += " -Start";
                }

                ProcessStartInfo startInfo = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = arguments,
                    WorkingDirectory = sourceRoot,
                    UseShellExecute = true,
                    CreateNoWindow = false
                };
                Process.Start(startInfo);
                statusLabel.Text = "Sync started";
                Close();
            }
            catch (Exception exception)
            {
                MessageBox.Show(this,
                    "Could not start synchronization:\n" + exception.Message,
                    "ToolHub Installer",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
            }
        }

        private static string Quote(string value)
        {
            return "\"" + value.Replace("\"", "\\\"") + "\"";
        }
    }

    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string baseDirectory = AppDomain.CurrentDomain.BaseDirectory;
            string artifactRoot = FindArtifactRoot(baseDirectory);
            string sourceRoot = FindSourceRoot(baseDirectory, artifactRoot);
            if (string.IsNullOrWhiteSpace(sourceRoot))
            {
                MessageBox.Show(
                    "Could not locate tool-hub source. Put this installer under .lm-exe\\tool-hub\\app or run it from the source build directory.",
                    "ToolHub Installer",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
                return;
            }

            Application.Run(new InstallerForm(sourceRoot, artifactRoot));
        }

        private static string FindArtifactRoot(string baseDirectory)
        {
            DirectoryInfo appDirectory = new DirectoryInfo(baseDirectory.TrimEnd(
                Path.DirectorySeparatorChar,
                Path.AltDirectorySeparatorChar));
            if (appDirectory.Name.Equals("app", StringComparison.OrdinalIgnoreCase) &&
                appDirectory.Parent != null && appDirectory.Parent.Parent != null)
            {
                return appDirectory.Parent.Parent.FullName;
            }

            string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            return Path.Combine(userProfile, ".lm-exe");
        }

        private static string FindSourceRoot(string baseDirectory, string artifactRoot)
        {
            string sourceConfig = Path.Combine(artifactRoot, "tool-hub", "config", "source-root.txt");
            if (File.Exists(sourceConfig))
            {
                string configured = File.ReadAllText(sourceConfig).Trim();
                if (Directory.Exists(configured) && File.Exists(Path.Combine(configured, "tools", "sync-window-tools.ps1")))
                {
                    return configured;
                }
            }

            DirectoryInfo current = new DirectoryInfo(baseDirectory);
            while (current != null)
            {
                if (File.Exists(Path.Combine(current.FullName, "tools", "sync-window-tools.ps1")))
                {
                    return current.FullName;
                }
                current = current.Parent;
            }

            return string.Empty;
        }
    }
}
