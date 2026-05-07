import * as VueRouter from "vue-router";
import store from "../store/index";
import { computed, watch, ref } from "vue";

const routes = computed(() => {
  console.log((store.state as any).router.route, 999);
  return (store.state as any).router.route;
});

const router = VueRouter.createRouter({
  // 内部提供了 history 模式的实现。为了简单起见，我们在这里使用 hash 模式。
  history: VueRouter.createWebHashHistory(),
  routes: (store.state as any).router.route, // `routes: routes` 的缩写
});

watch(
  routes,
  (newValue, oldValue) => {
    console.log(newValue, newValue[newValue.length - 1]);
    router.addRoute({
      // ...newValue,
      name: newValue[newValue.length - 1].name,
      path: newValue[newValue.length - 1].path,
      // title: newValue[newValue.length - 1].title,
      component: () => import("../view/routerView.vue"),
      meta: {
        ...newValue[newValue.length - 1].meta,
      },
      children: newValue[newValue.length - 1].children,
    });
  },
  { immediate: false }
);
// 2. 定义一些路由
// 每个路由都需要映射到一个组件。
// 创建路由实例并传递 `routes` 配置
export default router;
