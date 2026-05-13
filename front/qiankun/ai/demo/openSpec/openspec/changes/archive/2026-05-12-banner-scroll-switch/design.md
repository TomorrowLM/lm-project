## Context

当前 banner 区为单张 `<img>` 静态展示，无交互能力。现需添加滚轮驱动的图片切换，类似 Apple 官网产品页：用户在 banner 区域滚动滚轮时，图片按序循环切换，配合过渡动画。

约束变化：
- **放开 JS 限制**：允许单个 `<script>` 标签引入 `script.js`
- 仍不引入任何第三方库或框架
- 维持极简调性，动画须克制不过度

## Goals / Non-Goals

**Goals:**
- 用户在 banner 区域使用滚轮时切换图片，向下滚动展示下一张，向上滚动展示上一张
- 至少支持 3 张图片循环切换（首尾相接）
- 切换时有淡入淡出过渡动画（0.3s opacity）
- 有防抖机制，防止快速滚动时频繁切换

**Non-Goals:**
- 不做触摸滑动（移动端手势）
- 不做点击/拖拽切换
- 不做自动轮播
- 不做指示器（小圆点）
- 不做键盘切换

## Decisions

### 1. 图片数据源：HTML data 属性

**选择**: 在 `<img>` 上使用 `data-images` 属性存储图片路径数组（JSON 格式），初始化 `src` 为第一张，JS 读取该属性进行切换

**理由**: 零配置方案，图片数据与 HTML 结构绑定，不需要单独的 JS 配置文件。修改图片列表只需改 HTML 中的 `data-images`。

**备选方案**:
- JS 数组硬编码：图片与 HTML 分离，不够直观
- CSS variables：不足以表达数组结构

### 2. 事件监听：wheel 事件 + 节流

**选择**: 监听 `wheel` 事件，使用 500ms 节流（throttle）防止快速连续触发

**理由**: `wheel` 事件是标准 DOM 事件，兼容性好。500ms 节流保证用户有足够时间看到每张图，避免滚一下跳过好几张。

**备选方案**:
- `scroll` 事件：需要在可滚动容器中，与 Hero 区 100vh 布局冲突
- `IntersectionObserver`：与滚轮切换语义不符
- 更短的节流（200ms）：切换太快看不清

### 3. 循环逻辑：双向循环

**选择**: 维护当前索引 `currentIndex`，向下滚动 `(index + 1) % total`，向上滚动 `(index - 1 + total) % total`

**理由**: 首尾相接的循环体验流畅，用户不会遇到"到头了"的边界。

### 4. 过渡动画：CSS opacity transition

**选择**: CSS class 控制淡入淡出——切换时先设置 `opacity: 0`，300ms 后换 `src`，再设置 `opacity: 1`

**理由**: CSS transition 比 JS 动画性能好，GPU 加速。简单淡入淡出极简且有效。300ms 足够快但有感知。

**备选方案**:
- CSS transform slide：需要更多 DOM 结构（两个 img 叠放）
- 直接用 CSS transition on `opacity` + JS 操控 class：当前选择

### 5. 文件结构：独立 script.js

**选择**: 新建 `script.js`，通过 `<script src="script.js">` 引入，放在 `</body>` 前

**理由**: 独立文件便于管理，不污染 HTML。放在 body 末尾确保 DOM 就绪，无需 `DOMContentLoaded` 事件监听。

## Risks / Trade-offs

- **[引入 JS 增加页面复杂度]** → 仅一个独立脚本文件，约 1KB，无第三方依赖，仍保持精简
- **[部分用户禁用 JavaScript]** → 回退行为：`<noscript>` 保底显示第一张图片，体验降级但不丢失内容
- **[wheel 事件在 mobile 上不触发]** → 移动端目前无切换能力（Non-Goal），但不影响页面正常浏览
- **[500ms 节流可能让滚动感觉"慢半拍"]** → 可选参数，后续可根据反馈调整
