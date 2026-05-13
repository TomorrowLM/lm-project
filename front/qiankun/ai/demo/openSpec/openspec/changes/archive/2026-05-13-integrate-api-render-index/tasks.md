## 1. HTML 结构

- [x] 1.1 在 index.html 的 Hero Section 中新增数据展示区域 `.hero__data`，位于副标题和 Banner 之间
- [x] 1.2 添加 `aria-live="polite"` 和 `role="status"` 属性以支持无障碍访问
- [x] 1.3 初始状态显示"加载中..."占位文本

## 2. CSS 样式

- [x] 2.1 在 style.css 中新增 `.hero__data` 基础样式（字体、颜色、边距）
- [x] 2.2 添加 `.hero__data--loading` 状态样式（#999 灰色）
- [x] 2.3 添加 `.hero__data--success` 状态样式（#666，18px）
- [x] 2.4 添加 `.hero__data--error` 状态样式（#d32f2f，14px）
- [x] 2.5 添加移动端响应式样式（≤767px 时字体 16px，边距 12px）
- [x] 2.6 添加 opacity transition 过渡效果（300ms ease）

## 3. JavaScript API 集成

- [x] 3.1 在 script.js 中新增 IIFE 模块 `ApiIntegration`，使用严格模式
- [x] 3.2 实现 `fetchData()` 函数，使用 fetch 调用 `http://122.51.80.75:3600/white/test`
- [x] 3.3 实现 AbortController 超时控制（10 秒超时）
- [x] 3.4 实现响应解析：检查 code === 200 和 data.info 存在性
- [x] 3.5 实现错误处理：网络错误、HTTP 错误、业务错误、数据异常

## 4. JavaScript UI 渲染

- [x] 4.1 实现 `renderLoading()` 函数，显示加载状态
- [x] 4.2 实现 `renderSuccess(data)` 函数，渲染 data.info 文本
- [x] 4.3 实现 `renderError(message)` 函数，显示错误提示
- [x] 4.4 实现状态切换逻辑：loading → success/error
- [x] 4.5 在 DOMContentLoaded 事件中触发 API 请求

## 5. 测试与验证

- [x] 5.1 在浏览器中测试正常加载流程（显示 loading → 显示数据）
- [x] 5.2 测试网络错误场景（断网或无效 URL，显示错误）
- [x] 5.3 测试超时场景（模拟慢网络，10 秒后显示错误）
- [x] 5.4 测试移动端响应式布局（Chrome DevTools 切换设备）
- [x] 5.5 验证无障碍访问（检查 ARIA 属性是否生效）
- [x] 5.6 验证代码符合项目宪法（IIFE、严格模式、BEM 命名、零依赖）
