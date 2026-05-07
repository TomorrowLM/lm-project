const mainProcess = {
  state: {
    createProject: false,
  },
  //更改 Vuex 的 store 中的状态的唯一方法是提交 mutation
  mutations: {
    setCreateProject(state: any, value: boolean) {
      console.log(88);
      state.createProject = value;
      console.log(state.createProject);
    },
  },
  //Action 提交的是 mutation，而不是直接变更状态。Action 可以包含任意异步操作。
  actions: {},
};

export default mainProcess;
