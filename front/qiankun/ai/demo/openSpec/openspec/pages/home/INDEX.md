# Home 页面 - 功能清单

## 页面信息

- **路径**: `src/pages/home/`
- **URL**: `http://localhost:8080/pages/home/`
- **创建日期**: 2026-05-13

---

## 当前功能列表

### 1. Hero Section（首屏展示）
- **描述**: 页面首屏，包含标题、副标题、数据展示和 CTA 按钮
- **规格**: `openspec/specs/hero-section/spec.md`
- **相关文件**:
  - `src/pages/home/index.html` (第 11-20 行)
  - `src/pages/home/style.css` (Hero Section 部分)

### 2. Banner 轮播
- **描述**: 产品展示图片轮播，支持滚轮切换
- **规格**: 
  - `openspec/specs/banner-image/spec.md`
  - `openspec/specs/banner-scroll/spec.md`
- **相关文件**:
  - `src/pages/home/index.html` (第 15 行)
  - `src/pages/home/script.js` (Banner 轮播逻辑)
  - `src/pages/home/images/banner-1.svg`
  - `src/pages/home/images/banner-2.svg`
  - `src/pages/home/images/banner-3.svg`

### 3. API 数据展示
- **描述**: 动态加载并展示 API 返回的数据
- **规格**: 
  - `openspec/specs/api-integration/spec.md`
  - `openspec/specs/dynamic-data-rendering/spec.md`
- **相关文件**:
  - `src/pages/home/index.html` (第 14 行)
  - `src/pages/home/style.css` (Data Display 部分)
  - `src/pages/home/script.js` (ApiIntegration 模块)
- **API 接口**: `http://122.51.80.75:3600/white/test`

### 4. CTA 按钮组
- **描述**: 主要和次要操作按钮
- **规格**: `openspec/specs/hero-section/spec.md`
- **相关文件**:
  - `src/pages/home/index.html` (第 16-19 行)
  - `src/pages/home/style.css` (CTA Buttons 部分)

### 5. Footer（页脚）
- **描述**: 包含导航链接、社交链接和版权信息
- **规格**: `openspec/specs/footer-section/spec.md`
- **相关文件**:
  - `src/pages/home/index.html` (第 22-42 行)
  - `src/pages/home/style.css` (Footer 部分)

---

## 历史变更

| 日期 | 变更名称 | 描述 | 归档位置 |
|------|----------|------|----------|
| 2026-05-13 | home-add-banner-image | 添加 Banner 图片展示 | `archive/2026-05-12-add-banner-image/` |
| 2026-05-13 | home-banner-scroll-switch | 添加滚轮切换功能 | `archive/2026-05-12-banner-scroll-switch/` |
| 2026-05-13 | home-integrate-api-render-index | 接入 API 数据渲染 | `archive/2026-05-13-integrate-api-render-index/` |
| 2026-05-13 | home-refactor-multi-page-structure | 重构为页面独立结构 | `archive/2026-05-13-refactor-multi-page-structure/` |

---

## 技术栈

- **HTML**: BEM 命名规范
- **CSS**: 系统字体栈、Apple 风格极简设计
- **JS**: IIFE 模块、严格模式、零依赖
- **资源**: SVG 图片

---

## 响应式断点

| 断点 | 宽度 | 布局 |
|------|------|------|
| Mobile | ≤ 767px | 单列堆叠 |
| Tablet | 768px - 1023px | 标准布局 |
| Desktop | ≥ 1024px | 标准布局 |

---

## 注意事项

- 所有样式在 `src/pages/home/style.css` 中独立定义
- 包含完整的 CSS Reset 和基础样式
- Banner 图片仅首页使用，存放在 `src/pages/home/images/`
