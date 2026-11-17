# DSH Skill Refiner

一个面向 DSH 的本地插件，用于为工作区内已有的 `SKILL.md` 生成可审阅的改进版本，并在用户确认后应用、留存快照和回滚。

## 插件工具

- `skill_refiner_prepare`：读取指定技能文件，把技能正文、改进目标和可选执行证据交给配置的 LLM，返回完整建议稿。不会写文件。
- `skill_refiner_apply`：应用建议稿前检查原文件没有变化，保存前一版本快照，再原子替换技能文件。只有用户明确同意后才调用。
- `skill_refiner_history`：列出保存过的版本快照。
- `skill_refiner_rollback`：恢复到某个快照记录的前一版本；当前文件与快照应用后内容不一致时拒绝覆盖。

## 安装

在 DSH 的 **Plugins** 页面使用 **Add plugin**，选择本目录 `D:\LM\dsh-skill-refiner`。插件需要当前 Profile 已启用 `dsh-llm`、`dsh-tools` 和 `dsh-working-directory`。

默认模型路由在 `cordis.patch.yml` 中设置为 `deepseek-official` / `deepseek-v4-flash`，如当前 Profile 使用不同路由，请在插件配置中调整 `provider` 和 `model`。

## 限制与数据位置

- 工具只接受当前工作区内、文件名为 `SKILL.md` 的相对路径；目标文件必须具有含 `name` 的 YAML frontmatter。
- 单个技能文件上限 64 KiB，补充证据上限 5000 字符。
- 生成提案只保存在插件进程内存中；插件或 DSH 重启后，需要重新生成未应用的提案。
- 应用和回滚的快照保存在当前工作区 `.dsh-skill-refiner/history/`。快照含完整技能正文。
- 技能正文和所提供的证据会发送到配置的模型提供方。调用前请检查内容是否适合发送。

详见 [`docs/DETAIL.md`](docs/DETAIL.md)。
