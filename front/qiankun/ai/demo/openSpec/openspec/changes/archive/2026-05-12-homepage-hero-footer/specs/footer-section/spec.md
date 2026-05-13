## ADDED Requirements

### Requirement: 一行式 Footer 布局
系统 SHALL 在页面底部展示一行式 Footer，包含三部分内容水平排列：链接导航、社交媒体图标、版权与法律信息，以分隔符（·）连接。

#### Scenario: 桌面端 Footer 渲染
- **WHEN** 用户在宽度 ≥ 768px 的设备上访问页面
- **THEN** Footer 内容单行水平居中排列，字号 14px，颜色 #666666

#### Scenario: 移动端 Footer 渲染
- **WHEN** 用户在宽度 < 768px 的设备上访问页面
- **THEN** Footer 内容垂直堆叠居中排列，各元素之间间距 8px

### Requirement: 链接导航
Footer SHALL 包含关键导航链接，至少涵盖：产品、支持、关于。

#### Scenario: 链接可点击
- **WHEN** 用户点击 Footer 中的任意链接
- **THEN** 链接表现为可交互元素，hover 状态颜色变为 #111111，无下划线装饰

#### Scenario: 链接语义正确
- **WHEN** 页面渲染完成
- **THEN** 每个链接使用 `<a>` 标签，`href` 指向对应路径（当前可用 `#` 占位）

### Requirement: 社交媒体入口
Footer SHALL 包含社交媒体平台入口链接，以文字标签形式展示（非图标文件），至少包含 GitHub。

#### Scenario: 社交链接展示
- **WHEN** 页面渲染完成
- **THEN** 社交链接以纯文字标签形式展示，点击可跳转至对应平台

### Requirement: 版权与法律声明
Footer SHALL 包含版权年份和法律信息链接（隐私政策、服务条款）。

#### Scenario: 版权信息展示
- **WHEN** 页面渲染完成
- **THEN** 显示格式为 "© 2026 品牌名"，后跟法律链接

#### Scenario: 法律链接可访问
- **WHEN** 用户点击隐私政策或服务条款链接
- **THEN** 链接表现为可交互元素，当前 href 可用 `#` 占位

### Requirement: 顶部分隔线
Footer 顶部 SHALL 有一条水平分隔线与 Hero 区分隔。

#### Scenario: 分隔线渲染
- **WHEN** 页面渲染完成
- **THEN** Footer 顶部显示 1px solid #e0e0e0 分隔线，与 Footer 内容间距 24px
