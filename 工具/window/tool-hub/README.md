# Windows ToolHub

独立的 Windows 桌面工具中心，界面是靠近鼠标弹出的圆角浮动面板，当前接入 `window` 目录下的五个独立工具，并集成 DSH Web 服务控制。源码和运行时严格分离：`工具\window` 只保留源码，实际运行文件、用户配置、缓存、日志和备份统一放在 `C:\Users\<当前用户>\.lm-exe`。

- 工作区切换：启动 `.lm-exe\workspace-switcher\app\WorkspaceSwitcher.exe`，并附加 `--show`；如果工作区切换器已经在后台运行，现有实例会被唤醒并显示面板，不会再被第二个单实例进程吞掉请求。
- 壁纸中心：启动 `.lm-exe\Wallpaper-GUI\app\Wallpaper-GUI.cmd`
- 桌面修复：启动 `.lm-exe\desktop-black-screen-repair\app\Repair-DesktopBlackScreen.cmd`
- 系统稳定性诊断：启动 `.lm-exe\system-stability-diagnostics\app\SystemStabilityDiagnostics.exe`
- 声音场景：启动 `.lm-exe\audio-scene\app\AudioScene.exe`，由用户选择设备、查看输出采样率、选择场景、音量、低音、高音、人声清晰度、空间模式和均衡器后显式应用。
- DSH：显示 DSH Web 服务的全局运行状态，支持启动、暂停、重启和在默认浏览器打开。ToolHub 会解析 Node 可执行文件及 DSH 入口参数，识别 `dsh web` 和等价的 `dsh --profile web`，忽略帮助、版本和配置转储命令；停止操作只结束复核过的 DSH Node 进程，不会递归结束它的子进程。重启时保留原入口、Web 参数、主机和端口。若目标端口由其他程序占用，ToolHub 会提示并保留该进程。
- 网络速率：面板展开且搜索框空闲时，在搜索胶囊右侧显示活动物理网卡的上传和下载速率，约每秒更新一次；面板收起、搜索框聚焦或已有搜索内容时暂停采样，速率不会写入历史。

ToolHub 不引用 window 子工具的源码、DLL 或内部状态，只负责启动部署后的独立入口。因此原工具的单独入口、快捷方式和构建方式保持不变；五个 window 工具仍然可以单独运行。ToolHub 只记录本次由它启动的子进程，关闭 ToolHub 时会请求这些子进程正常退出；用户单独启动的工具不会被 ToolHub 关闭。DSH Web 服务由独立、按构建版本命名的隐藏宿主维持，退出 ToolHub 不会停止 DSH；需要停止服务时使用“暂停”。独立宿主不会占用 `ToolHub.exe`，因此 DSH 继续运行时也能更新工具中心主程序。

DSH 状态只在展开 DSH 操作行时每 2 秒检测一次。管道通信对请求/响应大小和读写时间设有上限，并按宿主构建版本与 Windows 会话隔离，避免升级后的 ToolHub 请求落到仍在运行的旧宿主。认证链接仅在隐藏宿主内存中保留，不写入 ToolHub 配置或日志。若新宿主无法取得认证链接，会尝试从同一会话的旧宿主读取；只有两者都没有链接时，选择“打开”才会询问是否重启。重启会中断当前浏览器连接和正在运行的 Agent 任务。检测失败时可点击状态文字查看详细错误。

“系统稳定性诊断”打开后会自动显示实时 CPU、GPU 使用率和内存已用/总量，每 2 秒刷新；实时状态只读且不写入历史。用户仍需主动开始，才会以 5 秒间隔记录 CPU、可用内存和高占用进程（按 CPU 占用与专用内存占物理内存的比例综合排序，同时记录工作集、句柄、线程）；单次采样最长 10 分钟。用户可标记鼠标指针卡顿、整机卡顿、应用无响应或应用崩溃的发生时刻，并只读查看最近 14 天 Windows Application/System 日志中的警告和错误。记录不会自动关闭应用、重启 Explorer、修改系统设置或采集转储；这些数据用于后续关联分析，不会单凭一次采样断言根因。

## 构建和运行

在本目录执行单体构建：

```powershell
.\build.ps1
.\build.ps1 -RunTests
.\tools\build-toolhub.ps1
.\ToolHub.cmd
```

直接运行 `build.ps1` 时，开发产物会留在本项目中：不带 `-RunTests` 写入 `build\`，带 `-RunTests` 写入 `build-test\`。需要保留红灯、绿灯和最终验证时，可以使用 `-OutputDirectory build-test\red`、`build-test\green` 等项目内子目录。`tools\build-toolhub.ps1` 和 `tools\sync-window-tools.ps1` 属于部署流程，会显式把运行时构建写入 `.lm-exe`。

完整同步部署使用：

```powershell
.\tools\sync-window-tools.ps1
```

同步脚本会依次构建工作区切换器、复制壁纸和桌面修复工具到 `.lm-exe`，迁移旧壁纸缓存和收藏记录，然后构建并部署 ToolHub。桌面只保留 `ToolHub.lnk` 作为统一启动入口；`ToolHubInstaller.lnk`、`WorkspaceSwitcher.lnk` 和 `Wallpaper-GUI.cmd - 快捷方式.lnk` 会被移出桌面并备份到 `tool-hub\backups\desktop-shortcuts`。实际应用文件仍保留在 `.lm-exe` 中，可以继续被 ToolHub 或独立命令启动。测试或无桌面环境可加 `-SkipShortcut`。部署器 EXE 本身也可以执行同一个同步流程，安装器启动同步时会自动跳过覆盖自身的步骤。

桌面的 `ToolHub.lnk` 指向稳定的 `tool-hub\app\ToolHubLauncher.exe`。启动器根据构建信息应用当前版本主程序、核心 DLL 和 DSH 宿主的 `.next` 文件，再启动版本化的 ToolHub 主程序。版本化文件名让旧 ToolHub/DSH 宿主继续运行时，新主程序和依赖仍可并行部署；稳定的 `ToolHub.exe` 与 `ToolHub.Core.dll` 作为兼容入口保留。启动器也会继续尝试替换这些兼容文件和工作区切换器的 `.next`。ToolHub、安装器、启动器都嵌入同一个 `ToolHub.ico`，与右下角悬浮蓝色图标使用同一套绘制标记。若版本化文件被其他进程占用，`.next` 会保留到下一次启动或同步时重试。

源码和设计文件位于 `D:\LM\lm-project\工具\window\tool-hub`，默认构建、运行和用户资源位于：

开发构建产物位于源码项目内：

```text
D:\LM\lm-project\工具\window\tool-hub\
├─ build\             # 普通开发构建
├─ build-test\        # TDD、测试构建和验证产物
├─ src\
├─ tests\
└─ tools\
```

运行时构建、运行和用户资源位于：

```text
C:\Users\12032\.lm-exe\tool-hub\
├─ app\              # 稳定启动器/安装器、兼容入口，以及按构建版本命名的主程序、Core DLL 和 DSH 宿主
├─ build\            # 部署时的运行时构建暂存
├─ config\           # window-root.txt、source-root.txt、tool-roots.ini
├─ cache\
├─ logs\
├─ diagnostics\
└─ backups\
```

完整同步后的运行时目录为：

```text
C:\Users\<当前用户>\.lm-exe\
├─ tool-hub\
├─ workspace-switcher\
│  ├─ app\
│  ├─ config\          # workspace-state.xml
│  ├─ cache\
│  └─ logs\
├─ Wallpaper-GUI\
│  ├─ app\
│  ├─ config\          # favorites.json
│  ├─ cache\            # images.jsonl、下载图片
│  └─ logs\
├─ desktop-black-screen-repair\
│  ├─ app\
│  ├─ config\
│  └─ logs\
├─ system-stability-diagnostics\
│  ├─ app\
│  ├─ config\
│  └─ logs\              # 每日 JSONL 诊断记录
└─ audio-scene\
   ├─ app\
   ├─ config\            # scenes.xml
   ├─ cache\
   └─ logs\
```

`tools\build-toolhub.ps1` 负责 ToolHub 单体构建和部署；`tools\sync-window-tools.ps1` 负责五个运行时目录的完整同步。两者会显式使用 `.lm-exe` 下的构建路径，不会把部署产物写回源码目录。运行时优先读取 `tool-hub\config\window-root.txt` 和 `tool-roots.ini`，因此部署后不会再回到源码目录寻找工具。

如果某个运行中的 EXE/DLL 被 Windows 占用，同步脚本不会强制结束进程，而是把新文件写成同目录的 `.next` 待更新文件，并记录在 `tool-hub\logs\last-sync.json` 的 `DeferredFiles` 中。关闭对应工具后，重新点击桌面的 `ToolHub.lnk` 会先尝试完成替换；也可以再运行 `ToolHubInstaller.exe` 或同步脚本。

## 用户信息与运行数据

工具中心和被接入的工具各自管理自己的状态，不共享配置文件：

```text
C:\Users\<当前用户>\.lm-exe\tool-hub\
├─ config\
│  ├─ window-root.txt   # .lm-exe 运行时根目录
│  ├─ source-root.txt   # 同步脚本所在的 tool-hub 源码目录
│  └─ tool-roots.ini    # 五个部署后 window 工具的明确入口
├─ cache\               # 可重新生成的缓存
├─ logs\                # 构建和部署日志
├─ diagnostics\         # 诊断信息
└─ backups\             # 被替换的旧运行文件
```

工作区中的应用归类、工作区顺序、应用路径、面板位置和尺寸不保存在 ToolHub 中，而是由 `workspace-switcher` 保存到：

```text
C:\Users\<当前用户>\.lm-exe\workspace-switcher\config\workspace-state.xml
```

ToolHub 当前不会持久化自己的拖动位置、搜索内容或展开状态；这些交互状态只在当前运行期间有效。点击 ToolHub 中的工具，只会启动对应的独立入口，不会复制或修改该工具的用户状态。

系统稳定性诊断的历史记录位于：

```text
C:\Users\<当前用户>\.lm-exe\system-stability-diagnostics\logs\system-stability-YYYYMMDD.jsonl
```

每条 JSONL 记录是一条用户卡顿标记或资源快照。关闭并重新打开诊断工具后，最近记录仍会显示；Windows 事件历史则受 Windows 自身的保留和轮转策略管理。

壁纸工具的下载缓存从源码目录 `Wallpaper-GUI\Cache` 迁移到 `.lm-exe\Wallpaper-GUI\cache`；收藏记录保存在 `.lm-exe\Wallpaper-GUI\config\favorites.json`。点击“应用壁纸”只设置当前桌面，点击爱心才会把图片复制到 `Pictures\Online Wallpapers`，取消爱心不会删除已经保存的图片。

工具中心默认只显示右下角蓝色图标，鼠标悬停后展开工具列表。搜索框支持按工具名称和描述过滤，点击工具行或单击蓝色按钮即可启动工具；拖动蓝色按钮可以移动工具中心。按 `Ctrl + Alt + F12` 显示/隐藏工具中心，按 `Esc` 关闭应用。

工作区面板优先使用 Windows DWM Acrylic 的白色半透明单层表面，不再把自绘壁纸层叠到原生玻璃上。仅当原生玻璃不可用时，才读取当前位置的已验证壁纸或 `.lm-exe\Wallpaper-GUI\cache` 图片作为回退；该回退只读文件，不截屏、不修改系统壁纸。
