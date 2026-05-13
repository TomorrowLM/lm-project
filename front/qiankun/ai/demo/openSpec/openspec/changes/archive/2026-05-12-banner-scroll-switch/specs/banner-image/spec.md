## MODIFIED Requirements

### Requirement: Banner 图片展示
系统 SHALL 在 Hero 区副标题与 CTA 按钮之间展示多张 banner 图片，支持用户通过鼠标滚轮在图片间切换，作为产品的多角度视觉呈现。

#### Scenario: Banner 图片渲染
- **WHEN** 页面加载完成
- **THEN** banner 图片显示在副标题下方、CTA 按钮上方，居中对齐，默认展示第一张图片

#### Scenario: 图片自然宽高比
- **WHEN** banner 图片加载完成
- **THEN** 图片保持原始宽高比，不拉伸不裁切

#### Scenario: 滚轮切换图片
- **WHEN** 用户在 banner 区域滚动滚轮
- **THEN** banner 图片在图片列表中循环切换，配合淡入淡出动画
