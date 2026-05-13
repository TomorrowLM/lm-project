## Context

当前项目为单页面静态网站，采用扁平目录结构。随着未来多页面扩展需求的确定，需要重构为页面独立的目录结构，同时保持项目宪法要求（纯 HTML + CSS + JS，零依赖，零构建工具）。

**Constraints**:
- 不能使用 @import 或构建工具
- 每个页面必须能独立预览
- 保持零依赖原则
- 功能和视觉必须完全不变

## Goals / Non-Goals

**Goals:**
- 将首页资源移到 `pages/home/` 目录
- 更新所有资源路径为同级引用
- 保持功能完全不变
- 为未来页面扩展提供清晰的目录模板

**Non-Goals:**
- 不引入 CSS/JS 共享机制（保持页面独立）
- 不创建其他页面（about、product 等）
- 不修改任何功能代码
- 不改变视觉样式

## Decisions

### 1. 页面独立资源 vs 共享资源

**Decision**: 采用页面独立资源方案

**Rationale**:
- ✅ 每个页面可独立预览，无需构建工具
- ✅ 资源路径简洁（同级目录）
- ✅ 删除页面不影响其他页面
- ✅ 符合项目宪法

**Alternatives considered**:
- 共享资源方案：需要 `../../` 路径，复杂且易错
- @import 方案：增加 HTTP 请求，违反性能原则

### 2. CSS Reset 重复处理

**Decision**: 接受 CSS Reset 在多个页面重复

**Rationale**:
- CSS Reset 仅 ~10 行代码
- Gzip 压缩后几乎为零
- 相比维护复杂度，这个代价可接受

**Alternatives considered**:
- 提取到 shared/：需要 @import 或构建工具
- 使用 JS 动态加载：违反零依赖原则

### 3. 图片资源归属

**Decision**: Banner 图片放到 `pages/home/images/`

**Rationale**:
- 这些图片当前仅首页使用
- 如果未来其他页面需要，可以复制或使用 CDN

## Risks / Trade-offs

### [Risk 1] 路径更新遗漏
→ **Mitigation**: 仔细检查所有引用路径，测试预览功能

### [Risk 2] CSS/JS 重复导致维护成本
→ **Mitigation**: 建立页面模板文档，新页面复制模板

### [Risk 3] 预览 URL 变化
→ **Mitigation**: 更新 README 文档说明新的访问路径

## Migration Plan

1. **创建目录结构**: `mkdir -p src/pages/home`
2. **移动 HTML**: `mv src/index.html src/pages/home/`
3. **复制 CSS**: `cp src/style.css src/pages/home/`
4. **复制 JS**: `cp src/script.js src/pages/home/`
5. **移动图片**: `mv src/images/ src/pages/home/`
6. **更新路径**: 修改 `index.html` 中的 `href` 和 `src`
7. **测试验证**: 启动本地服务器，确认功能正常
8. **清理**: 删除根目录的旧文件（如有残留）

**Rollback**: 
- 移回文件到原位置
- 恢复原始路径

## Open Questions

- [ ] 是否需要在 README 中添加目录结构说明？
- [ ] 是否需要创建页面模板文档供未来使用？
