// 预加载（preload）脚本包含了那些执行于渲染器进程中，且先于网页内容开始加载的代码
// 预加载脚本在渲染器进程加载之前加载，并有权访问两个渲染器全局 (例如 window 和 document) 和 Node.js 环境
// 它拥有与Chrome扩展一样的沙盒。
window.addEventListener("DOMContentLoaded", () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const dependency of ["chrome", "node", "electron"]) {
    // 输出Electron的版本号和它的依赖项到你的web页面上
    replaceText(`${dependency}-version`, process.versions[dependency]);
  }
});
const { ipcRenderer } = require("electron");

//从预加载脚本中暴露哪些 API 给渲染器
window.myAPI = {
  desktop: true,
  doAThing: () => {
    console.log("myAPI");
  },
  setTitle: (title) => ipcRenderer.send("set-title", title), //设置顶部title
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
};
