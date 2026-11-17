# 声音场景

这是一个独立的 Windows 桌面工具，用于由用户选择当前设备、场景和声音预设，再显式应用声音设置。

## 当前能力

- 选择蓝牙耳机或内置扬声器等活动播放设备。
- 显示当前播放设备的输出混音格式，例如 `48000 Hz / 2 声道`。
- 创建“音乐-蓝牙”“电影-扬声器”等自定义场景。
- 选择音乐、电影或 AI 人声/配音预设，填入推荐音量、低音、高音、人声清晰度、空间模式和 10 段均衡器。
- 只有点击“应用场景”后，才会设置目标设备的音量、静音状态和高级音效。
- 场景保存在：`%USERPROFILE%\.lm-exe\audio-scene\config\scenes.xml`。

## Equalizer APO 适配

工具不依赖 Peace，也不启动 Peace。Equalizer APO 只作为底层音频处理引擎，工具自己提供场景和调音界面。

先手动安装 Equalizer APO，并在 Device Selector 中选择要处理的播放设备。工具会识别默认安装目录，也支持自定义安装目录；自定义目录可写入：

```text
%USERPROFILE%\.lm-exe\audio-scene\config\apo-install-path.txt
```

文件内容只放 Equalizer APO 安装目录，例如：

```text
D:\software\windows\equalizerAPO
```

点击“应用场景”后，工具会自动完成两件事：

1. 写入自己的用户配置文件：

```text
%USERPROFILE%\.lm-exe\audio-scene\config\apo\active.txt
```

2. 首次应用时，自动把自己的 `Include:` 行追加到 Equalizer APO 的 `config\config.txt`。追加前会把原始主配置备份到：

```text
%USERPROFILE%\.lm-exe\audio-scene\config\apo\config.txt.backup
```

后续应用场景不会重复追加。工具不会安装驱动、创建服务、修改注册表或启动后台进程；如果 APO 主配置没有写入权限，只提示警告，不影响设备音量功能。

输出 `Hz` 是 Windows 音频引擎当前的共享混音采样率，不代表原始音频文件的采样率。AI 生成的人声和真人录音在采样率层面没有可靠区别，因此工具提供“AI 人声·配音清晰”预设；自动识别人声需要回环读取正在播放的混音，后续只能作为用户主动开启的可选分析，不默认常驻或保存音频。

## 构建

```powershell
.\build.ps1
.\build.ps1 -RunTests
.\build.ps1 -RunTests -OutputDirectory .\build-test\green
.\build.ps1 -RunTests -RunDeviceTest
```

开发构建产物保存在项目目录；ToolHub 同步部署时会复制到：

```text
C:\Users\<当前用户>\.lm-exe\audio-scene\
├─ app\
├─ config\
├─ cache\
└─ logs\
```

工具关闭后不会留下常驻进程。配置保存先写入临时文件，再替换正式文件，避免半写入配置影响下次启动。
