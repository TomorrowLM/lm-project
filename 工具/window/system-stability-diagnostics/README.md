# 系统稳定性诊断

ToolHub 的独立子工具。源码放在 `脚本\window\system-stability-diagnostics`，实际应用和诊断记录由同步脚本部署到 `.lm-exe\system-stability-diagnostics`。它也可以直接单独启动。

## 当前能力

- 打开工具后自动显示实时整体 CPU、GPU 使用率和内存已用/总量，每 2 秒刷新；此只读状态不写入诊断历史，也不枚举进程明细。GPU 计数器不可用时显示“不可用”。
- 用户手动开始/停止资源采样：每 5 秒记录整体 CPU、可用物理内存，以及专用内存较高的最多 12 个进程的 CPU、内存、句柄和线程；单次采样最长 10 分钟。
- 可记录鼠标指针卡顿、整机卡顿、应用无响应或应用崩溃的时间点，并附加简短备注。
- 只读查看最近 14 天 Windows Application/System 日志中的错误和警告；最多显示每类日志 100 条。
- 重启工具后仍能读取本机历史采样与标记。运行时 JSONL 日志位于 `.lm-exe\system-stability-diagnostics\logs`。

它不自动结束进程、不重启 Explorer、不改系统配置、不采集转储，也不会据单个指标直接认定根因。鼠标卡顿可能来自设备、驱动、图形、DPC/ISR 等原因；当前版本只提供时间关联和常见资源/事件证据，并不检测或修复所有这些原因。后续优化应依据多次历史记录和可验证证据再设计。

## 构建和测试

```powershell
.\build.ps1
.\build.ps1 -RunTests
.\build.ps1 -RunTests -OutputDirectory build-test\red
.\build.ps1 -RunTests -OutputDirectory build-test\green
```

默认构建放在 `build\`，测试和 TDD 产物放在 `build-test\`。

## 运行数据结构

```text
C:\Users\<当前用户>\.lm-exe\system-stability-diagnostics\
├─ app\       # EXE 和 Core DLL
├─ config\    # 当前版本没有用户可调配置
└─ logs\      # system-stability-YYYYMMDD.jsonl
```
