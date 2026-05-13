## ADDED Requirements

### Requirement: Banner 图片展示
系统 SHALL 在 Hero 区副标题与 CTA 按钮之间展示一张 banner 图片，作为产品的视觉呈现。

#### Scenario: Banner 图片渲染
- **WHEN** 页面加载完成
- **THEN** banner 图片显示在副标题下方、CTA 按钮上方，居中对齐

#### Scenario: 图片自然宽高比
- **WHEN** banner 图片加载完成
- **THEN** 图片保持原始宽高比，不拉伸不裁切

### Requirement: Banner 响应式尺寸
Banner 图片 SHALL 根据视口宽度自适应缩放，桌面端最大宽度 600px，移动端宽度 100%。

#### Scenario: 桌面端 banner 尺寸
- **WHEN** 用户在宽度 ≥ 768px 的设备上访问页面
- **THEN** banner 图片最大宽度为 600px，宽度为容器宽度或 600px 中较小值，高度自动

#### Scenario: 移动端 banner 尺寸
- **WHEN** 用户在宽度 < 768px 的设备上访问页面
- **THEN** banner 图片宽度为容器 100%（减去内边距），高度自动

### Requirement: 图片加载占位
Banner 图片 SHALL 在加载前显示浅灰色占位背景，防止布局偏移。

#### Scenario: 加载前占位
- **WHEN** 图片尚未加载完成
- **THEN** 图片区域显示 #f5f5f5 背景色，并具有预设的 aspect-ratio 保持空间

### Requirement: Banner 间距
Banner 图片与周围元素 SHALL 保持均匀间距，桌面端 32px，移动端 24px。

#### Scenario: 桌面端间距
- **WHEN** 用户在宽度 ≥ 768px 的设备上访问页面
- **THEN** banner 图片 margin-top 32px（距副标题），CTA 组 margin-top 32px（距 banner）

#### Scenario: 移动端间距
- **WHEN** 用户在宽度 < 768px 的设备上访问页面
- **THEN** banner 图片 margin-top 24px（距副标题），CTA 组 margin-top 24px（距 banner）
