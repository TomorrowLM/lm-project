## Why

当前首页为静态页面，无法动态展示后端数据。需要接入 API 接口 `http://122.51.80.75:3600/white/test` 获取数据并渲染到页面，使首页具备数据驱动能力。

## What Changes

- 新增 API 请求模块，使用 fetch 调用接口
- 在 Hero Section 中增加数据展示区域，渲染 API 返回的 `data.info` 字段
- 增加加载状态和错误状态处理
- 保持 Apple 风格极简设计，新增内容需符合现有视觉规范

## Capabilities

### New Capabilities
- `api-integration`: API 接口集成能力，包括请求、响应处理、错误处理
- `dynamic-data-rendering`: 动态数据渲染能力，将 API 数据展示到页面

### Modified Capabilities
<!-- 无现有能力的需求变更 -->

## Impact

- **Affected Code**: `src/script.js`（新增 API 请求逻辑）、`src/index.html`（新增数据展示区域）、`src/style.css`（新增样式）
- **APIs**: 依赖外部接口 `http://122.51.80.75:3600/white/test`
- **Dependencies**: 无新增依赖，使用原生 fetch API
- **Performance**: 需确保 API 请求不影响页面首次渲染（异步加载）
