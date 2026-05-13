## 1. 准备图片资源

- [x] 1.1 创建 `assets/` 目录
- [x] 1.2 放置 banner 图片文件 `assets/banner.svg`（SVG 占位图，尺寸 1200x800px）

## 2. 修改 HTML 结构

- [x] 2.1 在 index.html 的 Hero 区中，在 `hero__subtitle` 与 `cta-group` 之间添加 `<img class="hero__banner" src="assets/banner.svg" alt="产品展示图">`

## 3. 添加 Banner CSS 样式

- [x] 3.1 在 style.css 中添加 `.hero__banner` 样式：max-width 600px、width 100%、height auto、margin-top 32px、background-color #f5f5f5、display block
- [x] 3.2 在移动端媒体查询中添加 `.hero__banner` 响应式样式：width 100%

## 4. 验证

- [x] 4.1 确认桌面端（≥768px）banner 图片最大宽度 600px，居中显示
- [x] 4.2 确认移动端（<768px）banner 图片宽度 100%
- [x] 4.3 确认图片加载中显示 #f5f5f5 占位背景
- [x] 4.4 确认图片加载失败时 alt 文本可见
