# 页面索引总览

## 页面列表

| 页面 | 路径 | 功能数量 | 索引文件 |
|------|------|----------|----------|
| Home（首页） | `src/pages/home/` | 5 | [查看](home/INDEX.md) |
| About（关于页） | `src/pages/about/` | 0 | 未创建 |
| Product（产品页） | `src/pages/product/` | 0 | 未创建 |

---

## 快速查找

### 按页面查找变更

```bash
# 查找首页相关变更
openspec list | grep home

# 查找关于页相关变更
openspec list | grep about

# 查找全局变更
openspec list | grep global
```

### 按页面查找规格

```bash
# 查看首页相关规格
ls openspec/specs/ | grep -E "hero|banner|footer"

# 查看所有规格
ls openspec/specs/
```

---

## 变更命名规范

**格式**: `<page>-<action>-<feature>`

**页面标识**:
- `home` - 首页
- `about` - 关于页
- `product` - 产品页
- `global` - 全局变更（影响多个页面）

**示例**:
- `home-add-banner-image` - 首页添加 Banner 图片
- `about-add-team-section` - 关于页添加团队介绍
- `global-update-color-scheme` - 全局更新配色方案

---

## 维护指南

### 创建新页面时

1. 在 `src/pages/` 下创建页面目录
2. 在 `openspec/pages/` 下创建索引目录
3. 复制 `INDEX.md` 模板并填写信息
4. 更新本文件（pages/INDEX.md）的页面列表

### 完成变更时

1. 归档变更后，更新对应页面的 `INDEX.md`
2. 在"历史变更"表格中添加新记录
3. 如有新功能，更新"当前功能列表"

---

## 文件结构

```
openspec/
├── pages/                    ← 页面索引
│   ├── INDEX.md              ← 本文件（总览）
│   └── home/
│       └── INDEX.md          ← 首页索引
│
├── specs/                    ← 功能规格
│   ├── hero-section/
│   ├── banner-image/
│   ├── banner-scroll/
│   ├── api-integration/
│   └── dynamic-data-rendering/
│
└── changes/
    └── archive/              ← 归档变更
        ├── 2026-05-12-add-banner-image/
        ├── 2026-05-12-banner-scroll-switch/
        ├── 2026-05-13-integrate-api-render-index/
        └── 2026-05-13-refactor-multi-page-structure/
```
