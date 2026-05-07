import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';

// 创建 Vue3 应用
const app = createApp({});
app.use(ElementPlus);

export const parameters = {
  actions: { argTypesRegex: "^on[A-Z].*" },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
  docs: {
    source: {
      type: 'dynamic',
    },
  },
  locale: 'zh-CN',
  themes: {
    default: 'light',
    list: [
      { name: 'light', class: 'light-theme', color: '#ffffff' },
      { name: 'dark', class: 'dark-theme', color: '#333333' },
    ],
  },
}; 