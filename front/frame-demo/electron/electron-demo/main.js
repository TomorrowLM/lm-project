// 引入托盘 Tray,和 Menu 等下要创建菜单,nativeImage创建 icon图标
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  dialog
} = require("electron");
// 需在当前文件内开头引入 Node.js 的 'path' 模块
const path = require("path");
// 2.引入自定义的菜单
require("./config/menu");

//创建系统托盘
function createTray(win) {
  // 创建icon我这里使用的是一个png
  const icon = nativeImage.createFromPath(
    path.join(__dirname, "./asset/img/_MG_7766.png")
  );
  // 实例化一个 托盘对象，传入的是托盘的图标
  tray = new Tray(icon);
  // 移动到托盘上的提示
  tray.setToolTip("electron demo is running");
  // 还可以设置 titlle
  tray.setTitle("electron demo");

  // 监听托盘右键事件
  tray.on("right-click", () => {
    // 右键菜单模板
    const tempate = [
      {
        label: "无操作",
      },
      {
        label: "退出",
        click: () => app.quit(),
      },
    ];
    //通过 Menu 创建菜单
    const menuConfig = Menu.buildFromTemplate(tempate);
    // 让我们的写的托盘右键的菜单替代原来的
    tray.popUpContextMenu(menuConfig);
  });
  //监听点击托盘的事件
  tray.on("click", () => {
    // 这里来控制窗口的显示和隐藏
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
    }
  });
}

const createWindow = () => {
  // 创建浏览窗口
  const mainWindow = new BrowserWindow({
    //fullscreen: true   //全屏
    //frame: false,   	//让桌面应用没有边框，这样菜单栏也会消失
    resizable: true, //不允许用户改变窗口大小
    width: 800, //设置窗口宽高
    height: 600,
    icon: path.join(__dirname, "./asset/img/_MG_7766.png"), //应用运行时的标题栏图标
    // minWidth: 300, // 最小宽度
    // minHeight: 500, // 最小高度
    // maxWidth: 300, // 最大宽度
    // maxHeight: 600, // 最大高度
    // 进行对首选项的设置
    webPreferences: {
      backgroundThrottling: false, //设置应用在后台正常运行
      nodeIntegration: true, //设置能在页面使用nodejs的API
      contextIsolation: false, //关闭警告信息
      enableRemoteModule: true, // 使用remote模块

      // 渲染器和node无法直接访问,通过预加载脚本从渲染器访问Node.js
      preload: path.join(__dirname, "preload.js"),
    },
  });
  // 加载 index.html
  mainWindow.loadFile("./asset/index.html");
  // mainWindow.loadURL("https://baidu.com");
  //创建系统托盘
  createTray(mainWindow);
  // 使用remote模块
  require("@electron/remote/main").initialize();
  require("@electron/remote/main").enable(mainWindow.webContents);
  require("@electron/remote/main").enable(mainWindow.webContents);
  // 打开开发工具
  mainWindow.webContents.openDevTools();
  return mainWindow;
};
function handleSetTitle(event, title) {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);
  win.setTitle(title);
}
//返回用户选择的文件路径值
async function handleFileOpen() {
  const { canceled, filePaths } = await dialog.showOpenDialog()
  if (canceled) {
    return
  } else {
    return filePaths[0]
  }
}
const emitRender = () => {
  ipcMain.on("set-title", handleSetTitle);
};
const emitMain = (win) => {
  // 发送给渲染线程
  setTimeout(() => {
    win.webContents.send("mainMsg", "我是主线程发送的消息");
  }, 3000);
};
const emit = ()=>{
  // dialog: 前缀对代码没有影响。 它仅用作命名空间以帮助提高代码的可读性。
  ipcMain.handle('dialog:openFile', handleFileOpen)
}
//如果没有窗口打开则打开一个窗口 (macOS)
//当 Linux 和 Windows 应用在没有窗口打开时退出了，macOS 应用通常即使在没有打开任何窗口的情况下也继续运行，并且在没有窗口可用的情况下激活应用时会打开新的窗口。
app.whenReady().then(() => {
  new Promise((resolve, reject) => {
    resolve(createWindow());
  }).then((res) => {
    //使用 ipcMain.on API 在 set-title 通道上设置一个 IPC 监听器
    emitRender();
    emitMain(res);
    emit()
  });

  app.on("activate", () => {
    // 在macOS上，当单击dock图标并且没有其他窗口打开时，
    // 通常在应用程序中重新创建一个窗口。
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

//关闭所有窗口时退出应用 (Windows & Linux)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
