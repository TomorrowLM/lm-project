## 1. 目录结构调整

- [x] 1.1 创建 `src/pages/home/` 目录
- [x] 1.2 创建 `src/pages/home/images/` 目录

## 2. 文件移动

- [x] 2.1 移动 `src/index.html` 到 `src/pages/home/index.html`
- [x] 2.2 复制 `src/style.css` 到 `src/pages/home/style.css`
- [x] 2.3 复制 `src/script.js` 到 `src/pages/home/script.js`
- [x] 2.4 移动 `src/images/` 下所有文件到 `src/pages/home/images/`

## 3. 路径更新

- [x] 3.1 更新 `index.html` 中的 CSS 路径：`href="style.css"`
- [x] 3.2 更新 `index.html` 中的 JS 路径：`src="script.js"`
- [x] 3.3 更新 `index.html` 中的 Banner 图片路径：`src="images/banner-X.svg"`
- [x] 3.4 更新 `script.js` 中的 `data-images` 属性路径（如果有）

## 4. 清理旧文件

- [x] 4.1 删除根目录的 `src/index.html`（如果还存在）
- [x] 4.2 删除根目录的 `src/style.css`（保留备份）
- [x] 4.3 删除根目录的 `src/script.js`（保留备份）
- [x] 4.4 删除根目录的 `src/images/` 目录（如果已空）

## 5. 测试验证

- [x] 5.1 启动本地服务器：`cd src && python -m http.server 8080`
- [x] 5.2 访问 `http://localhost:8080/pages/home/`
- [x] 5.3 验证页面样式正常加载
- [x] 5.4 验证 Banner 图片正常显示
- [x] 5.5 验证 Banner 滚轮切换功能正常
- [x] 5.6 验证 API 数据加载功能正常
- [x] 5.7 验证 CTA 按钮样式和交互
- [x] 5.8 验证 Footer 样式正常
- [x] 5.9 验证移动端响应式布局

## 6. 文档更新（可选）

- [x] 6.1 更新 README.md 中的目录结构说明
- [x] 6.2 更新 README.md 中的预览 URL 说明
- [x] 6.3 创建页面模板文档（供未来添加页面参考）
