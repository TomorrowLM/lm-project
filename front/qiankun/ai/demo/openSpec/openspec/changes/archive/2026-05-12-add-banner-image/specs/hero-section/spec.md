## MODIFIED Requirements

### Requirement: Hero 主标题展示
系统 SHALL 在首屏中央展示品牌主标题，使用理性技术向文案，字号不小于 48px（桌面端），字重为 bold 或 black。banner 图片插入后主标题仍为首屏最上方的核心元素。

#### Scenario: 桌面端主标题渲染
- **WHEN** 用户在宽度 ≥ 768px 的设备上访问页面
- **THEN** 主标题字号为 64px，居中显示，颜色为 #111111

#### Scenario: 移动端主标题渲染
- **WHEN** 用户在宽度 < 768px 的设备上访问页面
- **THEN** 主标题字号为 40px，居中显示，颜色为 #111111

### Requirement: Hero 副标题展示
系统 SHALL 在主标题下方展示副标题，作为对产品价值的补充说明。副标题与主标题间距不变（16px），与下方 banner 图片间距 32px。

#### Scenario: 副标题渲染
- **WHEN** 页面加载完成
- **THEN** 副标题显示在主标题下方，颜色为 #666666，桌面端字号 20px，移动端字号 16px，与 banner 图片间距 32px

### Requirement: 双 CTA 按钮
系统 SHALL 在 banner 图片下方展示两个 CTA 按钮：主按钮（实心填充）和次按钮（边框样式），两者水平排列。CTA 按钮与 banner 图片间距为 40px。

#### Scenario: 主按钮样式
- **WHEN** 页面渲染完成
- **THEN** 主按钮背景色 #111111，文字颜色 #ffffff，内边距 14px 32px，无圆角或极小圆角

#### Scenario: 次按钮样式
- **WHEN** 页面渲染完成
- **THEN** 次按钮背景透明，边框 1px solid #111111，文字颜色 #111111，内边距 14px 32px

#### Scenario: 移动端按钮堆叠
- **WHEN** 用户在宽度 < 768px 的设备上访问页面
- **THEN** 两个 CTA 按钮垂直堆叠排列，宽度 100%

### Requirement: 全屏居中布局
Hero 区 SHALL 占据视口全屏高度（100vh），内容垂直水平居中。插入 banner 图片后仍保持全屏居中布局。

#### Scenario: 桌面端全屏居中
- **WHEN** 用户在任意设备上访问页面
- **THEN** Hero 区最小高度为视口高度的 100%，内容通过 Flexbox 居中对齐

### Requirement: 响应式适配
Hero 区 SHALL 在不同屏幕宽度下自适应，使用 768px 作为唯一断点。banner 图片在移动端宽度 100%，桌面端最大宽度 600px。

#### Scenario: 桌面端到移动端过渡
- **WHEN** 视口宽度从 ≥ 768px 缩小到 < 768px
- **THEN** 标题字号缩小、banner 图片宽度变为 100%、按钮从水平排列变为垂直堆叠、内边距收紧
