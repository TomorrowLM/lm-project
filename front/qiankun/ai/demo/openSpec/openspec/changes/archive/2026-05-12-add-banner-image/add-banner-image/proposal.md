## Why

当前首页 Hero 区为纯文字驱动，虽然极简有力，但缺少产品视觉展示。对于手机产品而言，一张 banner 图能直观传达产品外观与质感，让访客在 3 秒内建立"看见产品"的认知，与文字标题形成视觉+语义的双重冲击。

## What Changes

- 在 Hero 区标题与 CTA 按钮之间插入 banner 图片
- 新增图片资源文件（banner.jpg）到项目目录
- 修改 style.css 添加 banner 样式及响应式适配
- 修改 index.html 添加 `<img>` 标签

## Capabilities

### New Capabilities
- `banner-image`: Hero 区 banner 图片展示，包含响应式尺寸适配、加载占位处理、与周围元素的间距协调

### Modified Capabilities
- `hero-section`: Hero 区布局因插入 banner 图产生结构调整，内容区从纯文字变为图文混合

## Impact

- 修改 `index.html`：Hero 区新增 `<img>` 元素
- 修改 `style.css`：新增 banner 样式规则和响应式断点调整
- 新增图片资源文件（banner.jpg 或占位图）
- 页面首次加载将产生图片网络请求，影响纯文字页面的即时渲染体验
