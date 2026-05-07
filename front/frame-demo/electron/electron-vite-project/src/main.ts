import { createApp } from "vue";
import App from "./App.vue";
import router from "./router/index";
// import './samples/node-api'
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "@/style/index.scss";
// import "./util/ipcMain.js";
import "./util/axios.ts";
import store from "./store";
import register from "./components/register.js";
// 导入mock
import "@/mock/index.ts";

//是否mock数据
// const isMock = process.env.VUE_APP_IS_MOCK == "true";
const app = createApp(App).use(router).use(ElementPlus).use(store);
register(app);
app.mount("#app").$nextTick(() => {
  postMessage({ payload: "removeLoading" }, "*");
});

export { app };
