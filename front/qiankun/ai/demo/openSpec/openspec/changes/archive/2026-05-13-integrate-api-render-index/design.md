## Context

当前首页为纯静态页面，所有数据硬编码在 HTML 中。需要接入外部 API 实现数据驱动，为后续动态内容展示奠定基础。

**Constraints**:
- 纯 HTML + CSS + JS，零依赖（项目宪法要求）
- 使用原生 fetch API，不引入 axios 等第三方库
- JS 必须使用 IIFE 包裹，严格模式，不污染全局
- 保持 Apple 风格极简设计

## Goals / Non-Goals

**Goals:**
- 成功调用 API 并获取数据
- 在页面中优雅展示数据，处理加载和错误状态
- 代码符合项目宪法规范（IIFE、严格模式、BEM 命名）

**Non-Goals:**
- 不实现轮询或定时刷新
- 不实现用户交互触发请求（仅页面加载时请求一次）
- 不处理复杂的数据结构（仅处理简单的 info 字段）

## Decisions

### 1. 使用 fetch API 而非 XMLHttpRequest

**Rationale**: fetch 是现代浏览器标准 API，代码更简洁，支持 Promise，符合项目"性能至上"原则。

**Alternatives considered**:
- XMLHttpRequest: 代码冗长，回调嵌套
- axios: 需要引入第三方库（违反零依赖原则）

### 2. 数据展示位置：副标题和 Banner 之间

**Rationale**: 该位置视觉层次清晰，数据作为副标题的补充说明，不干扰主要 CTA。

**Alternatives considered**:
- Banner 下方：可能干扰 CTA 按钮的视觉优先级
- Footer 上方：位置过于隐蔽

### 3. 错误处理：静默显示错误文本，不弹窗

**Rationale**: 符合 Apple 风格克制设计，避免打断用户体验。

**Alternatives considered**:
- alert 弹窗：过于粗暴，破坏用户体验
- 控制台日志：用户看不到，无法感知错误

## Risks / Trade-offs

### [Risk 1] API 接口响应慢或超时
→ **Mitigation**: 设置 fetch timeout（使用 AbortController），超时后显示错误提示

### [Risk 2] API 返回数据结构变化
→ **Mitigation**: 增加数据校验，检查 code === 200 和 data.info 存在性

### [Risk 3] CORS 跨域问题
→ **Mitigation**: 如遇到 CORS 错误，需后端配置 Access-Control-Allow-Origin 或使用代理

## Migration Plan

1. **Deploy**: 
   - 新增代码不影响现有功能（渐进增强）
   - 如 API 请求失败，页面仍可正常展示（优雅降级）

2. **Rollback**: 
   - 删除 script.js 中的 API 请求代码
   - 删除 index.html 中的数据展示区域
   - 删除 style.css 中的相关样式

## Open Questions

- [ ] API 接口是否需要认证？（当前测试接口无需认证）
- [ ] data.info 字段是否有长度限制？（需确认文本长度以决定样式）
