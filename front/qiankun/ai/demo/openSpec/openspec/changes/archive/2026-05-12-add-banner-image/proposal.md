## Why

当前 Hero 区是纯文字驱动，虽然极简有力，但缺少视觉锚点。添加 banner 图可以在首屏为手机产品提供直观的产品展示，增强视觉冲击力，同时保持整体极简调性。banner 图作为文字的补充而非替代，让访客在理解产品定位的同时看到产品形态。

## What Changes

- 在 Hero 区副标题与 CTA 按钮之间插入 banner 图片
- 添加图片资源文件（banner.jpg 或 banner.png）
- 修改 index.html 添加 `<img>` 标签
- 修改 style.css 添加 banner 样式与响应式适配

## Capabilities

### New Capabilities
- `banner-image`: Hero 区 banner 图片展示，包含响应式尺寸适配、加载占位处理、与现有文字布局的整合

### Modified Capabilities
- `hero-section`: Hero 区结构变化，在副标题与 CTA 按钮之间新增图片元素，影响原有垂直间距与布局节奏

## Impact

- 修改 `index.html`：Hero 区新增 `<img>` 元素
- 修改 `style.css`：新增 banner 样式、调整 Hero 区间距
- 新增图片资源文件（需放置在项目目录下）
- 页面首次加载将产生图片网络请求（之前为零请求）
