import { createApp } from "vue";
import App from "./App.vue";
import router from "@packages/common/router/index.ts";
import "@packages/common/style/index.scss";
import "@packages/common/util/axios.ts";
import store from "@packages/common/store/index.ts";
import register from "@packages/common/components/register.ts";
import "@packages/common/mock/index.ts";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";

// 导入mock
// import "@packages/common"

//是否mock数据
// const isMock = process.env.VUE_APP_IS_MOCK == "true";
const app = createApp(App)
  .use(router as any)
  .use(ElementPlus as any)
  .use(store);
console.log(register);
register(app);
app.mount("#app").$nextTick(() => {
  postMessage({ payload: "removeLoading" }, "*");
});

export { app };
