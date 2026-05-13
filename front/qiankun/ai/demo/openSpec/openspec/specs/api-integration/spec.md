## ADDED Requirements

### Requirement: API Request and Response Handling

系统 SHALL 在页面加载时调用 `http://122.51.80.75:3600/white/test` 接口，并正确处理响应。

#### Scenario: Successful API response
- **WHEN** 页面加载完成
- **THEN** 系统发起 GET 请求到 `http://122.51.80.75:3600/white/test`
- **AND** 响应 code === 200 时，解析 data.info 字段

#### Scenario: Network error
- **WHEN** 网络请求失败（超时、断网等）
- **THEN** 系统捕获错误并显示错误状态

#### Scenario: Invalid response structure
- **WHEN** 响应中缺少 data.info 字段
- **THEN** 系统不渲染数据区域，记录控制台警告

### Requirement: Request Timeout

系统 SHALL 设置请求超时时间为 10 秒，超时后显示错误提示。

#### Scenario: Request timeout
- **WHEN** API 请求超过 10 秒未响应
- **THEN** 系统使用 AbortController 中止请求
- **AND** 显示"数据加载失败"错误提示
