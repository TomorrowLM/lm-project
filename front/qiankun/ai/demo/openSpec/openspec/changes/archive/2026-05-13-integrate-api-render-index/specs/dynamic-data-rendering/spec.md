## ADDED Requirements

### Requirement: Data Display Rendering

系统 SHALL 在 Hero Section 中动态渲染 API 返回的 data.info 数据。

#### Scenario: Render data on success
- **WHEN** API 请求成功返回 data.info
- **THEN** 系统在副标题和 Banner 之间显示 data.info 文本
- **AND** 文本颜色为 #666，字体大小为 18px

#### Scenario: Show loading state
- **WHEN** 页面加载完成，API 请求进行中
- **THEN** 系统显示"加载中..."占位文本
- **AND** 文本颜色为 #999

#### Scenario: Show error state
- **WHEN** API 请求失败或响应异常
- **THEN** 系统显示"数据加载失败"错误提示
- **AND** 文本颜色为 #d32f2f

### Requirement: Responsive Data Display

系统 SHALL 在不同屏幕尺寸下正确渲染数据展示区域。

#### Scenario: Mobile viewport
- **WHEN** 屏幕宽度 ≤ 767px
- **THEN** 数据文本字体大小为 16px
- **AND** 上下边距为 12px

#### Scenario: Desktop viewport
- **WHEN** 屏幕宽度 ≥ 1024px
- **THEN** 数据文本字体大小为 18px
- **AND** 上下边距为 16px

### Requirement: Accessibility

系统 SHALL 为数据展示区域提供适当的 ARIA 属性。

#### Scenario: Screen reader notification
- **WHEN** 数据区域内容更新（loading → success/error）
- **THEN** 屏幕阅读器自动朗读新内容
- **AND** 元素包含 aria-live="polite" 属性
