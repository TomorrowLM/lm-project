## Why

当前 banner 图是静态单图展示。对于手机产品而言，一张图难以展示多角度外观和不同配色。参考苹果官网产品页的滚轮切换体验，通过滚轮滚动切换多张 banner 图片，能让用户在自然浏览行为中"翻阅"产品，提升交互深度与产品展示力。

## What Changes

- **BREAKING**: 项目约束从"纯 HTML + CSS 零 JS"变为"允许独立 JS 脚本"，`index.html` 将引入 `<script>` 标签
- 新增 `script.js` 文件，实现滚轮监听 + banner 图片切换逻辑
- 新增多张 banner 占位图（SVG），至少 3 张以形成轮播序列
- 修改 `index.html`：引入 script.js，banner img 改为带数据属性、可被 JS 操控
- 修改 `style.css`：新增切换过渡样式（淡入淡出或滑动）

## Capabilities

### New Capabilities
- `banner-scroll`: 滚轮驱动的 banner 图片切换功能，监听 wheel 事件，支持多图循环切换、过渡动画、防抖处理

### Modified Capabilities
- `banner-image`: banner 从单图静态展示变为多图滚轮切换，原始 src 变为图片列表的数据源
- `hero-section`: Hero 区新增 script.js 依赖，页面从纯静态变为含交互脚本

## Impact

- 修改 `index.html`：引入 `<script src="script.js">`
- 修改 `style.css`：新增 banner 切换过渡动画样式
- 新增 `script.js`：滚轮事件监听 + 图片索引切换逻辑
- 新增多张 SVG 占位图（至少 `images/banner-1.svg`、`banner-2.svg`、`banner-3.svg`）
- 页面首次需要下载 JS 文件，增加约 1-2KB 网络请求
