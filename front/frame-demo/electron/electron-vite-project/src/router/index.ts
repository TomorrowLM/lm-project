import * as VueRouter from "vue-router";
import store from "../store/index";
import { computed, watch, ref } from "vue";
// export let routes: any = [
//   {
//     path: "/home",
//     component: () => import("@/view/Home/index.vue"),
//     meta: {
//       roles: ["admin", "editor"],
//       title: "首页", // 设置该路由在侧边栏和面包屑中展示的名字
//       icon: "svg-name", // 设置该路由的图标，支持 svg-class，也支持 el-icon-x element-ui 的 icon
//       noCache: true, // 如果设置为true，则不会被 <keep-alive> 缓存(默认 false)
//       breadcrumb: false, //  如果设置为false，则不会在breadcrumb面包屑中显示(默认 true)
//       affix: true, // 如果设置为true，它则会固定在tags-view中(默认 false)
//       sidebar: true, // 在侧边栏显示
//       // 当路由设置了该属性，则会高亮相对应的侧边栏。
//       // 这在某些场景非常有用，比如：一个文章的列表页路由为：/article/list
//       // 点击文章进入文章详情页，这时候路由为/article/1，但你想在侧边栏高亮文章列表的路由，就可以进行如下设置
//       activeMenu: "/article/list",
//     },
//   },
//   {
//     path: "/parent",
//     component: () => import("@/view/routerView.vue"),
//     // redirect: "/permission/index", //重定向地址，在面包屑中点击会重定向去的地址,当设置 noRedirect 的时候该路由在面包屑导航中不可被点击
//     meta: {
//       sidebar: true, // 在侧边栏显示
//       title: "parent",
//     },
//     // //你可以在根路由设置权限，这样它下面所有的子路由都继承了这个权限
//     children: [
//       {
//         path: "child",
//         component: () => import("@/view/Child/index.vue"),
//         // redirect: "/permission/index", //重定向地址，在面包屑中点击会重定向去的地址,当设置 noRedirect 的时候该路由在面包屑导航中不可被点击
//         meta: {
//           sidebar: true, // 在侧边栏显示
//           title: "child",
//         },
//       },
//     ],
//   },
// ];
// console.log(store.state);
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
      component: () => import("@/view/test/index.vue"),
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
