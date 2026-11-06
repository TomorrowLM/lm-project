# LM Markdown Copilot Preview

在 VS Code 中以可选中文本的方式预览 Markdown，并把所选内容作为引用发送到 VS Code 原生 GitHub Copilot Chat。

Preview Markdown as selectable content in VS Code, then send selected passages as references to the native GitHub Copilot Chat.

## 简体中文

### 功能

- **Markdown 预览与目录**：标题、段落、列表、代码块、图片和 Mermaid 图表；目录可放在 Activity Bar 侧栏，正文占满编辑区；支持搜索、跳转、折叠，并定位当前阅读章节。
- **图片与格式兼容**：支持相对路径和工作区图片资源，并兼容常见的 `<font color>` 与 `style="color:..."` 写法。
- **代码语法高亮**：常见语言围栏代码使用内置离线高亮，颜色随预览深浅主题切换；未识别语言保留纯文本，Mermaid 继续使用图表渲染。
- **选择并引用**：选中预览文字后，可同步到 Copilot Chat。每次同步都会追加一个引用，可连续添加多个片段。
- **右键操作**：可对选中文字加粗、复制、同步到 Copilot，或定位到对应源码。
- **图片操作**：右键图片可设为 25%、50%、75%、100% 或自定义宽度；也可上传到腾讯 COS 并自动替换 Markdown 图片地址。修改可用 VS Code 撤销。
- **预览设置**：在工具栏齿轮中持久化设置主题、正文大小、行距和阅读宽度；主题切换也放在这里。
- **腾讯 COS**：每个用户自行配置 Bucket、Region 和密钥。SecretId/SecretKey 使用 VS Code SecretStorage 加密保存；扩展不会携带发布者的密钥，也不会写入普通设置或 README。
- **Mermaid 图表**：可缩放、适应容器及重置视图，图表区域支持滚动查看。
- **源码与预览定位**：当 VS Code 提供 Copilot Markdown 引用对应的文件和行号时，可定位到预览；也可从源码定位到预览，或在右侧分屏打开对应源码位置。
- **改动查看**：刷新后按保存基线高亮正文净变化，改动列表同步着色；可跳转上一处/下一处并定位。来源可能是 Copilot 或手动编辑，VS Code 不提供可靠的来源区分。
- **状态保留**：切换编辑器或预览重载后，尽可能保留正文、目录、改动列表的滚动位置，以及目录折叠、隐藏和搜索状态。
- **快捷键**：预览获得焦点时，`Ctrl+F` 显示/隐藏顶部工具栏，`Ctrl+H` 显示/隐藏整个当前文件变化区域。

### 开始使用

1. 在 VS Code 中打开一个 `.md` 文件。默认编辑器为 LM Markdown Preview；如当前使用文本编辑器，可从编辑器类型菜单切换到预览。
2. 在预览中选择需要处理的文字，使用工具栏或右键菜单选择操作。
3. 选择“同步到 Copilot”后，片段会作为引用添加到原生 Copilot Chat。要添加其他片段，重新选择并再次同步即可。
4. 在 Copilot Chat 中输入你的要求。Copilot 负责生成回复和修改；请在 Copilot 中查看改动并决定保留或撤销。
5. 点击预览工具栏的齿轮调整阅读设置。图片上传前，先填写自己的腾讯 COS SecretId、SecretKey、Bucket 和 Region；Bucket 需要允许预览端读取对象。

### 命令

- `LM Markdown: Open Selectable Preview`：打开可选中文本的 Markdown 预览。
- `LM Markdown: Sync Selection to Copilot`：将源码中的当前选区同步到 Copilot Chat。
- `LM Markdown: Reveal Location in Preview`：在预览中定位源码位置。

### 要求与说明

- 需要 VS Code 1.95 或更高版本。
- Markdown 预览无需 Copilot；将内容同步到 Copilot Chat 需要安装并启用 GitHub Copilot Chat。
- 插件不提供模型或聊天窗口，也不调用自有 AI 服务；对话、生成修改以及原生的保留/撤销操作由 Copilot Chat 处理。
- 预览中的选区按 Markdown 块映射到源文件行范围，并非字符级精确范围，因此引用可能包含同一块中的其他文字。
- 改动列表用于展示文件变化，不等同于 Copilot 原生待审列表；它会合并当前文件的净变化，并可能包含手动编辑。当前会话捕获的编辑事件仅保存在内存中。
- Marketplace 展示内容直接取自扩展根目录的 `README.md`。中英文说明在同一文件维护，打包前的文档检查会确认两种语言说明都存在。

## English

### Features

- **Markdown preview and outline** — Render headings, paragraphs, lists, code blocks, images, and Mermaid diagrams. Move the outline to the Activity Bar sidebar so the preview fills the editor area; search, navigate, collapse, and locate the chapter currently in view.
- **Images and formatting** — Supports relative paths, workspace image resources, and common `<font color>` / `style="color:..."` markup.
- **Code syntax highlighting** — Common fenced languages are highlighted offline with colors that follow the preview theme. Unknown languages remain plain text, and Mermaid fences keep their diagram rendering.
- **Select and reference content** — Select text in the preview and send it to Copilot Chat. Each sync adds a new reference, so you can add multiple passages.
- **Context-menu actions** — Bold or copy selected text, sync it to Copilot, or reveal its source location.
- **Image actions** — Right-click an image to set its width to 25%, 50%, 75%, 100%, or a custom percentage. You can also upload it to Tencent COS and replace the Markdown URL. Changes are undoable in VS Code.
- **Preview settings** — Persist the theme, body font size, line height, and reading width from the toolbar's settings menu.
- **Tencent COS** — Each user configures their own bucket, region, and credentials. SecretId and SecretKey are stored with VS Code SecretStorage; the extension package does not contain the publisher's credentials.
- **Mermaid controls** — Zoom, fit diagrams to the viewport, reset zoom, and scroll to inspect large diagrams.
- **Source/preview navigation** — Navigate from a Copilot Markdown reference to the preview when VS Code provides its file and line. You can also reveal a source location from the preview or open it in a side-by-side editor.
- **Change review** — Refresh to recalculate and highlight net changes against the saved baseline in the preview and change list. Changes may come from Copilot or manual edits; VS Code does not expose reliable source attribution.
- **Preserved view state** — Main preview, outline, and change-list scroll positions, along with outline folding, visibility, and search state, are preserved across editor switches and preview reloads where possible.
- **Keyboard shortcuts** — With the preview focused, press `Ctrl+F` to show or hide the top toolbar, and `Ctrl+H` to show or hide the entire current-file changes panel.

### Get started

1. Open a `.md` file in VS Code. LM Markdown Preview is the default editor. If the file is open as text, use the editor-type menu to switch to the preview.
2. Select the text you want to work with and choose an action from the toolbar or context menu.
3. Choose **Sync to Copilot** to add the passage as a reference in native Copilot Chat. Select another passage and sync again to add another reference.
4. Enter your request in Copilot Chat. Copilot generates responses and edits; review the changes in Copilot and choose whether to keep or undo them.
5. Open the toolbar's settings menu to change reading preferences. Before uploading images, enter your own Tencent COS SecretId, SecretKey, bucket, and region. The bucket must allow the preview to read uploaded objects.

### Commands

- `LM Markdown: Open Selectable Preview` — Open the selectable Markdown preview.
- `LM Markdown: Sync Selection to Copilot` — Send the current source-editor selection to Copilot Chat.
- `LM Markdown: Reveal Location in Preview` — Reveal a source location in the preview.

### Requirements and notes

- Requires VS Code 1.95 or later.
- Markdown preview works without Copilot. GitHub Copilot Chat must be installed and enabled to sync content to Copilot Chat.
- The extension does not provide a model or chat window and does not call its own AI service. Copilot Chat handles conversations, generated edits, and its native keep/undo actions.
- Preview selections map to Markdown block line ranges, not exact character ranges, so a reference may include additional text from the same block.
- The change panel shows file changes and is not the same as Copilot's native review list. It calculates the current net changes and may include manual edits. Captured edit events are kept in memory for the current session only.
- The extension root `README.md` is also the Marketplace description source. Chinese and English documentation live in the same file and are checked before packaging.
