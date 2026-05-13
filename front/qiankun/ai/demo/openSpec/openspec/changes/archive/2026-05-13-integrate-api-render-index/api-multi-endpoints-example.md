# API Design: 多接口示例 - 官网完整 API 集成

## Overview

为手机官网提供完整的后端 API 支持，包括产品信息查询、购买意向提交和用户评价展示。所有接口均基于 RESTful 设计规范。

## Endpoints

### `GET /api/product`

**Description**: 获取产品详细信息，包括名称、价格、规格、图片等

**Authentication**: None（公开接口）

#### Request

**Headers**:
```
Accept: application/json
```

**Query Parameters**:
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| id | string | Yes | - | 产品 ID |

**Body**: 无

#### Response

**Success (200 OK)**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "phone-pro-2026",
    "name": "OpenSpec Phone Pro",
    "price": 5999,
    "currency": "CNY",
    "specs": {
      "chip": "A18 Pro",
      "battery": "5000mAh",
      "screen": "6.7 inch OLED"
    },
    "images": [
      "/images/phone-front.svg",
      "/images/phone-back.svg"
    ],
    "colors": ["深空黑", "银色", "金色"]
  }
}
```

**Errors**:
| Status Code | Error Code | Description |
|-------------|------------|-------------|
| 200 | 404 | 产品不存在 |
| 404 | - | 接口不存在 |
| 500 | - | 服务器内部错误 |

#### Example

**Request**:
```bash
curl -X GET "http://122.51.80.75:3600/api/product?id=phone-pro-2026"
```

---

### `POST /api/purchase`

**Description**: 提交用户购买意向，收集用户联系信息

**Authentication**: None（公开接口）

#### Request

**Headers**:
```
Content-Type: application/json
Accept: application/json
```

**Body**:
```json
{
  "productId": "phone-pro-2026",
  "customerName": "张三",
  "phone": "13800138000",
  "email": "zhangsan@example.com",
  "preferredColor": "深空黑"
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| productId | string | Yes | 产品 ID |
| customerName | string | Yes | 客户姓名 |
| phone | string | Yes | 联系电话（11 位手机号） |
| email | string | No | 电子邮箱 |
| preferredColor | string | No | 偏好颜色 |

#### Response

**Success (201 Created)**:
```json
{
  "code": 200,
  "message": "购买意向已提交",
  "data": {
    "submissionId": "sub-20260513-001",
    "submittedAt": "2026-05-13T10:30:00Z"
  }
}
```

**Errors**:
| Status Code | Error Code | Description |
|-------------|------------|-------------|
| 200 | 400 | 参数验证失败，message 包含详细错误 |
| 200 | 409 | 重复提交（相同手机号 24 小时内已提交） |
| 400 | - | 请求体格式错误 |
| 500 | - | 服务器内部错误 |

#### Example

**Request**:
```bash
curl -X POST "http://122.51.80.75:3600/api/purchase" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "phone-pro-2026",
    "customerName": "张三",
    "phone": "13800138000",
    "email": "zhangsan@example.com",
    "preferredColor": "深空黑"
  }'
```

---

### `GET /api/reviews`

**Description**: 获取产品用户评价列表，支持分页

**Authentication**: None（公开接口）

#### Request

**Headers**:
```
Accept: application/json
```

**Query Parameters**:
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| productId | string | Yes | - | 产品 ID |
| page | number | No | 1 | 页码 |
| limit | number | No | 10 | 每页数量（最大 50） |
| sort | string | No | "latest" | 排序方式：latest, highest, lowest |

**Body**: 无

#### Response

**Success (200 OK)**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "reviews": [
      {
        "id": "rev-001",
        "userId": "user-123",
        "userName": "李四",
        "rating": 5,
        "content": "非常好用，性能强劲！",
        "createdAt": "2026-05-10T08:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 156,
      "totalPages": 16
    },
    "summary": {
      "averageRating": 4.7,
      "totalReviews": 156
    }
  }
}
```

**Errors**:
| Status Code | Error Code | Description |
|-------------|------------|-------------|
| 200 | 404 | 产品不存在 |
| 400 | - | 分页参数错误 |
| 500 | - | 服务器内部错误 |

#### Example

**Request**:
```bash
curl -X GET "http://122.51.80.75:3600/api/reviews?productId=phone-pro-2026&page=1&limit=10"
```

---

## Authentication

所有接口当前均为公开接口，无需认证。

**未来计划**：
- `/api/purchase` 可能需要添加短信验证码防止滥用
- 用户评价提交接口（未列出）需要用户登录认证

## Error Handling

### 统一错误响应格式

```json
{
  "code": 400,
  "message": "参数验证失败",
  "errors": [
    {
      "field": "phone",
      "message": "手机号格式不正确"
    }
  ]
}
```

### 前端错误处理策略

1. **网络错误**: 显示"网络连接失败，请检查网络"
2. **HTTP 错误**: 显示"服务暂时不可用，请稍后重试"
3. **业务错误**: 
   - 400: 显示表单验证错误（高亮错误字段）
   - 404: 显示"内容不存在"
   - 409: 显示"您已提交过，请等待联系"
4. **数据异常**: 记录控制台警告，显示降级内容

## Versioning

- **策略**: URL 路径版本化（如 `/api/v1/product`）
- **当前版本**: v1（无版本前缀，默认为 v1）
- **废弃政策**: 
  - 提前 3 个月通知
  - 旧版本 API 返回 `Deprecation` header
  - 文档中标注废弃日期

## Rate Limiting

### 限制策略

| Endpoint | Limit | Window | Notes |
|----------|-------|--------|-------|
| GET /api/product | 100 req/min | 60s | 缓存 5 分钟 |
| POST /api/purchase | 3 req/hour | 3600s | 防 spam |
| GET /api/reviews | 60 req/min | 60s | 缓存 2 分钟 |

### 响应 Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1715587200
```

### 超过限制响应

```json
{
  "code": 429,
  "message": "请求过于频繁，请稍后重试",
  "retryAfter": 30
}
```

## Caching

### 客户端缓存建议

| Endpoint | Cache Duration | Strategy |
|----------|----------------|----------|
| GET /api/product | 5 分钟 | localStorage + 时间戳 |
| GET /api/reviews | 2 分钟 | 内存缓存 |
| POST /api/purchase | 不缓存 | - |

## Migration Notes

当前为初始版本，无历史接口需要迁移。

**向后兼容承诺**：
- 不删除已有字段
- 新增字段为可选
- 字段类型不变
- 错误码向后兼容
