# OpenSpec Phone 官网

纯 HTML + CSS + JS 实现的极简手机官网项目，采用页面独立资源组织方案。

## 目录结构

```
src/
└── pages/
    └── home/              ← 首页
        ├── index.html
        ├── style.css
        ├── script.js
        └── images/
            ├── banner-1.svg
            ├── banner-2.svg
            ├── banner-3.svg
            └── banner.svg
```

## 开发预览

启动本地服务器：
```bash
cd src
python -m http.server 8080
```

访问首页：
```
http://localhost:8080/pages/home/
```

## 添加新页面

在 `src/pages/` 下创建新页面目录，复制 `home/` 作为模板：
```
src/pages/
├── home/      ← 首页
├── about/     ← 关于页（示例）
└── product/   ← 产品页（示例）
```

## 技术栈

- 纯 HTML + CSS + JS
- 零依赖、零框架、零构建工具
- BEM 命名规范
- Apple 风格极简设计

## OpenSpec

```bash
# 全局安装 OpenSpec
npm install -g @fission-ai/openspec@latest

# 安装 find-skills
npx skills add https://github.com/vercel-labs/skills --skill find-skills
```