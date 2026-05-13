## MODIFIED Requirements

### Requirement: Hero 主标题展示
系统 SHALL 在首屏中央展示品牌主标题，使用理性技术向文案，字号不小于 48px（桌面端），字重为 bold 或 black。

#### Scenario: 桌面端主标题渲染
- **WHEN** 用户在宽度 ≥ 768px 的设备上访问页面
- **THEN** 主标题字号为 64px，居中显示，颜色为 #111111

#### Scenario: 移动端主标题渲染
- **WHEN** 用户在宽度 < 768px 的设备上访问页面
- **THEN** 主标题字号为 40px，居中显示，颜色为 #111111

### Requirement: 全屏居中布局
Hero 区 SHALL 占据视口最小全屏高度（min-height 100vh），内容垂直水平居中，当内容（含 banner 图）超出视口高度时自然撑开不截断。

#### Scenario: 内容不超出视口
- **WHEN** 用户在任意设备上访问页面且 Hero 内容总高度 ≤ 视口高度
- **THEN** Hero 区高度为视口 100%，内容通过 Flexbox 垂直水平居中

#### Scenario: 内容超出视口
- **WHEN** 用户在较小视口设备上访问页面且 Hero 内容总高度 > 视口高度
- **THEN** Hero 区高度自然撑开为内容高度，不截断不溢出隐藏
