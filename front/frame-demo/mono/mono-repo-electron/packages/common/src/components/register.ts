/**
 * 注册全局组件
 */
import CustomForm from "./CustomForm/index.vue";
// const ElementPlusIconsVue = require("@element-plus/icons-vue");
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

export default (app: any) => {
  app.component("CustomForm", CustomForm);
  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component as any);
  }
};
