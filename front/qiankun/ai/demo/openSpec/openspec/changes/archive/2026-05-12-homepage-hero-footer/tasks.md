## 1. 项目初始化

- [x] 1.1 创建 index.html 文件，包含基础 HTML5 结构（DOCTYPE、meta viewport、charset UTF-8）
- [x] 1.2 创建 style.css 文件，引入 CSS Reset 和系统字体栈
- [x] 1.3 在 index.html 中通过 `<link>` 引入 style.css

## 2. Hero 区实现

- [x] 2.1 在 index.html 中添加 Hero 区语义结构：`<section class="hero">` 包含 `<h1>` 主标题、`<p>` 副标题、`<div class="cta-group">` 包含两个 `<a>` 按钮
- [x] 2.2 在 style.css 中实现 Hero 区全屏居中布局：min-height 100vh、Flexbox 垂直水平居中、文本居中
- [x] 2.3 在 style.css 中实现主标题样式：桌面端 64px / bold、移动端 40px、颜色 #111111
- [x] 2.4 在 style.css 中实现副标题样式：桌面端 20px / normal、移动端 16px、颜色 #666666、与主标题间距 16px
- [x] 2.5 在 style.css 中实现主 CTA 按钮样式：背景 #111111、文字 #ffffff、内边距 14px 32px
- [x] 2.6 在 style.css 中实现次 CTA 按钮样式：背景透明、1px solid #111111 边框、文字 #111111、内边距 14px 32px
- [x] 2.7 在 style.css 中实现移动端 CTA 按钮堆叠：宽度 100%、垂直排列、间距 12px

## 3. Footer 区实现

- [x] 3.1 在 index.html 中添加 Footer 语义结构：`<footer>` 包含链接导航组、社交媒体组、版权与法律组
- [x] 3.2 在 style.css 中实现 Footer 一行式布局：水平居中排列、字号 14px、颜色 #666666
- [x] 3.3 在 style.css 中实现 Footer 顶部分隔线：border-top 1px solid #e0e0e0、内边距 24px
- [x] 3.4 在 style.css 中实现链接 hover 效果：颜色变为 #111111、无下划线
- [x] 3.5 在 style.css 中实现移动端 Footer 垂直堆叠：元素居中、间距 8px

## 4. 响应式适配

- [x] 4.1 确认 style.css 中 768px 断点媒体查询覆盖所有移动端样式（标题字号、按钮堆叠、Footer 堆叠、内边距收紧）
- [x] 4.2 浏览器验证：桌面端（≥768px）和移动端（<768px）页面渲染正确

## 5. 最终验证

- [x] 5.1 确认 HTML 语义正确：section/footer/h1/p/a 标签使用恰当
- [x] 5.2 确认无 JavaScript 依赖：页面在禁用 JavaScript 的浏览器中正常渲染
- [x] 5.3 确认文件结构正确：仅包含 index.html 和 style.css 两个文件
