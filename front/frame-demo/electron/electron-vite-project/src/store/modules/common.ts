interface TagNavProps {
  name: string;
  path: string;
}

const common = {
  state: {
    tagNav: [{ name: "主页", path: "/" }],
    currentRouteInfo: {},
    fullScreenStatus: false, //全屏
  },
  //更改 Vuex 的 store 中的状态的唯一方法是提交 mutation
  mutations: {
    setTagNav(state: any, nav: any) {
      if (
        !state.tagNav.some((val: TagNavProps) => val?.name.includes(nav.name))
      ) {
        state.tagNav.push(nav);
      }
    },
    setRouteInfo(state: any) {
      state.currentRouteInfo = JSON.parse(
        window.sessionStorage.getItem("currentRouteInfo") as any
      );
    },
    deleteTag(state: any, tagIndex: any) {
      let currentRoute = {};
      if (tagIndex - 1 >= 0) {
        currentRoute = state.tagNav[tagIndex - 1];
      } else {
        currentRoute = state.tagNav[tagIndex + 1];
      }
      state.tagNav.splice(tagIndex, 1);
      window.sessionStorage.setItem(
        "currentRouteInfo",
        JSON.stringify(currentRoute)
      );
      state.currentRouteInfo = JSON.parse(
        window.sessionStorage.getItem("currentRouteInfo") as any
      );
    },
  },
  //Action 提交的是 mutation，而不是直接变更状态。Action 可以包含任意异步操作。
  actions: {},
};

export default common;
