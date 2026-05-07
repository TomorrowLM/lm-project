const path = require('path');

module.exports = {
  stories: [
    "../stories/**/*.stories.mdx",
    "../stories/**/*.stories.@(js|jsx|ts|tsx|vue)"
  ],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-interactions"
  ],
  framework: "@storybook/vue3",
  core: {
    builder: "@storybook/builder-webpack5"
  },
  webpackFinal: async (config) => {
    // 添加对 SCSS 的支持
    config.module.rules.push({
      test: /\.scss$/,
      use: ['style-loader', 'css-loader', 'sass-loader'],
      include: path.resolve(__dirname, '../'),
    });

    // 添加对 Element Plus 样式的支持
    config.module.rules.push({
      test: /\.css$/,
      use: ['style-loader', 'css-loader'],
      include: [
        path.resolve(__dirname, '../'),
        path.resolve(__dirname, '../node_modules/element-plus')
      ],
    });

    // 添加对 Vue 单文件组件的支持
    config.module.rules.push({
      test: /\.vue$/,
      use: [
        {
          loader: 'vue-loader',
          options: {
            compilerOptions: {
              isCustomElement: tag => tag.startsWith('el-')
            }
          }
        }
      ]
    });

    // 添加对图片等资源的支持
    config.module.rules.push({
      test: /\.(png|jpe?g|gif|svg|webp)$/i,
      type: 'asset/resource'
    });

    // 配置别名
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, '../src'),
      'vue': '@vue/runtime-dom'
    };

    return config;
  },
  features: {
    interactionsDebugger: true
  }
}; 