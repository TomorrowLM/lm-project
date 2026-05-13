# API Design: Integrate API Render Index

## Overview

接入后端 API 接口 `http://122.51.80.75:3600/white/test` 获取测试数据，并在首页 Hero Section 中动态渲染。该接口为只读 GET 接口，无需认证。

## Endpoints

### `GET /white/test`

**Description**: 获取测试数据，返回包含 info 字段的 JSON 对象

**Authentication**: None（公开接口）

#### Request

**Headers**:
```
Accept: application/json
```

**Query Parameters**: 无

**Body**: 无

#### Response

**Success (200 OK)**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "info": "test"
  }
}
```

**Response Fields**:
| Field | Type | Description |
|-------|------|-------------|
| code | number | 状态码，200 表示成功 |
| message | string | 响应消息 |
| data | object | 数据对象 |
| data.info | string | 测试信息文本 |

**Errors**:
| Status Code | Error Code | Description |
|-------------|------------|-------------|
| 200 | 非200 | 业务错误，message 字段包含错误信息 |
| 404 | - | 接口不存在 |
| 500 | - | 服务器内部错误 |
| Network Error | - | 网络异常或超时 |

#### Example

**Request**:
```bash
curl -X GET http://122.51.80.75:3600/white/test
```

**Response**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "info": "test"
  }
}
```

---

## Authentication

该接口为公开接口，无需认证。

## Error Handling

前端需处理以下错误场景：
1. **网络错误**: 显示"网络连接失败"提示
2. **HTTP 错误**: 显示"服务暂时不可用"提示
3. **业务错误**: code != 200 时，显示 message 中的错误信息
4. **数据异常**: data.info 缺失时，不渲染数据区域

## Versioning

- 当前版本: v1（无版本前缀）
- 接口地址固定，暂无版本化计划

## Rate Limiting

未知，建议：
- 页面加载时仅请求一次
- 不实现轮询或重复请求
