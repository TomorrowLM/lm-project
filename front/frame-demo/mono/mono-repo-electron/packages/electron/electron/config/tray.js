/**
 * 托盘配置
 */
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  dialog,
} = require("electron");

const path = require("path");
//创建系统托盘
export default function createTray(win) {
  // 创建icon我这里使用的是一个png
  const icon = nativeImage.createFromPath(
    path.join(__dirname, "../asset/icon.png")
  );
  // 实例化一个 托盘对象，传入的是托盘的图标
  // const tray = new Tray(icon);
  const tray = new Tray(path.join(__dirname, "../../dist-render/icon.png"));
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
