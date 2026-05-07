/**
 * 注册全局组件
 */
import CustomForm from "./CustomForm/index.vue";

const register = (app: any) => {
  app.component("CustomForm", CustomForm);
};
export default register;
