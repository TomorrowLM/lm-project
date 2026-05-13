## ADDED Requirements

### Requirement: 滚轮切换图片
系统 SHALL 监听用户鼠标滚轮事件，在 banner 区域滚动时切换显示不同的产品图片。

#### Scenario: 向下滚动切换
- **WHEN** 用户在 banner 区域向下滚动滚轮
- **THEN** banner 图片切换到下一张（顺序循环），同时触发 300ms 淡入淡出过渡

#### Scenario: 向上滚动切换
- **WHEN** 用户在 banner 区域向上滚动滚轮
- **THEN** banner 图片切换到上一张（逆序循环），同时触发 300ms 淡入淡出过渡

#### Scenario: 首尾循环
- **WHEN** 用户在当前显示最后一张图片时继续向下滚动
- **THEN** banner 图片切换到第一张，形成循环

### Requirement: 防抖节流
系统 SHALL 对滚轮事件施加 500ms 节流，防止快速连续滚动导致频繁切换。

#### Scenario: 快速滚动节流
- **WHEN** 用户在 500ms 内连续滚动多次滚轮
- **THEN** 仅触发一次图片切换，忽略中间的多余事件

### Requirement: 多图数据源
系统 SHALL 从 HTML 元素的 data 属性中读取图片列表，支持配置任意数量的 banner 图片。

#### Scenario: 读取图片列表
- **WHEN** 页面加载完成且 JS 执行
- **THEN** 从 `<img class="hero__banner">` 的 `data-images` 属性解析图片路径数组，至少包含 3 张图片

#### Scenario: 初始化默认图
- **WHEN** 页面首次渲染
- **THEN** banner 显示图片列表中的第一张作为初始图

### Requirement: 过渡动画
系统 SHALL 在图片切换时提供 300ms 淡入淡出过渡效果。

#### Scenario: 切换过渡
- **WHEN** banner 图片即将切换
- **THEN** 当前图片先淡出（opacity 0），300ms 内替换 src，新图片淡入（opacity 1）

### Requirement: 无 JS 回退
系统 SHALL 在浏览器禁用 JavaScript 时仍然能展示 banner 图片。

#### Scenario: JS 禁用回退
- **WHEN** 浏览器禁用 JavaScript
- **THEN** banner 区域显示第一张图片，静态展示，无切换功能
