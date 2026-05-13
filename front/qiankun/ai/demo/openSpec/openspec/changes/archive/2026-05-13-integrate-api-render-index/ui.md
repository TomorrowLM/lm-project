# UI Design: Integrate API Render Index

## Overview

在首页 Hero Section 中新增数据展示区域，动态渲染 API 返回的 `data.info` 字段。需保持 Apple 风格极简设计，处理加载和错误状态。

## Layout

### Page Structure

```
┌─────────────────────────────┐
│   Hero Section              │
│   - Title                   │
│   - Subtitle                │
│   - [NEW] Data Display      │  ← 新增数据展示区域
│   - Banner Image            │
│   - CTA Buttons             │
├─────────────────────────────┤
│   Footer                    │
└─────────────────────────────┘
```

### Data Display Position

数据展示区域位于副标题和 Banner 之间，居中对齐。

## Components

### Component List

| Component | Purpose | States |
|-----------|---------|--------|
| Data Display | 展示 API 返回的 info 文本 | Loading, Success, Error |

### Component Details

#### Data Display (`.hero__data`)

**Purpose**: 展示从 API 获取的动态数据

**States**:

1. **Loading**（加载中）:
   - 显示淡灰色占位文本："加载中..."
   - 颜色: `#999`
   - 字体大小: `16px`

2. **Success**（成功）:
   - 显示 `data.info` 内容
   - 颜色: `#666`（次色）
   - 字体大小: `18px`
   - 字重: `400`
   - 上下边距: `16px`

3. **Error**（错误）:
   - 显示错误提示："数据加载失败"
   - 颜色: `#d32f2f`（错误红）
   - 字体大小: `14px`
   - 可选：重试按钮

## User Flow

### Flow 1: Data Loading

1. 页面加载完成
2. 显示"加载中..."占位文本
3. 发起 API 请求
4. 请求成功 → 渲染 data.info 文本
5. 请求失败 → 显示错误提示

**Happy Path**:
```
[Page Load] → [Show Loading] → [API Request] → [Show Data]
```

**Error Path**:
```
[Page Load] → [Show Loading] → [API Error] → [Show Error Message]
```

## Responsive Behavior

### Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Mobile | ≤ 767px | 字体缩小至 16px，边距减小 |
| Tablet | 768px - 1023px | 标准布局 |
| Desktop | ≥ 1024px | 标准布局 |

### Mobile Adaptations

- 字体大小: `16px`（移动端更易读）
- 上下边距: `12px`（减小间距）

## Accessibility

### ARIA Labels

- Data Display: `aria-live="polite"`（动态内容更新时通知屏幕阅读器）
- Loading State: `role="status"`
- Error State: `role="alert"`

### Contrast Ratios

| Element | Foreground | Background | Ratio | WCAG Level |
|---------|------------|------------|-------|------------|
| Success Text | #666 | #FFF | 5.7:1 | AA |
| Error Text | #d32f2f | #FFF | 4.6:1 | AA |
| Loading Text | #999 | #FFF | 2.8:1 | - (装饰性) |

## Design Tokens

### Colors

```css
--color-data-text: #666;      /* 成功状态文本 */
--color-loading-text: #999;   /* 加载状态文本 */
--color-error-text: #d32f2f;  /* 错误状态文本 */
```

### Typography

```css
--font-size-data: 18px;       /* 桌面端数据文本 */
--font-size-data-mobile: 16px;/* 移动端数据文本 */
--font-weight-data: 400;      /* 常规字重 */
```

### Spacing

```css
--spacing-data-vertical: 16px;    /* 上下边距 */
--spacing-data-vertical-mobile: 12px; /* 移动端上下边距 */
```

## Animations & Transitions

| Interaction | Animation | Duration | Easing |
|-------------|-----------|----------|--------|
| Loading → Success | Fade in | 300ms | ease |
| Loading → Error | Fade in | 300ms | ease |

**Constraints**:
- Max transition duration: 300ms（符合项目规范）
- 使用 opacity transition，不使用 @keyframes

## Assets

无新增资源需求。
