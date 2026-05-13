## 1. 图片资源准备

- [x] 1.1 创建 `images/banner-1.svg`、`images/banner-2.svg`、`images/banner-3.svg` 三张 SVG 占位图（不同配色区分的手机产品图）

## 2. JavaScript 脚本实现

- [x] 2.1 创建 `script.js`，包含 BannerScroll 对象：读取 `data-images` 属性解析图片列表、维护 currentIndex、监听 wheel 事件
- [x] 2.2 实现 wheel 事件处理：`deltaY > 0` 切下一张，`deltaY < 0` 切上一张，模运算实现首尾循环
- [x] 2.3 实现 500ms 节流（throttle），防止快速滚动频繁切换
- [x] 2.4 实现切换动画：设置 `opacity: 0` → 300ms 后换 `src` → `opacity: 1`（利用 CSS transition）

## 3. HTML + CSS 修改

- [x] 3.1 在 index.html 的 `<img class="hero__banner">` 上添加 `data-images` 属性（JSON 数组格式存储三张图片路径），并添加初始 `src`
- [x] 3.2 在 index.html 的 `</body>` 前引入 `<script src="script.js">`
- [x] 3.3 在 style.css 中为 `.hero__banner` 添加 `transition: opacity 0.3s ease` 过渡样式

## 4. 回退处理

- [x] 4.1 确认 HTML 中 `<img>` 有默认 `src`（作为无 JS 环境的回退展示）
- [x] 4.2 验证禁用 JavaScript 时 banner 仍正常显示初始图片

## 5. 最终验证

- [x] 5.1 桌面端：滚轮向下切换至下一张、向上切换至上一张，首尾循环正常
- [x] 5.2 节流验证：快速滚轮只触发一次切换
- [x] 5.3 过渡动画验证：切换时有 300ms 淡入淡出效果
- [x] 5.4 移动端：页面正常浏览（滚轮切换不生效但无报错）
