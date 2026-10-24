# 声音场景

这是一个独立的 Windows 桌面工具，用于由用户选择当前设备、场景和声音预设，再显式应用声音设置。

## 当前能力

- 选择蓝牙耳机或内置扬声器等活动播放设备。
- 创建“音乐-蓝牙”“电影-扬声器”等自定义场景。
- 选择音乐或电影预设，填入推荐音量、低音、高音、人声清晰度、空间模式和 10 段均衡器。
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

点击“应用场景”后，工具只会写入自己的用户配置文件：

```text
%USERPROFILE%\.lm-exe\audio-scene\config\apo\active.txt
```

首次使用时，需要把工具状态栏显示的 `Include:` 行手动添加到 Equalizer APO 的 `config\config.txt`。工具不会覆盖 APO 安装目录中的文件，不会安装驱动、创建服务、修改注册表或启动后台进程。

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
