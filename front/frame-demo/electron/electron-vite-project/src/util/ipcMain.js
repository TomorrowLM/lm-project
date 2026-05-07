import store from "../store/index.ts";
const { ipcRenderer } = require("electron");

ipcRenderer.on("mainMsg", (event, task) => {
  document.getElementById("receive").innerText = task;
});

ipcRenderer.on("createProject", (event, task) => {
  // log(task);
  console.log(task);
  store.commit("setCreateProject", true);
});
