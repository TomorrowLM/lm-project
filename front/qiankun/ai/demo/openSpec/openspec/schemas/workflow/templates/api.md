# API Design: [Change Name]

## Overview

Brief description of the API and its purpose. What problem does this API solve? Who are the consumers?

## Endpoints

### `METHOD /path/to/endpoint`

**Description**: What this endpoint does

**Authentication**: Required / Optional / None

#### Request

**Headers**:
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Path Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | Resource identifier |

**Query Parameters**:
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| page | number | No | 1 | Page number |
| limit | number | No | 20 | Items per page |

**Body**:
```json
{
  "field1": "value",
  "field2": 123
}
```

#### Response

**Success (200 OK)**:
```json
{
  "data": {},
  "meta": {
    "total": 100,
    "page": 1
  }
}
```

**Errors**:
| Status Code | Error Code | Description |
|-------------|------------|-------------|
| 400 | INVALID_REQUEST | Missing or invalid parameters |
| 401 | UNAUTHORIZED | Authentication required |
| 404 | NOT_FOUND | Resource not found |
| 500 | INTERNAL_ERROR | Server error |

#### Example

**Request**:
```bash
curl -X GET https://api.example.com/v1/resources?page=1&limit=10 \
  -H "Authorization: Bearer token123"
```

**Response**:
```json
{
  "data": [
    {
      "id": "123",
      "name": "Example Resource"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1
  }
}
```

---

## Authentication

Describe authentication mechanism:
- Token-based (JWT, API keys)
- OAuth 2.0 flows
- Session-based
- None (public API)

## Error Handling

Standard error response format:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

## Versioning

- API version strategy (URL path, headers, etc.)
- Current version: v1
- Deprecation policy

## Rate Limiting

- Rate limit policies
- Headers included in responses:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## Migration Notes

If this is a modification to existing API:
- What changed
- Breaking changes
- Migration path for consumers
- Deprecation timeline
