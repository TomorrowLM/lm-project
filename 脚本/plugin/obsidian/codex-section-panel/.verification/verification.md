# 0.4.3 浏览器回归验证

验证日期：2026-10-14（Asia/Shanghai）。

浏览器：本地无头 Microsoft Edge；加载插件真实 main.js 和 styles.css，只适配 Obsidian DOM 辅助方法，app-server 事件使用测试数据。

## 结果

- 源目录及已安装目录的 `node test.js`：通过。
- main.js 语法检查：通过。
- 源目录及安装目录 6 个交付文件 SHA256：一致。
- 变换/裁剪容器内的回形针：浮层挂载到所属窗口 body，定位通过。
- 鼠标从回形针移动到引用浮层：浮层保持可操作；Escape 关闭通过。
- 窗口缩放及聊天滚动：浮层跟随锚点，边界检查通过。
- 390×640 窄窗口：浮层保持在窗口内，通过。
- 实际 send → requestCodex 订阅 → 消息渲染链路的事件回放：推理、检索和命令动作展示通过。
- 请求完成后的动作归并与 JSON 保存/恢复：通过。
- 失败、暂停后的动作状态和历史保存：通过。
- 重绘聊天时清理浮层：通过。
- 浏览器未捕获异常：0。

命令输出：

```text
codex-section-panel tests passed
codex-section-panel tests passed
main.js: matched
styles.css: matched
manifest.json: matched
README.md: matched
test.js: matched
ui-test.js: matched
ui tests passed: transformed hover, preview interaction, narrow viewport, event timeline, save/reload, portal cleanup
```

截图：hover-wide.png、hover-narrow.png、actions-running.png、actions-history.png。

本轮未操作正在运行的 Obsidian UI，也未向 Codex 发出真实推理请求。重新启用插件后加载新版本；旧历史没有动作字段，不能还原旧请求阶段。
