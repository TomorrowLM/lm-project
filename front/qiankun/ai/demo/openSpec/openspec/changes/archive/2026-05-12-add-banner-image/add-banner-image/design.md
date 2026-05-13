## Context

当前首页由 `index.html` + `style.css` 组成，Hero 区为纯文字布局（标题 + 副标题 + CTA 按钮），Flexbox 垂直居中于 100vh 全屏。现需在标题与 CTA 之间插入 banner 图片，将纯文字 Hero 转为图文混合布局。

约束：
- 仍为纯 HTML + CSS，不引入 JavaScript
- 维持极简调性，banner 图不可喧宾夺主
- 文件仅 index.html + style.css + 图片资源

## Goals / Non-Goals

**Goals:**
- Banner 图在 Hero 区自然融入，与标题、CTA 形成视觉层次
- 响应式适配：桌面端大图展示，移动端适当缩放
- 图片加载前页面结构不跳动（无布局偏移）

**Non-Goals:**
- 不做图片懒加载（纯 CSS 无法实现）
- 不做 WebP/AVIF 格式适配（保持简单）
- 不做图片轮播或多图切换
- 不做暗色模式下的图片适配

## Decisions

### 1. Banner 图片位置：标题与 CTA 之间

**选择**: `<h1>` → `<p>` → `<img>` → `.cta-group` 的垂直排列顺序

**理由**: 用户视线从标题自然下落到产品图，再落到行动按钮，形成"认知→看见→行动"的流畅路径。放在标题上方会打断阅读节奏，放在 CTA 下方则太晚。

**备选方案**:
- 标题上方：视觉先于语义，冲击力强但阅读感差
- CTA 下方：行动号召被图隔开，点击意愿降低

### 2. 图片尺寸策略：max-width 约束 + 自然宽高比

**选择**: `max-width: 600px; width: 100%; height: auto;`

**理由**: 限制最大宽度防止图片撑破容器，`height: auto` 保持原始宽高比不变形。600px 在 768px 断点内有足够两侧留白。

**备选方案**:
- 固定宽高：不同图片需要手动调参，不灵活
- width: 100% 无上限：桌面端图片过大，压迫感强

### 3. 占位图方案：CSS background-color

**选择**: 为 `<img>` 设置 `background-color: #f5f5f5`，图片加载前显示浅灰占位

**理由**: 纯 CSS 方案，无需 JavaScript。浅灰色与白底协调，图片加载后自然覆盖。设置固定 `aspect-ratio` 防止布局偏移。

**备选方案**:
- 无占位：图片加载时页面跳动（CLS 问题）
- JavaScript 懒加载 + skeleton：违反纯 HTML/CSS 约束

### 4. 图片资源：SVG 占位图 + 预留真实图片路径

**选择**: 先用内联 SVG 占位图（灰色矩形 + 图标），`src` 预留为 `images/banner.jpg`，开发阶段用 SVG data URI 过渡

**理由**: 项目尚无真实产品图，需要可预览的占位方案。内联 SVG 无需额外文件，替换为真实图片时只需改 `src`。

### 5. 间距：banner 与上下元素各 32px

**选择**: `margin-top: 32px`（距副标题）、CTA `margin-top` 从 40px 调整为 32px（距 banner）

**理由**: 原方案中 CTA 距副标题 40px，插入 banner 后三个元素（副标题、图、CTA）等距 32px 更均匀。移动端缩小为 24px。

## Risks / Trade-offs

- **[图片加载影响首屏渲染速度]** → 使用 max-width 限制尺寸 + background-color 占位，真实图片替换后可压缩优化
- **[SVG 占位图替换为真实图时需改 src]** → 接受此手动替换成本，比引入构建工具简单
- **[纯 CSS 无法做懒加载]** → 图片较小（max-width 600px）且单张，加载影响可控
- **[插入图片后 Hero 内容可能超出 100vh]** → 通过 `min-height: 100vh`（非 `height`）保证内容自然撑开，不截断
