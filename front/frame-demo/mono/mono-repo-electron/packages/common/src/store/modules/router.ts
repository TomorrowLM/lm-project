const router = {
  state: {
    route: [
      {
        path: "/",
        name: "首页",
        title: "首页",
        component: () => import("@packages/common/view/Home/index.vue"),
        meta: {
          roles: ["admin", "editor"],
          title: "首页", // 设置该路由在侧边栏和面包屑中展示的名字
          icon: "svg-name", // 设置该路由的图标，支持 svg-class，也支持 el-icon-x element-ui 的 icon
          noCache: true, // 如果设置为true，则不会被 <keep-alive> 缓存(默认 false)
          breadcrumb: false, //  如果设置为false，则不会在breadcrumb面包屑中显示(默认 true)
          affix: true, // 如果设置为true，它则会固定在tags-view中(默认 false)
          sidebar: true, // 在侧边栏显示
          // 当路由设置了该属性，则会高亮相对应的侧边栏。
          // 这在某些场景非常有用，比如：一个文章的列表页路由为：/article/list
          // 点击文章进入文章详情页，这时候路由为/article/1，但你想在侧边栏高亮文章列表的路由，就可以进行如下设置
          activeMenu: "/article/list",
        },
      },
      {
        path: "/parent",
        name: "parent",
        title: "parent",
        component: () => import("../../view/routerView.vue"),
        // redirect: "/permission/index", //重定向地址，在面包屑中点击会重定向去的地址,当设置 noRedirect 的时候该路由在面包屑导航中不可被点击
        meta: {
          sidebar: true, // 在侧边栏显示
          title: "parent",
        },
        // //你可以在根路由设置权限，这样它下面所有的子路由都继承了这个权限
        children: [
          {
            name: "child",
            path: "child",
            title: "child",
            component: () => import("../../view/Child/index.vue"),
            // redirect: "/permission/index", //重定向地址，在面包屑中点击会重定向去的地址,当设置 noRedirect 的时候该路由在面包屑导航中不可被点击
            meta: {
              sidebar: true, // 在侧边栏显示
              title: "child",
            },
          },
        ],
      },
    ],
  },
  //更改 Vuex 的 store 中的状态的唯一方法是提交 mutation
  mutations: {
    setRoute(state: any, value: object) {
      console.log(88);
      state.route = [...state.route, value];
    },
  },
  //Action 提交的是 mutation，而不是直接变更状态。Action 可以包含任意异步操作。
  actions: {},
};

export default router;
