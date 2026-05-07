//在渲染进程中，就是main.html 里面加载的 index.js 中，既可以使用 docment.getElementById 这些 WebAPI,又能使用用 node 的模块进行混写
const btn1 = this.document.querySelector("#btn1");
const btn2 = this.document.querySelector("#btn2");
const btn3 = this.document.querySelector("#btn3");
const filePathElement = document.getElementById('filePath')
const { BrowserWindow } = require("@electron/remote");
const electron = require("electron");
const { ipcRenderer } = require("electron");
const { log } = console;
window.onload = () => {
  btn1.onclick = () => {
    newWin = new BrowserWindow({
      width: 500,
      height: 500,
    });

    newWin.loadFile("./src/view/child.html");
    newWin.on("closed", () => {
      newWin = null;
    });
  };
  btn2.onclick = () => {
    const setButton = document.getElementById("btn2");
    const titleInput = document.getElementById("title");
    setButton.addEventListener("click", () => {
      const title = titleInput.value;
      window.myAPI.setTitle(title);
    });
  };
  btn3.onclick = async() => {
    const filePath = await window.myAPI.openFile()
    filePathElement.innerText = filePath
  };
  const emitMain = () => {
    //引入ipcRenderer
    log(ipcRenderer, 123);
    ipcRenderer.on("mainMsg", (event, task) => {
      log(task);
      document.getElementById("receive").innerText = task;
    });
  };
  emitMain();
};
