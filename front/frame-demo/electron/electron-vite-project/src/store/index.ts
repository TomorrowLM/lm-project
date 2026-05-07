import Vue from "vue";
import { createStore } from "vuex";
import Vuex from "vuex";
import getters from "./getters";
import { app } from "@/main";
import common from "./modules/common";
import mainProcess from "./modules/mainProcess";
import router from "./modules/router";

const storeOptions = {
  modules: {
    common,
    mainProcess,
    router,
  },
  state: {},
  mutations: {},
  actions: {},
  getters,
};

export default createStore(storeOptions);
