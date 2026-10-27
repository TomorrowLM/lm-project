# LM Markdown Copilot Preview — Development

本文件面向项目维护者，记录本地启动、测试和代码结构；普通使用者无需执行这里的步骤。

This document is for maintainers. It covers local development, testing, and project structure; end users do not need to follow these steps.

## 本地开发 / Local development

在 PowerShell 中进入项目目录并安装依赖、构建 Mermaid 资源、运行测试：

```powershell
Set-Location 'D:\LM\lm-project\脚本\plugin\vscode\lm-md'
npm.cmd install
npm.cmd run build:mermaid
npm.cmd test
```

在 VS Code 中打开项目目录，按 `F5` 启动 Extension Development Host。在开发宿主中打开 `.md` 文件即可调试预览扩展。也可以从命令面板运行：

`LM Markdown: Open Selectable Preview`

打开 Markdown 文本编辑器后，也可从编辑器右键菜单运行同名命令。

Open the project folder in VS Code and press `F5` to launch the Extension Development Host. Open a `.md` file in the host to debug the preview. You can also run `LM Markdown: Open Selectable Preview` from the Command Palette or the Markdown editor context menu.

## 项目结构 / Project structure

```text
lm-md/
├── extension.js                 # VS Code activation, commands, and preview refresh
├── src/markdown-renderer.js     # Markdown rendering and source-line metadata
├── src/preview-panel.js         # Webview preview and selection message protocol
├── src/custom-editor.js         # Default custom editor for .md files
├── src/change-history.js        # In-session document change tracking
├── src/preview-state.js         # Per-document preview, outline, and scroll state
├── src/source-review.js         # Reveal changes in the native text editor
├── src/copilot-selection.js     # Source ranges and native Copilot Chat handoff
├── media/preview.js             # Webview selection and UI interactions
└── test/                        # Node.js unit tests
```

## 实现约定 / Implementation notes

- 预览选区按起始块的最小源行号与结束块的最大源行号映射到完整行范围，以保留 Markdown 结构；它不是字符级精确定位。
- 当前文件改动按保存内容计算净差异；会话事件列表只捕获扩展开始监听后的变化，不区分 Copilot 与手动编辑，不写入历史文件。
- 净差异用于合并重复或整文件替换造成的噪声，不代表 Copilot 原生待审列表。
- “在源码中审阅”负责打开/定位源码，不模拟 Copilot 的保留/撤销；原生审阅控件是否出现由 VS Code/Copilot 当前会话状态决定。

- Preview selections map to complete source line ranges using the minimum source line of the starting block and maximum source line of the ending block. This preserves Markdown structure but is not character-precise.
- Net file changes are calculated against saved content. The in-session event list captures changes only after the extension starts listening, does not distinguish Copilot edits from manual edits, and is not written to a history file.
- Net changes reduce noise from duplicate or whole-file replacement events; they are not Copilot's native pending-review list.
- **Review in Source** opens/reveals the source location but does not simulate Copilot's keep/undo actions. Whether native review controls appear depends on the current VS Code/Copilot session state.

