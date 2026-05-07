declare module "element-plus";
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
// import * as lodash from 'lodash';

// // 全局变量设置
// declare global {
//   const $_: typeof lodash;
// }
declare module 'register';
declare module 'mockjs';
declare module 'vuex';