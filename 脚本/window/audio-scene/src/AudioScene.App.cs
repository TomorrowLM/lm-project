using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using AudioScene.Core;
using AudioScene.Windows;

namespace AudioScene.App
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string configPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                ".lm-exe",
                "audio-scene",
                "config",
                "scenes.xml");

            AudioSceneStore store = new AudioSceneStore(configPath);
            IAudioSceneBackend backend = null;
            string startupError = string.Empty;
            try
            {
                backend = new WindowsAudioBackend();
            }
            catch (Exception ex)
            {
                startupError = "无法初始化 Windows 音频接口：" + ex.Message;
            }

            using (AudioSceneForm form = new AudioSceneForm(store, backend, startupError))
            {
                Application.Run(form);
            }
        }
    }

    internal sealed class AudioSceneForm : Form
    {
        private readonly AudioSceneStore store;
        private readonly IAudioSceneBackend backend;
        private readonly string startupError;
        private readonly List<AudioSceneProfile> profiles = new List<AudioSceneProfile>();
        private readonly List<AudioDeviceInfo> devices = new List<AudioDeviceInfo>();
        private readonly ListBox sceneList = new ListBox();
        private readonly ComboBox deviceList = new ComboBox();
        private readonly ComboBox presetList = new ComboBox();
        private readonly TextBox nameBox = new TextBox();
        private readonly TrackBar volumeBar = new TrackBar();
        private readonly Label volumeValue = new Label();
        private readonly Label presetDescription = new Label();
        private readonly CheckBox mutedBox = new CheckBox();
        private readonly Label statusLabel = new Label();
        private readonly Button saveButton = new Button();
        private readonly Button applyButton = new Button();
        private readonly Button deleteButton = new Button();
        private bool updating;

        public AudioSceneForm(AudioSceneStore store, IAudioSceneBackend backend, string startupError)
        {
            this.store = store;
            this.backend = backend;
            this.startupError = startupError ?? string.Empty;
            Text = "声音场景";
            Width = 720;
            Height = 500;
            MinimumSize = new Size(620, 420);
            StartPosition = FormStartPosition.CenterScreen;
            Font = new Font("Microsoft YaHei UI", 10F);

            BuildUi();
            LoadState();
        }

        private void BuildUi()
        {
            TableLayoutPanel root = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 2,
                RowCount = 2,
                Padding = new Padding(16)
            };
            root.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 210F));
            root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 36F));
            Controls.Add(root);

            GroupBox sceneGroup = new GroupBox { Text = "我的场景", Dock = DockStyle.Fill };
            sceneList.Dock = DockStyle.Fill;
            sceneList.DisplayMember = "Name";
            sceneList.SelectedIndexChanged += delegate { LoadSelectedProfile(); };
            sceneGroup.Controls.Add(sceneList);
            root.Controls.Add(sceneGroup, 0, 0);

            TableLayoutPanel editor = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 2,
                RowCount = 8,
                Padding = new Padding(12, 4, 4, 4)
            };
            editor.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 110F));
            editor.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            for (int i = 0; i < 7; i++)
            {
                editor.RowStyles.Add(new RowStyle(SizeType.Absolute, 40F));
            }
            editor.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            root.Controls.Add(editor, 1, 0);

            AddEditorRow(editor, 0, "场景名称", nameBox);

            deviceList.DropDownStyle = ComboBoxStyle.DropDownList;
            deviceList.Dock = DockStyle.Fill;
            AddEditorRow(editor, 1, "播放设备", deviceList);

            presetList.DropDownStyle = ComboBoxStyle.DropDownList;
            presetList.DisplayMember = "Name";
            presetList.Dock = DockStyle.Fill;
            presetList.SelectedIndexChanged += delegate { ApplySelectedPresetToEditor(); };
            AddEditorRow(editor, 2, "声音预设", presetList);

            volumeBar.Minimum = 0;
            volumeBar.Maximum = 100;
            volumeBar.TickFrequency = 10;
            volumeBar.Dock = DockStyle.Fill;
            volumeBar.ValueChanged += delegate
            {
                volumeValue.Text = volumeBar.Value + "%";
            };
            TableLayoutPanel volumePanel = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2 };
            volumePanel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            volumePanel.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 46F));
            volumePanel.Controls.Add(volumeBar, 0, 0);
            volumeValue.Text = "70%";
            volumeValue.TextAlign = ContentAlignment.MiddleRight;
            volumePanel.Controls.Add(volumeValue, 1, 0);
            AddEditorRow(editor, 3, "设备音量", volumePanel);

            mutedBox.Text = "应用后静音";
            mutedBox.AutoSize = true;
            AddEditorRow(editor, 4, "静音", mutedBox);

            presetDescription.Text = "选择预设后会填入安全的推荐音量；不会自动修改系统。";
            presetDescription.AutoEllipsis = true;
            presetDescription.Dock = DockStyle.Fill;
            presetDescription.ForeColor = Color.DimGray;
            AddEditorRow(editor, 5, "预设说明", presetDescription);

            FlowLayoutPanel actions = new FlowLayoutPanel { Dock = DockStyle.Fill, AutoSize = true };
            Button newButton = CreateButton("新建场景", delegate { CreateProfile(); });
            saveButton.Text = "保存场景";
            saveButton.AutoSize = true;
            saveButton.Click += delegate { SaveProfile(); };
            applyButton.Text = "应用场景";
            applyButton.AutoSize = true;
            applyButton.Click += delegate { ApplyProfile(); };
            deleteButton.Text = "删除场景";
            deleteButton.AutoSize = true;
            deleteButton.Click += delegate { DeleteProfile(); };
            Button refreshButton = CreateButton("刷新设备", delegate { RefreshDevices(); });
            actions.Controls.Add(newButton);
            actions.Controls.Add(saveButton);
            actions.Controls.Add(applyButton);
            actions.Controls.Add(deleteButton);
            actions.Controls.Add(refreshButton);
            editor.Controls.Add(actions, 1, 6);
            editor.SetColumnSpan(actions, 1);

            statusLabel.Dock = DockStyle.Fill;
            statusLabel.TextAlign = ContentAlignment.MiddleLeft;
            statusLabel.ForeColor = Color.DimGray;
            root.Controls.Add(statusLabel, 0, 1);
            root.SetColumnSpan(statusLabel, 2);
        }

        private static Button CreateButton(string text, EventHandler handler)
        {
            Button button = new Button { Text = text, AutoSize = true };
            button.Click += handler;
            return button;
        }

        private static void AddEditorRow(TableLayoutPanel table, int row, string labelText, Control control)
        {
            Label label = new Label
            {
                Text = labelText,
                Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleLeft
            };
            table.Controls.Add(label, 0, row);
            table.Controls.Add(control, 1, row);
        }

        private void LoadState()
        {
            try
            {
                profiles.AddRange(store.Load());
            }
            catch (AudioSceneStorageException ex)
            {
                SetStatus(ex.Message, true);
            }

            presetList.DataSource = new List<AudioScenePreset>(AudioScenePresetCatalog.GetPresets());
            RefreshDevices();
            RefreshSceneList();
            if (sceneList.Items.Count > 0)
            {
                sceneList.SelectedIndex = 0;
            }
            else
            {
                SetEditorEnabled(false);
                SetStatus("请先新建场景；启动时不会自动修改系统声音。", false);
            }

            if (!string.IsNullOrWhiteSpace(startupError))
            {
                SetStatus(startupError, true);
            }
        }

        private void RefreshDevices()
        {
            updating = true;
            try
            {
                devices.Clear();
                if (backend != null)
                {
                    devices.AddRange(backend.GetRenderDevices());
                }

                string selectedId = GetSelectedDeviceId();
                deviceList.DataSource = null;
                deviceList.DataSource = new List<AudioDeviceInfo>(devices);
                SelectDevice(selectedId);
                SetStatus(devices.Count == 0 ? "没有发现可用的播放设备。" : "设备列表已刷新；尚未修改系统声音。", false);
            }
            catch (Exception ex)
            {
                deviceList.DataSource = null;
                SetStatus("读取播放设备失败：" + ex.Message, true);
            }
            finally
            {
                updating = false;
            }
        }

        private void RefreshSceneList()
        {
            updating = true;
            try
            {
                sceneList.DataSource = null;
                sceneList.DataSource = profiles;
            }
            finally
            {
                updating = false;
            }
        }

        private void LoadSelectedProfile()
        {
            if (updating)
            {
                return;
            }

            AudioSceneProfile profile = GetSelectedProfile();
            SetEditorEnabled(profile != null);
            if (profile == null)
            {
                return;
            }

            updating = true;
            try
            {
                nameBox.Text = profile.Name;
                volumeBar.Value = Math.Max(volumeBar.Minimum, Math.Min(volumeBar.Maximum, profile.VolumePercent));
                mutedBox.Checked = profile.Muted;
                SelectDevice(profile.DeviceId);
                SelectPreset(profile.PresetId);
                UpdatePresetDescription();
            }
            finally
            {
                updating = false;
            }
        }

        private void CreateProfile()
        {
            AudioDeviceInfo device = deviceList.SelectedItem as AudioDeviceInfo;
            AudioSceneProfile profile = new AudioSceneProfile
            {
                Id = Guid.NewGuid().ToString("N"),
                Name = "新场景",
                DeviceId = device == null ? string.Empty : device.Id,
                DeviceName = device == null ? string.Empty : device.Name
            };
            AudioScenePresetCatalog.ApplyTo(profile, "music-balanced");
            profiles.Add(profile);
            RefreshSceneList();
            sceneList.SelectedItem = profile;
            SetStatus("场景已创建，请保存后再应用。", false);
        }

        private void SaveProfile()
        {
            AudioSceneProfile profile = GetSelectedProfile();
            if (profile == null)
            {
                SetStatus("请先新建或选择场景。", true);
                return;
            }

            if (!UpdateProfileFromEditor(profile))
            {
                return;
            }

            try
            {
                store.Save(profiles);
                RefreshSceneList();
                sceneList.SelectedItem = profile;
                SetStatus("场景已保存；系统声音尚未修改。", false);
            }
            catch (AudioSceneStorageException ex)
            {
                SetStatus(ex.Message, true);
            }
        }

        private void ApplyProfile()
        {
            AudioSceneProfile profile = GetSelectedProfile();
            if (profile == null || backend == null)
            {
                SetStatus("没有可应用的场景或音频接口不可用。", true);
                return;
            }

            if (!UpdateProfileFromEditor(profile))
            {
                return;
            }

            try
            {
                store.Save(profiles);
                AudioSceneApplyResult result = backend.Apply(profile);
                if (!result.Success)
                {
                    SetStatus(result.Message, true);
                    return;
                }

                string message = result.Message;
                foreach (string warning in result.Warnings)
                {
                    message += " " + warning;
                }
                SetStatus(message, false);
            }
            catch (AudioSceneStorageException ex)
            {
                SetStatus(ex.Message + " 系统声音未修改。", true);
            }
        }

        private void DeleteProfile()
        {
            AudioSceneProfile profile = GetSelectedProfile();
            if (profile == null)
            {
                return;
            }

            if (MessageBox.Show("确定删除场景“" + profile.Name + "”吗？", "删除场景", MessageBoxButtons.YesNo,
                    MessageBoxIcon.Question) != DialogResult.Yes)
            {
                return;
            }

            profiles.Remove(profile);
            try
            {
                store.Save(profiles);
                RefreshSceneList();
                SetEditorEnabled(sceneList.Items.Count > 0);
                SetStatus("场景已删除；系统声音未修改。", false);
            }
            catch (AudioSceneStorageException ex)
            {
                SetStatus(ex.Message, true);
            }
        }

        private bool UpdateProfileFromEditor(AudioSceneProfile profile)
        {
            string name = (nameBox.Text ?? string.Empty).Trim();
            AudioDeviceInfo device = deviceList.SelectedItem as AudioDeviceInfo;
            AudioScenePreset preset = presetList.SelectedItem as AudioScenePreset;
            if (name.Length == 0)
            {
                SetStatus("场景名称不能为空。", true);
                return false;
            }

            if (device == null || string.IsNullOrWhiteSpace(device.Id))
            {
                SetStatus("请选择一个播放设备；未修改系统声音。", true);
                return false;
            }

            profile.Name = name;
            profile.DeviceId = device.Id;
            profile.DeviceName = device.Name;
            profile.PresetId = preset == null ? string.Empty : preset.Id;
            profile.VolumePercent = volumeBar.Value;
            profile.Muted = mutedBox.Checked;
            profile.Normalize();
            return true;
        }

        private void ApplySelectedPresetToEditor()
        {
            if (updating)
            {
                return;
            }

            AudioScenePreset preset = presetList.SelectedItem as AudioScenePreset;
            if (preset == null)
            {
                return;
            }

            volumeBar.Value = Math.Max(volumeBar.Minimum, Math.Min(volumeBar.Maximum, preset.RecommendedVolumePercent));
            UpdatePresetDescription();
        }

        private void UpdatePresetDescription()
        {
            AudioScenePreset preset = presetList.SelectedItem as AudioScenePreset;
            presetDescription.Text = preset == null
                ? "选择预设后会填入安全的推荐音量；不会自动修改系统。"
                : preset.Description + " 当前版本不安装驱动，通用 EQ 由设备自行提供。";
        }

        private AudioSceneProfile GetSelectedProfile()
        {
            return sceneList.SelectedItem as AudioSceneProfile;
        }

        private string GetSelectedDeviceId()
        {
            AudioDeviceInfo device = deviceList.SelectedItem as AudioDeviceInfo;
            return device == null ? string.Empty : device.Id;
        }

        private void SelectDevice(string deviceId)
        {
            for (int index = 0; index < deviceList.Items.Count; index++)
            {
                AudioDeviceInfo device = deviceList.Items[index] as AudioDeviceInfo;
                if (device != null && string.Equals(device.Id, deviceId, StringComparison.OrdinalIgnoreCase))
                {
                    deviceList.SelectedIndex = index;
                    return;
                }
            }

            if (deviceList.Items.Count > 0 && deviceList.SelectedIndex < 0)
            {
                deviceList.SelectedIndex = 0;
            }
        }

        private void SelectPreset(string presetId)
        {
            for (int index = 0; index < presetList.Items.Count; index++)
            {
                AudioScenePreset preset = presetList.Items[index] as AudioScenePreset;
                if (preset != null && string.Equals(preset.Id, presetId, StringComparison.OrdinalIgnoreCase))
                {
                    presetList.SelectedIndex = index;
                    return;
                }
            }

            if (presetList.Items.Count > 0 && presetList.SelectedIndex < 0)
            {
                presetList.SelectedIndex = 0;
            }
        }

        private void SetEditorEnabled(bool enabled)
        {
            nameBox.Enabled = enabled;
            deviceList.Enabled = enabled;
            presetList.Enabled = enabled;
            volumeBar.Enabled = enabled;
            mutedBox.Enabled = enabled;
            saveButton.Enabled = enabled;
            applyButton.Enabled = enabled && backend != null;
            deleteButton.Enabled = enabled;
        }

        private void SetStatus(string message, bool isError)
        {
            statusLabel.Text = message ?? string.Empty;
            statusLabel.ForeColor = isError ? Color.Firebrick : Color.DimGray;
        }
    }
}
