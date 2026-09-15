# Selection Context Bridge

这是一个独立的 Obsidian 插件：在笔记里选择文字后右键，可以把选区添加/发送到 Codex Panel、DSH，或同时发送到两者。

## 使用

1. 把本目录复制到 Vault 的 `.obsidian/plugins/selection-context-bridge/`。
2. 在 Obsidian 的第三方插件设置中启用 `Selection Context Bridge`。
3. 确保 `codex-panel` 或 `dsh-harness` 已启用。
4. 在笔记中选择一段文字，右键选择对应目标。

每次右键添加都会保留在缓存中；相同笔记、相同范围、相同文本不会重复。发送到 Codex 时使用笔记链接和精确行列位置；发送到 DSH 时同时保留选中文本和位置标记。

## 兼容说明

插件不修改笔记内容，也不依赖 Codex 或 DSH 的源码文件。它通过运行时探测后端能力工作，因此可以作为单独插件复制到其他电脑。第三方后端若改动内部接口，插件会提示“面板尚未准备好”或“不支持”，不会阻止 Obsidian 加载。

## 后续扩展

新增后端只需要实现一个发送适配器，并加入右键菜单；选区缓存、去重和格式化逻辑可以复用。
