using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Management;
using System.Net.NetworkInformation;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

namespace ToolHub.App
{
    internal enum DshWebState
    {
        Unknown,
        Stopped,
        Running,
        Multiple
    }

    internal sealed class DshWebStatus
    {
        public DshWebStatus(DshWebState state, int processId, int port, bool hasLaunchUrl, string message)
            : this(state, processId, port, "127.0.0.1", hasLaunchUrl, message)
        {
        }

        public DshWebStatus(DshWebState state, int processId, int port, string host, bool hasLaunchUrl, string message)
        {
            State = state;
            ProcessId = processId;
            Port = port;
            Host = host ?? string.Empty;
            HasLaunchUrl = hasLaunchUrl;
            Message = message ?? string.Empty;
        }

        public DshWebState State { get; private set; }
        public int ProcessId { get; private set; }
        public int Port { get; private set; }
        public string Host { get; private set; }
        public bool HasLaunchUrl { get; private set; }
        public string Message { get; private set; }
    }

    internal sealed class DshWebActionResult
    {
        public DshWebActionResult(bool succeeded, bool needsRestart, string message)
        {
            Succeeded = succeeded;
            NeedsRestart = needsRestart;
            Message = message ?? string.Empty;
        }

        public bool Succeeded { get; private set; }
        public bool NeedsRestart { get; private set; }
        public string Message { get; private set; }
    }

    internal sealed class DshWebHostResponse
    {
        public DshWebHostResponse(DshWebStatus status, DshWebActionResult result)
        {
            Status = status;
            Result = result;
        }

        public DshWebStatus Status { get; private set; }
        public DshWebActionResult Result { get; private set; }
    }

    internal sealed class DshWebController : IDisposable
    {
        private const int DefaultPort = 3080;
        private const string DefaultHost = "127.0.0.1";
        private readonly object stateLock = new object();
        private readonly AutoResetEvent launchUrlReady = new AutoResetEvent(false);
        private Process managedProcess;
        private int managedProcessId;
        private string managedLaunchUrl;

        public DshWebStatus GetStatus()
        {
            try
            {
                IList<DshProcessInfo> processes = FindRunningDshProcesses();
                if (processes.Count == 0)
                {
                    return new DshWebStatus(DshWebState.Stopped, 0, DefaultPort, false, "DSH Web 已停止");
                }

                if (processes.Count > 1)
                {
                    return new DshWebStatus(DshWebState.Multiple, 0, 0, false, "检测到多个 DSH Web 实例");
                }

                DshProcessInfo process = processes[0];
                bool hasLaunchUrl = HasLaunchUrlFor(process.ProcessId);
                return new DshWebStatus(
                    DshWebState.Running,
                    process.ProcessId,
                    process.Configuration.Port,
                    process.Configuration.Host,
                    hasLaunchUrl,
                    "DSH Web 正在运行");
            }
            catch (Exception exception)
            {
                return new DshWebStatus(
                    DshWebState.Unknown,
                    0,
                    DefaultPort,
                    false,
                    "无法检测 DSH：" + exception.Message);
            }
        }

        public bool HasLiveManagedProcess()
        {
            lock (stateLock)
            {
                if (managedProcess == null || managedProcessId <= 0)
                {
                    return false;
                }

                try
                {
                    return !managedProcess.HasExited;
                }
                catch (InvalidOperationException)
                {
                    return false;
                }
                catch (System.ComponentModel.Win32Exception)
                {
                    return false;
                }
            }
        }

        public DshWebActionResult Execute(string command)
        {
            if (string.Equals(command, "STATUS", StringComparison.OrdinalIgnoreCase))
            {
                return new DshWebActionResult(true, false, string.Empty);
            }
            if (string.Equals(command, "START", StringComparison.OrdinalIgnoreCase))
            {
                return StartService();
            }
            if (string.Equals(command, "PAUSE", StringComparison.OrdinalIgnoreCase))
            {
                return StopService();
            }
            if (string.Equals(command, "RESTART", StringComparison.OrdinalIgnoreCase))
            {
                return RestartService();
            }
            if (string.Equals(command, "OPEN", StringComparison.OrdinalIgnoreCase))
            {
                return OpenInBrowser();
            }
            if (string.Equals(command, "RESTART_OPEN", StringComparison.OrdinalIgnoreCase))
            {
                DshWebActionResult restart = RestartService();
                return restart.Succeeded ? OpenInBrowser() : restart;
            }

            return new DshWebActionResult(false, false, "不支持的 DSH 操作");
        }

        private DshWebActionResult StartService()
        {
            return StartService(null);
        }

        private DshWebActionResult StartService(DshLaunchConfiguration configuration)
        {
            DshWebStatus status = GetStatus();
            if (status.State == DshWebState.Unknown)
            {
                return new DshWebActionResult(false, false, status.Message);
            }
            if (status.State == DshWebState.Multiple)
            {
                return new DshWebActionResult(false, false, status.Message + "，为避免误停服务，无法启动或控制");
            }
            if (status.State == DshWebState.Running)
            {
                return new DshWebActionResult(true, false, "DSH Web 已经在运行");
            }
            if (configuration == null)
            {
                DshInstall install = FindDshInstall();
                if (install == null)
                {
                    return new DshWebActionResult(false, false,
                        "找不到 DSH 命令。请确认 dsh.ps1 和 DSH 安装目录位于当前用户的 PATH 中");
                }

                configuration = new DshLaunchConfiguration(
                    install.NodePath,
                    install.EntryScript,
                    install.WorkingDirectory,
                    new[] { "web", "--host", DefaultHost, "--port", DefaultPort.ToString(), "--no-open" },
                    DefaultHost,
                    DefaultPort,
                    true,
                    string.Empty);
            }
            if (!configuration.Restartable)
            {
                return new DshWebActionResult(false, false,
                    "无法安全重启当前 DSH 参数：" + configuration.RestartError);
            }
            if (IsPortListening(configuration.Port))
            {
                return new DshWebActionResult(false, false,
                    configuration.Port.ToString() + " 端口正被其他应用占用。ToolHub 已保留该进程，没有对它执行停止操作");
            }

            Process process = new Process();
            process.StartInfo = new ProcessStartInfo
            {
                FileName = configuration.NodePath,
                Arguments = BuildCommandLineArguments(configuration.EntryScript, configuration.Arguments),
                WorkingDirectory = configuration.WorkingDirectory,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };
            process.OutputDataReceived += OnDshOutput;
            process.ErrorDataReceived += delegate { };

            try
            {
                lock (stateLock)
                {
                    managedLaunchUrl = null;
                    managedProcessId = 0;
                }
                launchUrlReady.Reset();

                if (!process.Start())
                {
                    process.Dispose();
                    return new DshWebActionResult(false, false, "DSH Web 进程没有启动");
                }

                lock (stateLock)
                {
                    managedProcess = process;
                    managedProcessId = process.Id;
                }
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();

                DateTime deadline = DateTime.UtcNow.AddSeconds(25);
                while (DateTime.UtcNow < deadline)
                {
                    if (launchUrlReady.WaitOne(250))
                    {
                        return new DshWebActionResult(true, false, "DSH Web 已启动，浏览器认证链接已就绪");
                    }

                    if (process.HasExited)
                    {
                        return new DshWebActionResult(false, false,
                            "DSH Web 启动后立即退出，退出代码：" + process.ExitCode.ToString());
                    }
                }

                return new DshWebActionResult(false, false,
                    "DSH Web 进程仍在运行，但没有收到启动链接。可重启一次后再打开界面");
            }
            catch (Exception exception)
            {
                try
                {
                    if (process.HasExited)
                    {
                        process.Dispose();
                    }
                }
                catch (InvalidOperationException)
                {
                }
                return new DshWebActionResult(false, false, "启动 DSH Web 失败：" + exception.Message);
            }
        }

        private void OnDshOutput(object sender, DataReceivedEventArgs eventArgs)
        {
            if (string.IsNullOrEmpty(eventArgs.Data))
            {
                return;
            }

            Match match = Regex.Match(eventArgs.Data, @"dsh web:\s*(https?://\S+)", RegexOptions.IgnoreCase);
            if (!match.Success)
            {
                return;
            }

            string launchUrl = match.Groups[1].Value.TrimEnd('.', ',', ';', ')');
            lock (stateLock)
            {
                managedLaunchUrl = launchUrl;
            }
            launchUrlReady.Set();
        }

        private DshWebActionResult StopService()
        {
            DshWebStatus status = GetStatus();
            if (status.State == DshWebState.Unknown)
            {
                return new DshWebActionResult(false, false, status.Message);
            }
            if (status.State == DshWebState.Multiple)
            {
                return new DshWebActionResult(false, false, status.Message + "，为避免误停服务，无法控制");
            }
            if (status.State == DshWebState.Stopped)
            {
                return new DshWebActionResult(true, false, "DSH Web 已经停止");
            }

            try
            {
                DshProcessInfo process = FindDshProcess(status.ProcessId);
                if (process == null || !StopVerifiedProcess(process))
                {
                    return new DshWebActionResult(false, false, "没有停止已识别的 DSH Web 进程，请刷新状态后重试");
                }

                lock (stateLock)
                {
                    if (managedProcessId == status.ProcessId)
                    {
                        managedLaunchUrl = null;
                    }
                }
                return new DshWebActionResult(true, false, "DSH Web 已停止");
            }
            catch (Exception exception)
            {
                return new DshWebActionResult(false, false, "停止 DSH Web 失败：" + exception.Message);
            }
        }

        private DshWebActionResult RestartService()
        {
            DshWebStatus status = GetStatus();
            if (status.State == DshWebState.Unknown)
            {
                return new DshWebActionResult(false, false, status.Message);
            }
            if (status.State == DshWebState.Multiple)
            {
                return new DshWebActionResult(false, false, status.Message + "，为避免误停服务，无法重启");
            }
            DshLaunchConfiguration configuration = null;
            if (status.State == DshWebState.Running)
            {
                DshProcessInfo process = FindDshProcess(status.ProcessId);
                if (process == null || process.Configuration == null)
                {
                    return new DshWebActionResult(false, false,
                        "无法安全读取当前 DSH 启动参数，服务未停止");
                }
                configuration = process.Configuration;
                if (!configuration.Restartable)
                {
                    return new DshWebActionResult(false, false,
                        "无法安全重启当前 DSH 参数：" + configuration.RestartError + "。服务未停止");
                }

                DshWebActionResult stopped = StopService();
                if (!stopped.Succeeded)
                {
                    return stopped;
                }
            }

            return StartService(configuration);
        }

        private DshWebActionResult OpenInBrowser()
        {
            DshWebStatus status = GetStatus();
            if (status.State == DshWebState.Unknown)
            {
                return new DshWebActionResult(false, false, status.Message);
            }
            if (status.State == DshWebState.Multiple)
            {
                return new DshWebActionResult(false, false, status.Message + "，无法确定要打开哪个实例");
            }
            if (status.State == DshWebState.Stopped)
            {
                return new DshWebActionResult(false, false, "DSH Web 当前未运行，请先启动服务");
            }

            string launchUrl = GetLaunchUrl(status.ProcessId);
            if (string.IsNullOrWhiteSpace(launchUrl))
            {
                return new DshWebActionResult(false, true,
                    "当前 DSH 由其他方式启动，ToolHub 没有它的启动认证链接");
            }

            try
            {
                Process.Start(new ProcessStartInfo(launchUrl) { UseShellExecute = true });
                return new DshWebActionResult(true, false, "已在默认浏览器打开 DSH");
            }
            catch (Exception exception)
            {
                return new DshWebActionResult(false, false, "打开默认浏览器失败：" + exception.Message);
            }
        }

        private bool StopVerifiedProcess(DshProcessInfo expected)
        {
            IList<DshProcessInfo> processes = FindRunningDshProcesses();
            DshProcessInfo verified = null;
            foreach (DshProcessInfo process in processes)
            {
                if (process.ProcessId == expected.ProcessId)
                {
                    verified = process;
                    break;
                }
            }

            if (verified == null)
            {
                return processes.Count == 0;
            }
            if (verified.StartTimeUtc.Ticks != expected.StartTimeUtc.Ticks ||
                !string.Equals(verified.CommandLine, expected.CommandLine, StringComparison.Ordinal))
            {
                return false;
            }

            try
            {
                using (Process target = Process.GetProcessById(expected.ProcessId))
                {
                    if (target.StartTime.ToUniversalTime().Ticks != expected.StartTimeUtc.Ticks)
                    {
                        return false;
                    }

                    IList<DshProcessInfo> latest = FindRunningDshProcesses();
                    DshProcessInfo latestMatch = null;
                    foreach (DshProcessInfo process in latest)
                    {
                        if (process.ProcessId == expected.ProcessId)
                        {
                            latestMatch = process;
                            break;
                        }
                    }

                    if (latestMatch == null || latestMatch.StartTimeUtc.Ticks != expected.StartTimeUtc.Ticks ||
                        !string.Equals(latestMatch.CommandLine, expected.CommandLine, StringComparison.Ordinal))
                    {
                        return false;
                    }

                    target.Kill();
                    if (!target.WaitForExit(10000))
                    {
                        return false;
                    }
                }
            }
            catch (ArgumentException)
            {
                return FindRunningDshProcesses().Count == 0;
            }

            DateTime deadline = DateTime.UtcNow.AddSeconds(8);
            while (DateTime.UtcNow < deadline)
            {
                IList<DshProcessInfo> remaining = FindRunningDshProcesses();
                if (remaining.Count == 0)
                {
                    return true;
                }

                if (remaining.Count > 0)
                {
                    return false;
                }
                Thread.Sleep(200);
            }

            return false;
        }

        private static IList<DshProcessInfo> FindRunningDshProcesses()
        {
            var matches = new List<DshProcessInfo>();
            // WMI command-line reads are slow across all Node processes; narrow to DSH's scoped package first.
            using (var searcher = new ManagementObjectSearcher(
                "SELECT ProcessId, CommandLine, ExecutablePath FROM Win32_Process " +
                "WHERE Name='node.exe' AND CommandLine LIKE '%@deepseek-ai%'"))
            using (ManagementObjectCollection processes = searcher.Get())
            {
                foreach (ManagementObject item in processes)
                {
                    using (item)
                    {
                        string commandLine = item["CommandLine"] as string;
                        string executablePath = item["ExecutablePath"] as string;
                        DshLaunchConfiguration configuration;
                        if (!TryParseDshWebCommandLine(executablePath, commandLine, out configuration))
                        {
                            continue;
                        }

                        int processId = Convert.ToInt32(item["ProcessId"]);
                        try
                        {
                            using (Process process = Process.GetProcessById(processId))
                            {
                                DateTime startTimeUtc = process.StartTime.ToUniversalTime();
                                matches.Add(new DshProcessInfo(processId, startTimeUtc, commandLine, configuration));
                            }
                        }
                        catch (ArgumentException)
                        {
                            // The process exited between the WMI snapshot and opening its process handle.
                        }
                    }
                }
            }

            return matches;
        }

        private static DshProcessInfo FindDshProcess(int processId)
        {
            IList<DshProcessInfo> processes = FindRunningDshProcesses();
            foreach (DshProcessInfo process in processes)
            {
                if (process.ProcessId == processId)
                {
                    return process;
                }
            }
            return null;
        }

        private static bool TryParseDshWebCommandLine(
            string executablePath,
            string commandLine,
            out DshLaunchConfiguration configuration)
        {
            configuration = null;
            if (string.IsNullOrWhiteSpace(executablePath) || string.IsNullOrWhiteSpace(commandLine))
            {
                return false;
            }

            string[] commandArguments;
            try
            {
                commandArguments = SplitWindowsCommandLine(commandLine);
            }
            catch
            {
                return false;
            }
            if (commandArguments.Length < 3 || !IsNodeExecutable(executablePath) ||
                !IsNodeExecutable(commandArguments[0]) || !IsDshEntryScript(commandArguments[1]))
            {
                return false;
            }

            var webArguments = new List<string>();
            for (int index = 2; index < commandArguments.Length; index++)
            {
                webArguments.Add(commandArguments[index]);
            }

            // DSH documents `dsh --profile web` as equivalent to `dsh web`.
            bool isWebCommand = string.Equals(webArguments[0], "web", StringComparison.OrdinalIgnoreCase) ||
                (webArguments.Count >= 2 && string.Equals(webArguments[0], "--profile", StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(webArguments[1], "web", StringComparison.OrdinalIgnoreCase)) ||
                string.Equals(webArguments[0], "--profile=web", StringComparison.OrdinalIgnoreCase);
            if (!isWebCommand)
            {
                return false;
            }
            if (IsOneShotDshInvocation(webArguments))
            {
                return false;
            }

            string host = DefaultHost;
            int port = DefaultPort;
            bool restartable = true;
            string restartError = string.Empty;
            for (int index = 0; index < webArguments.Count; index++)
            {
                string argument = webArguments[index] ?? string.Empty;
                string value = null;
                if (argument.StartsWith("--host=", StringComparison.OrdinalIgnoreCase))
                {
                    value = argument.Substring("--host=".Length);
                }
                else if (string.Equals(argument, "--host", StringComparison.OrdinalIgnoreCase))
                {
                    if (++index < webArguments.Count)
                    {
                        value = webArguments[index];
                    }
                }
                if (value != null || string.Equals(argument, "--host", StringComparison.OrdinalIgnoreCase))
                {
                    if (!IsSafeHost(value))
                    {
                        restartable = false;
                        restartError = "host 参数缺失或无效";
                    }
                    else
                    {
                        host = value;
                    }
                    continue;
                }

                value = null;
                if (argument.StartsWith("--port=", StringComparison.OrdinalIgnoreCase))
                {
                    value = argument.Substring("--port=".Length);
                }
                else if (string.Equals(argument, "--port", StringComparison.OrdinalIgnoreCase))
                {
                    if (++index < webArguments.Count)
                    {
                        value = webArguments[index];
                    }
                }
                if (value != null || string.Equals(argument, "--port", StringComparison.OrdinalIgnoreCase))
                {
                    int parsedPort;
                    if (!int.TryParse(value, out parsedPort) || parsedPort < 1 || parsedPort > 65535)
                    {
                        restartable = false;
                        restartError = "port 参数缺失或超出有效范围";
                    }
                    else
                    {
                        port = parsedPort;
                    }
                }
            }

            configuration = new DshLaunchConfiguration(
                executablePath,
                commandArguments[1],
                Path.GetDirectoryName(commandArguments[1]),
                webArguments,
                host,
                port,
                restartable,
                restartError);
            return true;
        }

        private bool HasLaunchUrlFor(int processId)
        {
            lock (stateLock)
            {
                return managedProcessId == processId && !string.IsNullOrWhiteSpace(managedLaunchUrl);
            }
        }

        private string GetLaunchUrl(int processId)
        {
            lock (stateLock)
            {
                return managedProcessId == processId ? managedLaunchUrl : null;
            }
        }

        private static bool IsPortListening(int port)
        {
            foreach (System.Net.IPEndPoint endpoint in IPGlobalProperties.GetIPGlobalProperties().GetActiveTcpListeners())
            {
                if (endpoint.Port == port)
                {
                    return true;
                }
            }
            return false;
        }

        private static DshInstall FindDshInstall()
        {
            string pathValue = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
            string[] directories = pathValue.Split(Path.PathSeparator);
            string fallbackNode = FindOnPath("node.exe", directories);

            foreach (string pathDirectory in directories)
            {
                string directory = (pathDirectory ?? string.Empty).Trim().Trim('"');
                if (directory.Length == 0 || !Directory.Exists(directory))
                {
                    continue;
                }

                string shim = Path.Combine(directory, "dsh.ps1");
                if (!File.Exists(shim))
                {
                    continue;
                }

                string entryScript = Path.Combine(directory, "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
                if (!File.Exists(entryScript))
                {
                    continue;
                }

                string localNode = Path.Combine(directory, "node.exe");
                string nodePath = File.Exists(localNode) ? localNode : fallbackNode;
                if (!string.IsNullOrWhiteSpace(nodePath) && File.Exists(nodePath))
                {
                    return new DshInstall(nodePath, entryScript, directory);
                }
            }

            return null;
        }

        private static string FindOnPath(string fileName, IEnumerable<string> directories)
        {
            foreach (string pathDirectory in directories)
            {
                string directory = (pathDirectory ?? string.Empty).Trim().Trim('"');
                if (directory.Length == 0 || !Directory.Exists(directory))
                {
                    continue;
                }

                string candidate = Path.Combine(directory, fileName);
                if (File.Exists(candidate))
                {
                    return candidate;
                }
            }

            return null;
        }

        private static string QuoteArgument(string argument)
        {
            string value = argument ?? string.Empty;
            var quoted = new StringBuilder("\"");
            int backslashes = 0;
            foreach (char character in value)
            {
                if (character == '\\')
                {
                    backslashes++;
                    continue;
                }

                if (character == '"')
                {
                    quoted.Append('\\', backslashes * 2 + 1);
                    quoted.Append('"');
                    backslashes = 0;
                    continue;
                }

                quoted.Append('\\', backslashes);
                quoted.Append(character);
                backslashes = 0;
            }

            quoted.Append('\\', backslashes * 2);
            quoted.Append('"');
            return quoted.ToString();
        }

        private static string BuildCommandLineArguments(string entryScript, IList<string> arguments)
        {
            var commandLine = new StringBuilder(QuoteArgument(entryScript));
            foreach (string argument in arguments)
            {
                commandLine.Append(' ');
                commandLine.Append(QuoteArgument(argument));
            }
            return commandLine.ToString();
        }

        private static bool IsNodeExecutable(string path)
        {
            string fileName;
            try
            {
                fileName = Path.GetFileName(path ?? string.Empty);
            }
            catch (ArgumentException)
            {
                return false;
            }
            return string.Equals(fileName, "node.exe", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(fileName, "node", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsDshEntryScript(string path)
        {
            try
            {
                string normalized = Path.GetFullPath(path).Replace('/', '\\').TrimEnd('\\');
                return normalized.EndsWith(
                    "\\node_modules\\@deepseek-ai\\dsh\\lib\\bin.js",
                    StringComparison.OrdinalIgnoreCase);
            }
            catch (Exception)
            {
                return false;
            }
        }

        private static bool IsSafeHost(string host)
        {
            if (string.IsNullOrWhiteSpace(host) || host.Length > 253 ||
                host.IndexOfAny(new[] { ' ', '\t', '\r', '\n', '\0' }) >= 0 || host.StartsWith("-", StringComparison.Ordinal))
            {
                return false;
            }

            IPAddress address;
            return IPAddress.TryParse(host, out address) || Uri.CheckHostName(host) != UriHostNameType.Unknown;
        }

        private static bool IsOneShotDshInvocation(IList<string> arguments)
        {
            foreach (string argument in arguments)
            {
                if (string.Equals(argument, "-h", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(argument, "--help", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(argument, "-V", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(argument, "--version", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(argument, "--dump-config", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(argument, "--dump-default-config", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(argument, "--dump-config-schema", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
            return false;
        }

        internal static string[] SplitWindowsCommandLine(string commandLine)
        {
            int argumentCount;
            IntPtr argumentVector = CommandLineToArgvW(commandLine, out argumentCount);
            if (argumentVector == IntPtr.Zero)
            {
                throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
            }

            try
            {
                var arguments = new string[argumentCount];
                for (int index = 0; index < argumentCount; index++)
                {
                    IntPtr argumentPointer = Marshal.ReadIntPtr(argumentVector, index * IntPtr.Size);
                    arguments[index] = Marshal.PtrToStringUni(argumentPointer) ?? string.Empty;
                }
                return arguments;
            }
            finally
            {
                LocalFree(argumentVector);
            }
        }

        [DllImport("shell32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern IntPtr CommandLineToArgvW(string commandLine, out int argumentCount);

        [DllImport("kernel32.dll")]
        private static extern IntPtr LocalFree(IntPtr memory);

        public void Dispose()
        {
            bool managedProcessIsRunning = false;
            lock (stateLock)
            {
                if (managedProcess != null)
                {
                    try
                    {
                        managedProcessIsRunning = !managedProcess.HasExited;
                        if (!managedProcessIsRunning)
                        {
                            managedProcess.Dispose();
                            managedProcess = null;
                        }
                    }
                    catch (InvalidOperationException)
                    {
                        managedProcess.Dispose();
                        managedProcess = null;
                    }
                    catch (System.ComponentModel.Win32Exception)
                    {
                        managedProcessIsRunning = true;
                    }
                }
            }
            if (!managedProcessIsRunning)
            {
                launchUrlReady.Dispose();
            }
        }

        private sealed class DshProcessInfo
        {
            public DshProcessInfo(
                int processId,
                DateTime startTimeUtc,
                string commandLine,
                DshLaunchConfiguration configuration)
            {
                ProcessId = processId;
                StartTimeUtc = startTimeUtc;
                CommandLine = commandLine;
                Configuration = configuration;
            }

            public int ProcessId { get; private set; }
            public DateTime StartTimeUtc { get; private set; }
            public string CommandLine { get; private set; }
            public DshLaunchConfiguration Configuration { get; private set; }
        }

        private sealed class DshLaunchConfiguration
        {
            public DshLaunchConfiguration(
                string nodePath,
                string entryScript,
                string workingDirectory,
                IEnumerable<string> arguments,
                string host,
                int port,
                bool restartable,
                string restartError)
            {
                NodePath = nodePath;
                EntryScript = entryScript;
                WorkingDirectory = workingDirectory;
                Arguments = new List<string>(arguments).AsReadOnly();
                Host = host;
                Port = port;
                Restartable = restartable;
                RestartError = restartError ?? string.Empty;
            }

            public string NodePath { get; private set; }
            public string EntryScript { get; private set; }
            public string WorkingDirectory { get; private set; }
            public IList<string> Arguments { get; private set; }
            public string Host { get; private set; }
            public int Port { get; private set; }
            public bool Restartable { get; private set; }
            public string RestartError { get; private set; }
        }

        private sealed class DshInstall
        {
            public DshInstall(string nodePath, string entryScript, string workingDirectory)
            {
                NodePath = nodePath;
                EntryScript = entryScript;
                WorkingDirectory = workingDirectory;
            }

            public string NodePath { get; private set; }
            public string EntryScript { get; private set; }
            public string WorkingDirectory { get; private set; }
        }
    }

    internal static class DshWebHost
    {
        private static readonly int SessionId = Process.GetCurrentProcess().SessionId;
        private static readonly string BuildIdentity = Path.GetFileNameWithoutExtension(ToolHubBuildInfo.DshHostFileName);
        internal static readonly string PipeName = "WindowsToolHub.DshWebHost." + BuildIdentity + "." + SessionId.ToString();
        private static readonly string MutexName = "Local\\WindowsToolHub.DshWebHost.SingleInstance." + BuildIdentity + "." + SessionId.ToString();
        private static readonly UTF8Encoding Utf8 = new UTF8Encoding(false);

        public static void Run()
        {
            bool createdNew;
            using (Mutex mutex = new Mutex(true, MutexName, out createdNew))
            {
                if (!createdNew)
                {
                    return;
                }

                using (var controller = new DshWebController())
                {
                    DateTime lastRequest = DateTime.UtcNow;
                    try
                    {
                        while (true)
                        {
                            try
                            {
                                using (var pipe = new NamedPipeServerStream(
                                    PipeName,
                                    PipeDirection.InOut,
                                    1,
                                    PipeTransmissionMode.Byte,
                                    PipeOptions.Asynchronous))
                                {
                                    IAsyncResult pending = pipe.BeginWaitForConnection(null, null);
                                    bool connected;
                                    using (WaitHandle waitHandle = pending.AsyncWaitHandle)
                                    {
                                        connected = waitHandle.WaitOne(3000);
                                        if (!connected)
                                        {
                                            connected = CancelPendingConnection(pipe, pending, waitHandle);
                                        }
                                        else
                                        {
                                            pipe.EndWaitForConnection(pending);
                                        }
                                    }

                                    if (!connected)
                                    {
                                        if (!controller.HasLiveManagedProcess() &&
                                            DateTime.UtcNow - lastRequest > TimeSpan.FromSeconds(30))
                                        {
                                            break;
                                        }
                                        continue;
                                    }

                                    lastRequest = DateTime.UtcNow;
                                    string command = DshPipeProtocol.ReadLine(pipe, 64, TimeSpan.FromSeconds(5));
                                    if (command == null)
                                    {
                                        throw new IOException("DSH 控制请求为空");
                                    }
                                    DshWebActionResult actionResult = controller.Execute(command);
                                    DshWebStatus status = controller.GetStatus();
                                    string response = Serialize(status, actionResult);
                                    DshPipeProtocol.WriteLine(pipe, response, 16384, TimeSpan.FromSeconds(5));
                                }
                            }
                            catch (IOException exception)
                            {
                                File.AppendAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "dsh-debug.log"), "IO: " + exception.ToString() + Environment.NewLine);
                            }
                            catch (Exception exception)
                            {
                                File.AppendAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "dsh-debug.log"), "ANY: " + exception.ToString() + Environment.NewLine);
                                if (!controller.HasLiveManagedProcess() &&
                                    DateTime.UtcNow - lastRequest > TimeSpan.FromSeconds(30))
                                {
                                    break;
                                }
                                Thread.Sleep(250);
                            }
                        }
                    }
                    finally
                    {
                        if (createdNew)
                        {
                            mutex.ReleaseMutex();
                        }
                    }
                }
            }
        }

        private static bool CancelPendingConnection(
            NamedPipeServerStream pipe,
            IAsyncResult pending,
            WaitHandle waitHandle)
        {
            // Do not dispose the APM wait handle while its native callback can still signal it.
            CancelIoEx(pipe.SafePipeHandle, IntPtr.Zero);
            waitHandle.WaitOne();

            try
            {
                pipe.EndWaitForConnection(pending);
                return true;
            }
            catch (IOException)
            {
                return false;
            }
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool CancelIoEx(
            Microsoft.Win32.SafeHandles.SafePipeHandle fileHandle,
            IntPtr overlapped);

        private static string Serialize(DshWebStatus status, DshWebActionResult result)
        {
            return string.Join("\t", new[]
            {
                status.State.ToString(),
                status.ProcessId.ToString(),
                status.Port.ToString(),
                Encode(status.Host),
                status.HasLaunchUrl ? "1" : "0",
                result.Succeeded ? "1" : "0",
                result.NeedsRestart ? "1" : "0",
                Encode(result.Message),
                Encode(status.Message)
            });
        }

        private static string Encode(string value)
        {
            return Convert.ToBase64String(Utf8.GetBytes(value ?? string.Empty));
        }
    }

    internal static class DshPipeProtocol
    {
        private static readonly UTF8Encoding Utf8 = new UTF8Encoding(false, true);

        public static string ReadLine(Stream stream, int maximumBytes, TimeSpan timeout)
        {
            DateTime deadline = DateTime.UtcNow.Add(timeout);
            using (var data = new MemoryStream())
            {
                byte[] buffer = new byte[512];
                while (data.Length <= maximumBytes)
                {
                    IAsyncResult pending = stream.BeginRead(buffer, 0, buffer.Length, null, null);
                    int remaining = RemainingMilliseconds(deadline);
                    if (remaining <= 0 || !WaitForIo(pending, remaining))
                    {
                        AbortPendingRead(stream, pending);
                        throw new TimeoutException("DSH 管道请求读取超时");
                    }

                    int count = stream.EndRead(pending);
                    if (count <= 0)
                    {
                        if (data.Length == 0)
                        {
                            return null;
                        }
                        throw new IOException("DSH 管道数据在换行符前结束");
                    }

                    int newline = Array.IndexOf(buffer, (byte)'\n', 0, count);
                    int appendCount = newline >= 0 ? newline : count;
                    if (data.Length + appendCount > maximumBytes)
                    {
                        throw new IOException("DSH 管道消息超过允许长度");
                    }
                    data.Write(buffer, 0, appendCount);

                    if (newline >= 0)
                    {
                        if (newline != count - 1)
                        {
                            throw new IOException("DSH 管道包含多余数据");
                        }

                        byte[] bytes = data.ToArray();
                        int length = bytes.Length;
                        if (length > 0 && bytes[length - 1] == (byte)'\r')
                        {
                            length--;
                        }
                        return Utf8.GetString(bytes, 0, length);
                    }
                }
            }
            throw new IOException("DSH 管道消息超过允许长度");
        }

        public static void WriteLine(Stream stream, string value, int maximumBytes, TimeSpan timeout)
        {
            byte[] line = Utf8.GetBytes((value ?? string.Empty) + "\n");
            if (line.Length > maximumBytes)
            {
                throw new IOException("DSH 管道消息超过允许长度");
            }

            IAsyncResult pending = stream.BeginWrite(line, 0, line.Length, null, null);
            int remaining = RemainingMilliseconds(DateTime.UtcNow.Add(timeout));
            if (remaining <= 0 || !WaitForIo(pending, remaining))
            {
                try
                {
                    stream.Dispose();
                }
                catch (IOException)
                {
                }
                try
                {
                    stream.EndWrite(pending);
                }
                catch (Exception)
                {
                }
                throw new TimeoutException("DSH 管道响应写入超时");
            }
            stream.EndWrite(pending);
        }

        private static int RemainingMilliseconds(DateTime deadline)
        {
            double remaining = (deadline - DateTime.UtcNow).TotalMilliseconds;
            return remaining <= 0 ? 0 : (int)Math.Min(int.MaxValue, Math.Ceiling(remaining));
        }

        private static bool WaitForIo(IAsyncResult pending, int timeoutMilliseconds)
        {
            using (WaitHandle waitHandle = pending.AsyncWaitHandle)
            {
                return waitHandle.WaitOne(timeoutMilliseconds);
            }
        }

        private static void AbortPendingRead(Stream stream, IAsyncResult pending)
        {
            try
            {
                stream.Dispose();
            }
            catch (IOException)
            {
            }
            try
            {
                pending.AsyncWaitHandle.WaitOne(250);
                stream.EndRead(pending);
            }
            catch (Exception)
            {
            }
        }
    }

    internal static class DshWebHostClient
    {
        private static readonly UTF8Encoding Utf8 = new UTF8Encoding(false);

        public static DshWebHostResponse Request(string command)
        {
            Exception lastException = null;
            for (int attempt = 0; attempt < 2; attempt++)
            {
                try
                {
                    DshWebHostResponse response = RequestPipe(DshWebHost.PipeName, command);
                    if (string.Equals(command, "OPEN", StringComparison.OrdinalIgnoreCase) &&
                        response.Result.NeedsRestart)
                    {
                        DshWebHostResponse legacyResponse = TryRequestLegacyOpen();
                        if (legacyResponse != null)
                        {
                            return legacyResponse;
                        }
                    }
                    return response;
                }
                catch (Exception exception)
                {
                    lastException = exception;
                    if (attempt == 0)
                    {
                        StartHost();
                        Thread.Sleep(150);
                    }
                }
            }

            if (string.Equals(command, "OPEN", StringComparison.OrdinalIgnoreCase))
            {
                DshWebHostResponse legacyResponse = TryRequestLegacyOpen();
                if (legacyResponse != null)
                {
                    return legacyResponse;
                }
            }

            throw new InvalidOperationException("无法连接 DSH 后台服务：" +
                (lastException == null ? "未知错误" : lastException.Message), lastException);
        }

        private static DshWebHostResponse TryRequestLegacyOpen()
        {
            try
            {
                int legacyHostProcessId;
                if (!TryFindLegacyHostInCurrentSession(out legacyHostProcessId))
                {
                    return null;
                }
                string sessionSuffix = Process.GetCurrentProcess().SessionId.ToString();
                string[] legacyPipeNames =
                {
                    "WindowsToolHub.DshWebHost.v1." + sessionSuffix,
                    "WindowsToolHub.DshWebHost.v1"
                };
                foreach (string pipeName in legacyPipeNames)
                {
                    try
                    {
                        DshWebHostResponse response = RequestPipe(pipeName, "OPEN", legacyHostProcessId);
                        if (response.Result.Succeeded && !response.Result.NeedsRestart)
                        {
                            return response;
                        }
                    }
                    catch (Exception)
                    {
                    }
                }
                return null;
            }
            catch (Exception)
            {
                return null;
            }
        }

        private static DshWebHostResponse RequestPipe(string pipeName, string command, int expectedServerProcessId = 0)
        {
            using (var pipe = new NamedPipeClientStream(
                ".",
                pipeName,
                PipeDirection.InOut,
                PipeOptions.Asynchronous))
            {
                pipe.Connect(750);
                if (expectedServerProcessId > 0)
                {
                    uint actualServerProcessId;
                    if (!GetNamedPipeServerProcessId(
                        pipe.SafePipeHandle.DangerousGetHandle(),
                        out actualServerProcessId))
                    {
                        throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
                    }
                    if (actualServerProcessId != (uint)expectedServerProcessId)
                    {
                        throw new IOException("旧版 DSH 管道服务端与当前会话进程不匹配");
                    }
                }
                DshPipeProtocol.WriteLine(pipe, command, 64, TimeSpan.FromSeconds(5));
                int timeoutSeconds = string.Equals(command, "START", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(command, "RESTART", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(command, "RESTART_OPEN", StringComparison.OrdinalIgnoreCase)
                    ? 60
                    : string.Equals(command, "PAUSE", StringComparison.OrdinalIgnoreCase) ? 30 : 10;
                string response = DshPipeProtocol.ReadLine(pipe, 16384, TimeSpan.FromSeconds(timeoutSeconds));
                if (string.IsNullOrWhiteSpace(response))
                {
                    throw new IOException("DSH 后台服务没有返回状态");
                }
                return Parse(response);
            }
        }

        private static bool TryFindLegacyHostInCurrentSession(out int legacyHostProcessId)
        {
            legacyHostProcessId = 0;
            int currentSessionId = Process.GetCurrentProcess().SessionId;
            using (var searcher = new ManagementObjectSearcher(
                "SELECT ProcessId, SessionId, CommandLine, Name, ExecutablePath FROM Win32_Process " +
                "WHERE Name='ToolHub.exe' OR Name LIKE 'ToolHubDshHost-%.exe'"))
            using (ManagementObjectCollection processes = searcher.Get())
            {
                foreach (ManagementObject item in processes)
                {
                    using (item)
                    {
                        if (Convert.ToInt32(item["SessionId"]) != currentSessionId)
                        {
                            continue;
                        }

                        string processName = item["Name"] as string;
                        if (processName != null && processName.StartsWith("ToolHubDshHost-", StringComparison.OrdinalIgnoreCase))
                        {
                            string executablePath = item["ExecutablePath"] as string;
                            if (!string.Equals(Path.GetFileName(executablePath),
                                ToolHubBuildInfo.DshHostFileName, StringComparison.OrdinalIgnoreCase))
                            {
                                legacyHostProcessId = Convert.ToInt32(item["ProcessId"]);
                                return true;
                            }
                            continue;
                        }

                        string commandLine = item["CommandLine"] as string;
                        string[] arguments;
                        try
                        {
                            arguments = DshWebController.SplitWindowsCommandLine(commandLine);
                        }
                        catch
                        {
                            continue;
                        }
                        if (arguments.Length == 2 &&
                            string.Equals(arguments[1], "--dsh-host", StringComparison.OrdinalIgnoreCase))
                        {
                            legacyHostProcessId = Convert.ToInt32(item["ProcessId"]);
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool GetNamedPipeServerProcessId(IntPtr pipeHandle, out uint processId);

        private static void StartHost()
        {
            string hostPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, ToolHubBuildInfo.DshHostFileName);
            if (!File.Exists(hostPath))
            {
                throw new FileNotFoundException("未找到 DSH 后台宿主：" + hostPath, hostPath);
            }
            Process process = Process.Start(new ProcessStartInfo
            {
                FileName = hostPath,
                WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            });
            if (process != null)
            {
                process.Dispose();
            }
        }

        private static DshWebHostResponse Parse(string response)
        {
            string[] fields = response.Split('\t');
            if (fields.Length != 8 && fields.Length != 9)
            {
                throw new IOException("DSH 后台服务返回了无法识别的状态");
            }

            DshWebState state;
            int processId;
            int port;
            if (!Enum.TryParse<DshWebState>(fields[0], out state))
            {
                state = DshWebState.Unknown;
            }
            int.TryParse(fields[1], out processId);
            int.TryParse(fields[2], out port);
            bool legacy = fields.Length == 8;
            string host = legacy ? "127.0.0.1" : Decode(fields[3]);
            int offset = legacy ? 0 : 1;
            bool hasLaunchUrl = fields[3 + offset] == "1";
            bool succeeded = fields[4 + offset] == "1";
            bool needsRestart = fields[5 + offset] == "1";
            string actionMessage = Decode(fields[6 + offset]);
            string statusMessage = Decode(fields[7 + offset]);

            return new DshWebHostResponse(
                new DshWebStatus(state, processId, port, host, hasLaunchUrl, statusMessage),
                new DshWebActionResult(succeeded, needsRestart, actionMessage));
        }

        private static string Decode(string value)
        {
            return Utf8.GetString(Convert.FromBase64String(value ?? string.Empty));
        }
    }
}
