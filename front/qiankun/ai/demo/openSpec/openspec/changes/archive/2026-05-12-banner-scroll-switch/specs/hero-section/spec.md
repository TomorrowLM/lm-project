## MODIFIED Requirements

### Requirement: 全屏居中布局
Hero 区 SHALL 占据视口最小全屏高度（min-height 100vh），内容垂直水平居中，当内容（含 banner 图）超出视口高度时自然撑开不截断。Hero 区内的 banner 图支持滚轮交互切换。

#### Scenario: 内容不超出视口
- **WHEN** 用户在任意设备上访问页面且 Hero 内容总高度 ≤ 视口高度
- **THEN** Hero 区高度为视口 100%，内容通过 Flexbox 垂直水平居中

#### Scenario: 内容超出视口
- **WHEN** 用户在较小视口设备上访问页面且 Hero 内容总高度 > 视口高度
- **THEN** Hero 区高度自然撑开为内容高度，不截断不溢出隐藏

#### Scenario: Banner 支持滚轮交互
- **WHEN** 用户鼠标悬停在 banner 区域并滚动滚轮
- **THEN** banner 图片正常切换，不影响 Hero 区整体布局
