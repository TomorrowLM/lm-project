using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.Threading;
using System.Windows.Forms;
using SystemStabilityDiagnostics.Core;

namespace SystemStabilityDiagnostics.App
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            string logDirectory = DiagnosticPaths.GetLogDirectory(Application.ExecutablePath);
            Application.Run(new DiagnosticsForm(new WindowsResourceCollector(), new DiagnosticLogStore(logDirectory)));
        }
    }

    public sealed class DiagnosticsForm : Form
    {
        private static readonly Color Background = Color.FromArgb(244, 247, 252);
        private static readonly Color Surface = Color.White;
        private static readonly Color Ink = Color.FromArgb(25, 39, 65);
        private static readonly Color Muted = Color.FromArgb(102, 119, 146);
        private static readonly Color Accent = Color.FromArgb(47, 107, 255);
        private static readonly Color Border = Color.FromArgb(218, 228, 241);
        private static readonly Color SoftBlue = Color.FromArgb(237, 244, 255);

        private static readonly TimeSpan MaximumSession = TimeSpan.FromMinutes(10);
        private static readonly TimeSpan SamplingInterval = TimeSpan.FromSeconds(5);

        private readonly WindowsResourceCollector collector;
        private readonly WindowsSystemUsageReader liveUsageReader = new WindowsSystemUsageReader();
        private readonly DiagnosticLogStore store;
        private readonly Stopwatch samplingWatch = new Stopwatch();
        private SplitContainer resourceSplit;
        private Label cpuValue;
        private Label gpuValue;
        private Label memoryValue;
        private Label samplingValue;
        private Label samplingDescription;
        private Label footerLabel;
        private Button samplingButton;
        private ComboBox symptomPicker;
        private TextBox noteBox;
        private DataGridView processGrid;
        private DataGridView historyGrid;
        private DataGridView eventGrid;
        private Label eventStatus;
        private int sampleInProgress;
        private int isSampling;
        private int sampleCount;
        private System.Threading.Timer liveMetricsTimer;
        private int liveMetricsInProgress;
        private int liveMetricsClosing;
        private int liveUsageReaderDisposed;

        public DiagnosticsForm(WindowsResourceCollector collector, DiagnosticLogStore store)
        {
            if (collector == null) { throw new ArgumentNullException("collector"); }
            if (store == null) { throw new ArgumentNullException("store"); }
            this.collector = collector;
            this.store = store;
            Text = "系统稳定性诊断";
            StartPosition = FormStartPosition.CenterScreen;
            MinimumSize = new Size(860, 680);
            Size = new Size(1040, 790);
            BackColor = Background;
            ForeColor = Ink;
            Font = new Font("Segoe UI", 10F, FontStyle.Regular, GraphicsUnit.Point);
            AutoScaleMode = AutoScaleMode.Font;

            var root = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(26, 20, 26, 16),
                ColumnCount = 1,
                RowCount = 5,
                BackColor = Background
            };
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 70));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 104));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 142));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 26));
            Controls.Add(root);

            root.Controls.Add(BuildHeader(), 0, 0);
            root.Controls.Add(BuildMetricCards(out cpuValue, out gpuValue, out memoryValue, out samplingValue), 0, 1);
            root.Controls.Add(BuildActionPanel(out samplingButton, out samplingDescription, out symptomPicker, out noteBox), 0, 2);

            var tabs = new TabControl { Dock = DockStyle.Fill, Padding = new Point(18, 6) };
            var resourceTab = new TabPage("资源与历史") { BackColor = Background, Padding = new Padding(0, 10, 0, 0) };
            var eventsTab = new TabPage("系统事件") { BackColor = Background, Padding = new Padding(0, 10, 0, 0) };
            tabs.TabPages.Add(resourceTab);
            tabs.TabPages.Add(eventsTab);
            root.Controls.Add(tabs, 0, 3);

            resourceSplit = new SplitContainer
            {
                Dock = DockStyle.Fill,
                Orientation = Orientation.Horizontal,
                BackColor = Background,
                Panel1MinSize = 150,
                Panel2MinSize = 100
            };
            resourceTab.Controls.Add(resourceSplit);
            resourceSplit.Panel1.Controls.Add(BuildProcessSection(out processGrid));
            resourceSplit.Panel2.Controls.Add(BuildHistorySection(out historyGrid));
            eventStatus = new Label
            {
                Dock = DockStyle.Top,
                Height = 34,
                TextAlign = ContentAlignment.MiddleLeft,
                ForeColor = Muted,
                Text = "最近 14 天的应用程序和系统日志中的警告、错误"
            };
            var eventPanel = new Panel { Dock = DockStyle.Fill, BackColor = Surface, Padding = new Padding(14) };
            eventPanel.Controls.Add(BuildGrid(out eventGrid));
            AddEventColumns(eventGrid);
            eventPanel.Controls.Add(eventStatus);
            var eventHeader = new Panel { Dock = DockStyle.Top, Height = 42, BackColor = Background };
            var refreshEventsButton = MakeButton("刷新系统事件", true);
            refreshEventsButton.Dock = DockStyle.Right;
            refreshEventsButton.Width = 144;
            refreshEventsButton.Click += delegate { RefreshSystemEvents(); };
            eventHeader.Controls.Add(refreshEventsButton);
            eventsTab.Controls.Add(eventPanel);
            eventsTab.Controls.Add(eventHeader);

            footerLabel = new Label
            {
                Dock = DockStyle.Fill,
                ForeColor = Muted,
                TextAlign = ContentAlignment.MiddleLeft,
                AutoEllipsis = true,
                Text = "CPU/GPU/内存实时值每 2 秒刷新且不写历史　·　记录保存在：" + store.LogDirectory
            };
            root.Controls.Add(footerLabel, 0, 4);

            samplingButton.Click += delegate
            {
                if (Interlocked.CompareExchange(ref isSampling, 0, 0) == 1) { StopSampling(); }
                else { StartSampling(); }
            };
            RefreshHistory();
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            if (resourceSplit.Height > resourceSplit.Panel1MinSize + resourceSplit.Panel2MinSize + resourceSplit.SplitterWidth)
            {
                resourceSplit.SplitterDistance = Math.Max(resourceSplit.Panel1MinSize,
                    Math.Min(240, resourceSplit.Height - resourceSplit.Panel2MinSize - resourceSplit.SplitterWidth));
            }
            StartLiveUsageMonitoring();
            RefreshSystemEvents();
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            StopLiveUsageMonitoring();
            StopSampling();
            base.OnFormClosing(e);
        }

        private void StartLiveUsageMonitoring()
        {
            if (liveMetricsTimer != null) { return; }
            liveMetricsTimer = new System.Threading.Timer(LiveUsageTick, null,
                TimeSpan.Zero, TimeSpan.FromSeconds(2));
        }

        private void StopLiveUsageMonitoring()
        {
            Interlocked.Exchange(ref liveMetricsClosing, 1);
            System.Threading.Timer timer = liveMetricsTimer;
            liveMetricsTimer = null;
            if (timer != null) { timer.Dispose(); }
            DisposeLiveUsageReaderIfIdle();
        }

        private void LiveUsageTick(object state)
        {
            if (Interlocked.Exchange(ref liveMetricsInProgress, 1) != 0) { return; }
            try
            {
                if (Interlocked.CompareExchange(ref liveMetricsClosing, 0, 0) == 1) { return; }
                SystemUsageSnapshot snapshot = liveUsageReader.Capture();
                PostToUi(delegate
                {
                    if (!IsDisposed) { UpdateLiveUsage(snapshot); }
                });
            }
            catch (Exception)
            {
                PostToUi(delegate
                {
                    if (IsDisposed) { return; }
                    cpuValue.Text = "读取失败";
                    gpuValue.Text = "不可用";
                    memoryValue.Text = "读取失败";
                });
            }
            finally
            {
                Interlocked.Exchange(ref liveMetricsInProgress, 0);
                DisposeLiveUsageReaderIfIdle();
            }
        }

        private void DisposeLiveUsageReaderIfIdle()
        {
            if (Interlocked.CompareExchange(ref liveMetricsClosing, 0, 0) != 1
                || Interlocked.CompareExchange(ref liveMetricsInProgress, 0, 0) != 0)
            {
                return;
            }

            if (Interlocked.Exchange(ref liveUsageReaderDisposed, 1) == 0)
            {
                liveUsageReader.Dispose();
            }
        }

        private void UpdateLiveUsage(SystemUsageSnapshot snapshot)
        {
            cpuValue.Text = snapshot.CpuPercent.ToString("0.0", CultureInfo.InvariantCulture) + "%";
            gpuValue.Text = snapshot.GpuPercent.HasValue
                ? snapshot.GpuPercent.Value.ToString("0.0", CultureInfo.InvariantCulture) + "%"
                : snapshot.GpuCounterAvailable ? "读取中…" : "不可用";
            memoryValue.Text = snapshot.TotalMemoryMb > 0
                ? FormatMemory(snapshot.UsedMemoryMb) + " / " + FormatMemory(snapshot.TotalMemoryMb)
                : "不可用";
        }

        private Control BuildHeader()
        {
            var panel = new Panel { Dock = DockStyle.Fill, BackColor = Background };
            var title = new Label
            {
                AutoSize = true,
                Text = "系统稳定性诊断",
                Font = new Font("Segoe UI", 21F, FontStyle.Bold, GraphicsUnit.Point),
                ForeColor = Ink,
                Location = new Point(0, 0)
            };
            var subtitle = new Label
            {
                AutoSize = true,
                Text = "在卡顿发生前后采样，并标记鼠标、整机或应用异常的准确时间。",
                Font = new Font("Segoe UI", 9.5F, FontStyle.Regular, GraphicsUnit.Point),
                ForeColor = Muted,
                Location = new Point(2, 39)
            };
            panel.Controls.Add(title);
            panel.Controls.Add(subtitle);
            return panel;
        }

        private Control BuildMetricCards(out Label cpu, out Label gpu, out Label memory, out Label sampling)
        {
            var row = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 4,
                RowCount = 1,
                BackColor = Background,
                Margin = new Padding(0, 0, 0, 8)
            };
            row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 25F));
            row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 25F));
            row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 25F));
            row.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 25F));
            row.Controls.Add(BuildMetric("整体 CPU", "读取中…", out cpu), 0, 0);
            row.Controls.Add(BuildMetric("GPU 使用率", "读取中…", out gpu), 1, 0);
            row.Controls.Add(BuildMetric("内存使用", "读取中…", out memory), 2, 0);
            row.Controls.Add(BuildMetric("采样状态", "未开始", out sampling), 3, 0);
            return row;
        }

        private Control BuildMetric(string caption, string initialValue, out Label value)
        {
            var card = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = Surface,
                Margin = new Padding(0, 0, 10, 0),
                Padding = new Padding(16, 10, 12, 8)
            };
            card.Paint += delegate(object sender, PaintEventArgs e)
            {
                using (var pen = new Pen(Border))
                {
                    e.Graphics.DrawRectangle(pen, 0, 0, card.Width - 1, card.Height - 1);
                }
            };
            var heading = new Label
            {
                Dock = DockStyle.Top,
                Height = 24,
                Text = caption,
                ForeColor = Muted,
                Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point)
            };
            value = new Label
            {
                Dock = DockStyle.Fill,
                Text = initialValue,
                ForeColor = Ink,
                Font = new Font("Segoe UI", 17F, FontStyle.Bold, GraphicsUnit.Point),
                AutoEllipsis = true
            };
            card.Controls.Add(value);
            card.Controls.Add(heading);
            return card;
        }

        private Control BuildActionPanel(out Button sampleButton, out Label sampleDescription,
            out ComboBox symptom, out TextBox note)
        {
            var panel = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 2,
                RowCount = 1,
                BackColor = SoftBlue,
                Padding = new Padding(16, 12, 16, 12),
                Margin = new Padding(0, 8, 0, 10)
            };
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 43F));
            panel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 57F));

            var samplingGroup = new Panel { Dock = DockStyle.Fill, BackColor = SoftBlue };
            var samplingTitle = new Label
            {
                Dock = DockStyle.Top,
                Height = 24,
                Text = "实时采样",
                ForeColor = Ink,
                Font = new Font("Segoe UI", 11F, FontStyle.Bold, GraphicsUnit.Point)
            };
            sampleDescription = new Label
            {
                Dock = DockStyle.Top,
                Height = 36,
                Text = "实时值每 2 秒刷新；点击开始后才记录历史。",
                ForeColor = Muted,
                Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point)
            };
            sampleButton = MakeButton("开始采样", true);
            sampleButton.Location = new Point(0, 66);
            sampleButton.Size = new Size(134, 36);
            samplingGroup.Controls.Add(sampleButton);
            samplingGroup.Controls.Add(sampleDescription);
            samplingGroup.Controls.Add(samplingTitle);
            panel.Controls.Add(samplingGroup, 0, 0);

            var markerGroup = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 3,
                RowCount = 3,
                BackColor = SoftBlue,
                Margin = new Padding(8, 0, 0, 0)
            };
            markerGroup.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 112));
            markerGroup.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            markerGroup.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 118));
            markerGroup.RowStyles.Add(new RowStyle(SizeType.Absolute, 22));
            markerGroup.RowStyles.Add(new RowStyle(SizeType.Absolute, 38));
            markerGroup.RowStyles.Add(new RowStyle(SizeType.Absolute, 34));
            var markerTitle = new Label
            {
                Text = "卡顿时间标记",
                Dock = DockStyle.Fill,
                ForeColor = Ink,
                Font = new Font("Segoe UI", 11F, FontStyle.Bold, GraphicsUnit.Point)
            };
            markerGroup.Controls.Add(markerTitle, 0, 0);
            markerGroup.SetColumnSpan(markerTitle, 3);
            symptom = new ComboBox
            {
                Dock = DockStyle.Fill,
                DropDownStyle = ComboBoxStyle.DropDownList,
                Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point)
            };
            symptom.Items.AddRange(new object[] { "鼠标指针卡顿", "整机卡顿", "应用无响应", "应用崩溃" });
            symptom.SelectedIndex = 0;
            note = new TextBox
            {
                Dock = DockStyle.Fill,
                Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point),
                MaxLength = 300
            };
            var markButton = MakeButton("记录此刻", false);
            markButton.Dock = DockStyle.Fill;
            markButton.Margin = new Padding(8, 0, 0, 0);
            markerGroup.Controls.Add(symptom, 0, 1);
            markerGroup.Controls.Add(note, 1, 1);
            markerGroup.Controls.Add(markButton, 2, 1);
            var snapshotButton = MakeButton("记录当前资源快照", false);
            snapshotButton.Dock = DockStyle.Left;
            snapshotButton.Width = 170;
            snapshotButton.Margin = new Padding(0, 4, 0, 0);
            snapshotButton.Click += delegate { CaptureOnce(); };
            markerGroup.Controls.Add(snapshotButton, 0, 2);
            markerGroup.SetColumnSpan(snapshotButton, 3);
            ComboBox markerSymptom = symptom;
            TextBox markerNote = note;
            markButton.Click += delegate
            {
                string category = markerSymptom.SelectedItem == null ? "unclassified" : markerSymptom.SelectedItem.ToString();
                try
                {
                    store.AppendMarker(DateTime.UtcNow, category, markerNote.Text.Trim());
                    markerNote.Clear();
                    samplingValue.Text = "已记录卡顿";
                    samplingValue.ForeColor = Accent;
                    RefreshHistory();
                }
                catch (Exception exception)
                {
                    ShowDiagnosticError("写入卡顿标记失败", exception);
                }
            };
            panel.Controls.Add(markerGroup, 1, 0);
            return panel;
        }

        private Control BuildProcessSection(out DataGridView grid)
        {
            Control section = BuildSection("占用较高的进程", out grid);
            grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "进程", DataPropertyName = "Name", FillWeight = 24 });
            grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "PID", DataPropertyName = "ProcessId", FillWeight = 9 });
            grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "CPU %", DataPropertyName = "CpuPercent", FillWeight = 12,
                DefaultCellStyle = new DataGridViewCellStyle { Format = "0.0" } });
            grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "专用内存 MB", DataPropertyName = "PrivateMemoryMb", FillWeight = 18 });
            grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "工作集 MB", DataPropertyName = "WorkingSetMb", FillWeight = 16 });
            grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "句柄", DataPropertyName = "HandleCount", FillWeight = 12 });
            grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "线程", DataPropertyName = "ThreadCount", FillWeight = 10 });
            return section;
        }

        private Control BuildHistorySection(out DataGridView grid)
        {
            Control section = BuildSection("本机诊断历史（保留在本地）", out grid);
            grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "时间", DataPropertyName = "TimestampLocal", FillWeight = 24,
                DefaultCellStyle = new DataGridViewCellStyle { Format = "MM-dd HH:mm:ss" } });
            grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "记录", DataPropertyName = "Summary", FillWeight = 76 });
            return section;
        }

        private Control BuildSection(string title, out DataGridView grid)
        {
            var section = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 1,
                RowCount = 2,
                BackColor = Surface,
                Padding = new Padding(12),
                Margin = new Padding(0, 0, 0, 8)
            };
            section.RowStyles.Add(new RowStyle(SizeType.Absolute, 30));
            section.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            var heading = new Label
            {
                Dock = DockStyle.Fill,
                Text = title,
                ForeColor = Ink,
                Font = new Font("Segoe UI", 10F, FontStyle.Bold, GraphicsUnit.Point)
            };
            section.Controls.Add(heading, 0, 0);
            section.Controls.Add(BuildGrid(out grid), 0, 1);
            return section;
        }

        private Control BuildGrid(out DataGridView grid)
        {
            grid = new DataGridView
            {
                Dock = DockStyle.Fill,
                BackgroundColor = Surface,
                BorderStyle = BorderStyle.None,
                GridColor = Border,
                EnableHeadersVisualStyles = false,
                ColumnHeadersDefaultCellStyle = new DataGridViewCellStyle
                {
                    BackColor = Color.FromArgb(246, 249, 253),
                    ForeColor = Muted,
                    Font = new Font("Segoe UI", 8.5F, FontStyle.Bold, GraphicsUnit.Point)
                },
                DefaultCellStyle = new DataGridViewCellStyle
                {
                    BackColor = Surface,
                    ForeColor = Ink,
                    SelectionBackColor = SoftBlue,
                    SelectionForeColor = Ink,
                    Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point),
                    Padding = new Padding(3)
                },
                RowHeadersVisible = false,
                ReadOnly = true,
                AllowUserToAddRows = false,
                AllowUserToDeleteRows = false,
                AllowUserToResizeRows = false,
                MultiSelect = false,
                SelectionMode = DataGridViewSelectionMode.FullRowSelect,
                AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
                AutoGenerateColumns = false
            };
            grid.ColumnHeadersHeight = 32;
            grid.RowTemplate.Height = 30;
            return grid;
        }

        private void AddEventColumns(DataGridView grid)
        {
            grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "时间", DataPropertyName = "TimestampLocal", FillWeight = 20,
                DefaultCellStyle = new DataGridViewCellStyle { Format = "MM-dd HH:mm:ss" } });
            grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "日志", DataPropertyName = "LogName", FillWeight = 10 });
            grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "来源", DataPropertyName = "Source", FillWeight = 17 });
            grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "事件 ID", DataPropertyName = "EventId", FillWeight = 8 });
            grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "级别", DataPropertyName = "Level", FillWeight = 8 });
            grid.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "事件内容", DataPropertyName = "Message", FillWeight = 37,
                DefaultCellStyle = new DataGridViewCellStyle { WrapMode = DataGridViewTriState.True } });
            grid.AutoSizeRowsMode = DataGridViewAutoSizeRowsMode.DisplayedCells;
        }

        private Button MakeButton(string text, bool primary)
        {
            var button = new Button
            {
                Text = text,
                FlatStyle = FlatStyle.Flat,
                BackColor = primary ? Accent : Surface,
                ForeColor = primary ? Color.White : Accent,
                Font = new Font("Segoe UI", 9F, FontStyle.Bold, GraphicsUnit.Point),
                Cursor = Cursors.Hand,
                UseVisualStyleBackColor = false
            };
            button.FlatAppearance.BorderColor = primary ? Accent : Border;
            button.FlatAppearance.BorderSize = 1;
            return button;
        }

        private void StartSampling()
        {
            if (Interlocked.CompareExchange(ref isSampling, 1, 0) != 0) { return; }
            sampleCount = 0;
            samplingWatch.Restart();
            samplingButton.Text = "停止采样";
            samplingButton.BackColor = Color.FromArgb(190, 69, 83);
            samplingButton.FlatAppearance.BorderColor = samplingButton.BackColor;
            samplingDescription.Text = "采样中 · 每 5 秒记录一次，10 分钟后自动停止。";
            samplingValue.Text = "采样中";
            samplingValue.ForeColor = Accent;
            activeTimer = new System.Threading.Timer(SampleTick, null, TimeSpan.Zero, SamplingInterval);
        }

        private void StopSampling()
        {
            Interlocked.Exchange(ref isSampling, 0);
            var timer = activeTimer;
            activeTimer = null;
            if (timer != null) { timer.Dispose(); }
            samplingWatch.Stop();
            if (samplingButton != null && !samplingButton.IsDisposed)
            {
                samplingButton.Text = "开始采样";
                samplingButton.BackColor = Accent;
                samplingButton.FlatAppearance.BorderColor = Accent;
            }
            if (samplingDescription != null && !samplingDescription.IsDisposed)
            {
                samplingDescription.Text = "已结束 · 本次记录 " + sampleCount.ToString(CultureInfo.InvariantCulture) + " 个采样点。";
            }
            if (samplingValue != null && !samplingValue.IsDisposed)
            {
                samplingValue.Text = "已停止";
                samplingValue.ForeColor = Muted;
            }
        }

        private System.Threading.Timer activeTimer;

        private void SampleTick(object state)
        {
            if (Interlocked.CompareExchange(ref isSampling, 0, 0) != 1) { return; }
            if (samplingWatch.Elapsed >= MaximumSession)
            {
                PostToUi(delegate { StopSampling(); });
                return;
            }
            CaptureAndStore(true);
        }

        private void CaptureOnce()
        {
            CaptureAndStore(false);
        }

        private void CaptureAndStore(bool fromSamplingSession)
        {
            if (Interlocked.Exchange(ref sampleInProgress, 1) != 0)
            {
                PostToUi(delegate { samplingValue.Text = "上一采样尚未完成"; });
                return;
            }

            ThreadPool.QueueUserWorkItem(delegate
            {
                try
                {
                    ResourceSnapshot snapshot = collector.Capture();
                    store.AppendSample(snapshot);
                    if (fromSamplingSession) { Interlocked.Increment(ref sampleCount); }
                    PostToUi(delegate { UpdateSnapshot(snapshot); });
                }
                catch (Exception exception)
                {
                    PostToUi(delegate
                    {
                        StopSampling();
                        ShowDiagnosticError("采集系统资源失败", exception);
                    });
                }
                finally
                {
                    Interlocked.Exchange(ref sampleInProgress, 0);
                }
            });
        }

        private void UpdateSnapshot(ResourceSnapshot snapshot)
        {
            cpuValue.Text = snapshot.CpuPercent.ToString("0.0", CultureInfo.InvariantCulture) + "%";
            memoryValue.Text = FormatMemory(Math.Max(0, snapshot.TotalMemoryMb - snapshot.AvailableMemoryMb)) +
                " / " + FormatMemory(snapshot.TotalMemoryMb);
            if (Interlocked.CompareExchange(ref isSampling, 0, 0) == 1)
            {
                samplingValue.Text = "采样中 · " + sampleCount.ToString(CultureInfo.InvariantCulture) + " 点";
                samplingDescription.Text = "下一次采样约 5 秒后 · 最长 10 分钟。";
            }
            processGrid.DataSource = null;
            processGrid.DataSource = new BindingList<ProcessResourceSnapshot>(new List<ProcessResourceSnapshot>(snapshot.Processes));
            footerLabel.Text = "最近采样：" + snapshot.TimestampUtc.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss") +
                "　·　记录：" + store.LogDirectory + "　·　只读诊断，不会结束进程或更改系统设置";
            RefreshHistory();
        }

        private void RefreshHistory()
        {
            IList<DiagnosticHistoryEntry> entries = store.ReadRecentEntries(30);
            var ordered = new List<DiagnosticHistoryEntry>(entries);
            ordered.Reverse();
            historyGrid.DataSource = null;
            historyGrid.DataSource = new BindingList<DiagnosticHistoryEntry>(ordered);
        }

        private void RefreshSystemEvents()
        {
            eventStatus.Text = "正在只读查询最近 14 天的 Application / System 警告和错误…";
            ThreadPool.QueueUserWorkItem(delegate
            {
                IList<WindowsEventSummary> events = WindowsEventLogReader.ReadRecent(14, 100);
                PostToUi(delegate
                {
                    eventGrid.DataSource = null;
                    eventGrid.DataSource = new BindingList<WindowsEventSummary>(new List<WindowsEventSummary>(events));
                    eventStatus.Text = "找到 " + events.Count.ToString(CultureInfo.InvariantCulture) +
                        " 条事件。Windows 事件日志可能会按系统策略轮转；此处不会删除或修改事件。";
                });
            });
        }

        private void PostToUi(MethodInvoker action)
        {
            if (IsDisposed || !IsHandleCreated) { return; }
            try { BeginInvoke(action); }
            catch (InvalidOperationException) { }
        }

        private void ShowDiagnosticError(string title, Exception exception)
        {
            MessageBox.Show(this, title + "：\r\n" + exception.Message, "系统稳定性诊断",
                MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }

        private static string FormatMemory(long megabytes)
        {
            return (megabytes / 1024.0).ToString("0.0", CultureInfo.InvariantCulture) + " GB";
        }
    }
}
