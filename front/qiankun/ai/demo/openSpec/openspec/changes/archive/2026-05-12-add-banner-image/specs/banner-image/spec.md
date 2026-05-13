## ADDED Requirements

### Requirement: Banner 图片展示
系统 SHALL 在 Hero 区副标题与 CTA 按钮之间展示一张 banner 图片，作为产品视觉锚点。

#### Scenario: 桌面端 banner 渲染
- **WHEN** 用户在宽度 ≥ 768px 的设备上访问页面
- **THEN** banner 图片最大宽度为 600px，居中显示，保持原始宽高比

#### Scenario: 移动端 banner 渲染
- **WHEN** 用户在宽度 < 768px 的设备上访问页面
- **THEN** banner 图片宽度为 100%，保持原始宽高比

### Requirement: Banner 加载占位
系统 SHALL 在 banner 图片加载过程中显示浅灰色背景作为占位，加载失败时显示 alt 文本。

#### Scenario: 图片加载中
- **WHEN** 页面已渲染但 banner 图片尚未加载完成
- **THEN** 图片区域显示 #f5f5f5 浅灰色背景

#### Scenario: 图片加载失败
- **WHEN** banner 图片加载失败
- **THEN** 图片区域显示 alt 文本"产品展示图"，背景色为 #f5f5f5

### Requirement: Banner 图片资源
系统 SHALL 使用本地图片文件 `assets/banner.jpg` 作为 banner 图片源。

#### Scenario: 图片路径引用
- **WHEN** 页面渲染完成
- **THEN** `<img>` 标签的 src 属性指向 `assets/banner.jpg`，alt 属性为"产品展示图"

### Requirement: Banner 间距
Banner 图片 SHALL 与副标题保持 32px 上间距，与 CTA 按钮组通过 cta-group 的 margin-top 保持间距。

#### Scenario: 间距渲染
- **WHEN** 页面渲染完成
- **THEN** banner 图片 margin-top 为 32px，cta-group margin-top 保持 40px
