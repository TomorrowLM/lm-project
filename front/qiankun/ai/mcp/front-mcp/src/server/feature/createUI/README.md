## 推荐流程

1. 先调用 create_api_mcp，生成 API 指令并拿到 apiName
2. 将 apiName 回填到 page.json 的 requests 中
3. 再调用 create_ui_mcp
4. create_ui_mcp 读取 page.json，提取页面元信息、UI 图片路径、目标文件路径、depends、requirements、children、requests
5. create_ui_mcp 返回统一的 UI instruction 给模型
6. 模型按 instruction 生成页面和子组件代码

## 约束

- create_ui_mcp 不负责执行 create_api_mcp
- 如果 page.requests 存在但某一项缺少 apiName，create_ui_mcp 会直接报错
- create_ui_mcp 只接受 `{ "page": "..." }` 这种入参形式
- page.depends 表示组件、工具、模型、图片等依赖
- page.requirements 表示布局、按钮、交互等实现要求

## 使用示例

以下是一个调用 create_ui_mcp 工具的示例

```json
{
   "page": "page.json"
}
```

如果 requests 中存在未回填 apiName 的项，将返回类似错误：

```text
create_ui_mcp: page.requests 中存在缺失 apiName 的项，请先执行 create_api_mcp，并将返回的 apiName 回填到 page.json 后再执行 create_ui_mcp。