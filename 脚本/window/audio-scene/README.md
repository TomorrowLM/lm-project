# 声音场景

这是一个独立的 Windows 桌面工具，用于由用户选择当前设备、场景和声音预设，再显式应用声音设置。

## 当前能力

- 选择蓝牙耳机或内置扬声器等活动播放设备。
- 创建“音乐-蓝牙”“电影-扬声器”等自定义场景。
- 选择音乐或电影预设，填入安全的推荐音量。
- 只有点击“应用场景”后，才会设置目标设备的音量和静音状态。
- 场景保存在：`%USERPROFILE%\.lm-exe\audio-scene\config\scenes.xml`。

当前版本不安装驱动、不创建服务、不常驻后台、不启动定时器，也不会在启动时自动修改系统声音。通用均衡器依赖设备或独立音频驱动，工具会明确显示未应用的能力，不会伪装成成功。

## 构建

```powershell
.\build.ps1
.\build.ps1 -RunTests
.\build.ps1 -RunTests -OutputDirectory .\build-test\green
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
