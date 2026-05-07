# 组件文档生成工具

这是一个自动化组件文档生成工具，支持Vue和React组件的文档生成。

## 功能特点

- 支持Vue和React组件的自动解析
- 自动提取组件的Props、Events和Slots信息
- 生成美观的Markdown文档
- 支持文档搜索功能
- 支持中文文档

## 安装

```bash
npm install
```

## 使用方法

1. 生成文档：

```bash
npm run generate
```

2. 本地预览文档：

```bash
npm run dev
```

3. 构建文档：

```bash
npm run build
```

## 文档结构

```
docs/
├── .vuepress/        # VuePress配置
├── components/       # 组件文档
└── guide/           # 使用指南
```

## 组件文档规范

### Vue组件

```vue
<template>
  <!-- 组件模板 -->
</template>

<script>
export default {
  name: 'ComponentName',
  props: {
    // 属性定义
  },
  emits: {
    // 事件定义
  }
}
</script>
```

### React组件

```tsx
interface Props {
  // 属性定义
}

const Component: React.FC<Props> = (props) => {
  // 组件实现
}
```

## 注意事项

1. 确保组件代码中包含完整的类型定义
2. 为Props、Events和Slots添加清晰的注释
3. 遵循项目的编码规范

## 贡献指南

1. Fork本仓库
2. 创建特性分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 许可证

MIT 

monarepo：vue2/3依赖冲突
