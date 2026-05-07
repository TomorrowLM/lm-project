/**
 * 菜单配置
 */
const { Menu, BrowserWindow, app, MenuItem } = require("electron");

export default function createMenuBar(win) {
  // 2.创建菜单模板,数组里的每一个对象都是一个菜单
  const template = [
    {
      label: "操作",
      submenu: [
        { label: "打开" },
        {
          label: "最近打开的文件",
          id: "fileList",
          submenu: [],
        },
        {
          label: "创建项目",
          // 添加快捷键
          accelerator: "ctrl+n",
          // 添加点击事件
          click: () => {
            win.webContents.send("createProject", "create");
          },
        },
        {
          label: "创建一个新的窗口",
          // 添加快捷键
          accelerator: "ctrl+n",
          // 添加点击事件
          click: () => {
            // 创建一个新的窗口
            let sonWin = new BrowserWindow({
              width: 200,
              height: 200,
            });
            sonWin.loadFile("./index2.html");
            // 为关闭的时候进行清空
            sonWin.on("close", () => {
              sonWin = null;
            });
          },
        },
        { label: "保存" },
        {
          label: "退出",
          accelerator: "ctrl+w",
          click() {
            // 退出程序
            app.quit();
          },
        },
      ],
    },
    {
      label: "预定义功能",
      submenu: [
        {
          label: "打开开发者工具",
          role: "toggledevtools",
        },
        {
          label: "全屏",
          role: "togglefullscreen",
        },
        {
          label: "重新加载",
          role: "reload",
        },
        {
          label: "退出",
          role: "quit",
        },
      ],
    },
  ];

  // 3.从模板中创建菜单
  const menu = Menu.buildFromTemplate(template);

  // 4.设置为应用程序菜单
  Menu.setApplicationMenu(menu);

  // 动态创建的菜单模板
  const fileItem = new MenuItem({
    label: "file1.txt",
  });
  // 获取 id 为 fileList 的菜单，然后把菜单添加到子菜单中
  menu.getMenuItemById("fileList").submenu.append(fileItem);
}
