import Vue from 'vue';
import ElementUI from 'element-ui';
import Vant from 'vant';
import 'element-ui/lib/theme-chalk/index.css';
import 'vant/lib/index.css';

// 注册 Vue2 组件
Vue.use(ElementUI);
Vue.use(Vant);

// 配置 Vue
Vue.config.productionTip = false;
Vue.config.devtools = true;

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