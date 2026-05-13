## 1. 图片资源准备

- [x] 1.1 创建 `images/` 目录，放入 SVG 占位图文件 `banner.svg`（灰色矩形 + 图标，16:10 宽高比）

## 2. HTML 结构修改

- [x] 2.1 在 index.html 的 Hero 区副标题 `<p>` 与 `.cta-group` 之间插入 `<img class="hero__banner" src="images/banner.svg" alt="产品展示">`

## 3. Banner 样式实现

- [x] 3.1 在 style.css 中添加 `.hero__banner` 样式：max-width 600px、width 100%、height auto、margin-top 32px、居中显示、background-color #f5f5f5、aspect-ratio 16/10
- [x] 3.2 修改 `.cta-group` 的 margin-top 从 40px 改为 32px（适配 banner 插入后的间距）

## 4. 响应式适配

- [x] 4.1 在移动端媒体查询中添加 `.hero__banner` 的 margin-top 改为 24px
- [x] 4.2 在移动端媒体查询中修改 `.cta-group` 的 margin-top 改为 24px
- [x] 4.3 确认移动端 banner 图片宽度自适应（width 100% + 父容器 padding）

## 5. 验证

- [x] 5.1 确认桌面端 banner 图正常显示，居中，最大宽度 600px
- [x] 5.2 确认移动端 banner 图自适应缩放
- [x] 5.3 确认图片加载前无布局偏移（background-color 占位生效）
- [x] 5.4 确认 Hero 区内容超出视口时不截断
