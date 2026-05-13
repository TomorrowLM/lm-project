## Why

当前项目采用单页面根目录结构（`src/index.html`），虽然简单但无法支持未来多页面扩展。需要重构为页面独立的目录结构，每个页面拥有自己的 HTML、CSS、JS 和图片资源，为后续添加 about、product 等页面奠定基础。

## What Changes

- 创建 `src/pages/home/` 目录
- 将 `src/index.html` 移动到 `src/pages/home/index.html`
- 将 `src/style.css` 复制到 `src/pages/home/style.css`
- 将 `src/script.js` 复制到 `src/pages/home/script.js`
- 将 `src/images/` 移动到 `src/pages/home/images/`
- 更新 `index.html` 中的资源路径（从相对路径改为同级路径）
- 保留根目录结构供未来其他页面使用

## Capabilities

### New Capabilities
- `page-independence`: 页面独立资源管理能力，每个页面拥有完整的 HTML/CSS/JS/Images
- `multi-page-scalability`: 多页面扩展能力，支持未来快速添加新页面

### Modified Capabilities
<!-- 无现有能力的需求变更，仅为架构调整 -->

## Impact

- **Affected Code**: 所有文件路径需要更新
- **File Structure**: 从扁平结构改为分层结构
- **Development Workflow**: 预览 URL 从 `localhost:8080/` 变为 `localhost:8080/pages/home/`
- **Future Pages**: 新增页面只需在 `pages/` 下创建新目录
- **No Breaking Changes**: 功能和视觉完全保持不变
