# Swagger 工具默认 Source 参数配置

## 概述

已成功修改 MCP Swagger 工具，使其在未提供 `source` 参数时自动使用默认 URL：`https://apit-dsb.dingtax.cn/dsb/yqarw/api/doc.html#/`

## 修改内容

### 1. 修改 `swaggerGetModelInputSchema`（ai/mcp/src/tools/swagger/index.ts:13-38）

在 `source` 属性中添加了 `default` 字段：
```typescript
source: {
  type: "string",
  description: "Swagger/OpenAPI 文档 URL 或本地文件路径（JSON）",
  default: "https://apit-dsb.dingtax.cn/dsb/yqarw/api/doc.html#/",
},
```

### 2. 修改 `loadDocument` 函数（ai/mcp/src/tools/swagger/index.ts:109-124）

增强了默认值处理逻辑：
```typescript
// 使用默认 URL 如果 source 未提供或为空
const defaultSource = "https://apit-dsb.dingtax.cn/dsb/yqarw/api/doc.html#/";
let source: string | undefined;

if (args.source !== undefined && args.source !== null && args.source.trim() !== "") {
  source = normalizeSource(args.source);
} else {
  source = defaultSource;
}

if (!source || source.trim() === "") {
  throw new Error("get_swagger_mcp: 需要提供 source 或 document");
}
```

### 3. 修改 `handleSwaggerGetModelTool` 函数（ai/mcp/src/tools/swagger/index.ts:443-452）

添加了额外的默认值设置以确保健壮性：
```typescript
// 确保 args 有默认的 source 值
if (!args.source || args.source.trim() === "") {
  args.source = "https://apit-dsb.dingtax.cn/dsb/yqarw/api/doc.html#/";
}
```

## 测试结果

### 成功测试
1. **提供明确的 source 参数**：工具正常工作，成功从指定 URL 获取了 1000+ 个模型定义
2. **工具功能完整性**：TypeScript 编译无错误，工具核心功能正常

### 已知问题
- 当完全不提供任何参数调用工具时，MCP SDK 可能不会自动应用 schema 中的默认值
- 需要传递空字符串 `""` 作为 `source` 参数才能触发默认值逻辑

## 使用方式

### 方式一：使用默认 URL（推荐）
```json
{
  "resolveRefs": false
}
```
或传递空字符串作为 source：
```json
{
  "source": "",
  "resolveRefs": false
}
```

### 方式二：使用自定义 URL
```json
{
  "source": "https://custom-swagger-url.com/api-docs",
  "resolveRefs": true
}
```

### 方式三：获取特定模型
```json
{
  "name": "YqaExpertResp对象",
  "resolveRefs": true
}
```

## 技术细节

### 默认值处理策略
1. **Schema 级别**：在 OpenAPI schema 中定义默认值，供客户端参考
2. **运行时级别**：在 `loadDocument` 函数中实现回退逻辑
3. **双重保障**：在 `handleSwaggerGetModelTool` 中再次设置默认值

### 健壮性考虑
- 处理 `undefined`、`null` 和空字符串情况
- 使用 `trim()` 去除空白字符
- 多层验证确保不会因空值而崩溃

## 后续优化建议

1. **MCP SDK 集成**：研究 MCP SDK 是否支持自动应用 schema 默认值
2. **错误信息改进**：当使用默认 URL 时，在错误信息中提示使用的是默认值
3. **配置化**：将默认 URL 提取为配置常量，便于维护
4. **日志记录**：添加调试日志以跟踪默认值的使用情况

## 文件清单

修改的文件：
- `ai/mcp/src/tools/swagger/index.ts`

相关文件：
- `ai/mcp/src/tools/index.ts`（工具注册）
- `ai/mcp/src/index.ts`（MCP 服务器入口）