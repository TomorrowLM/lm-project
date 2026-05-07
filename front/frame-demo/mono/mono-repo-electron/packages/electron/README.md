# 构建学习博客

https://zhuanlan.zhihu.com/p/521239144

https://github.com/electron-vite/electron-vite-vue

https://www.electron.build/configuration/configuration



# 目录结构

```
├─┬ dist	打包
│ ├─┬ dist-electron  electron主进程打包地址
│ └─┬ dist-render		 electron渲染进程（vue）打包地址
├─┬ electron				 electron主进程
│ ├─┬ main
│ │ └── index.ts     entry of Electron-Main
│ └─┬ preload
│   └── index.ts     entry of Preload-Scripts
├─┬ src
│ └── main.ts        entry of Electron-Renderer
├── index.html
├── electron-builder.json electron打包配置文件
├── package.json
└── vite.config.ts
```

## electron-builder文件说明


    "nsis": {
    "oneClick": false, // 是否一键安装
    "allowElevation": true, // 允许请求提升。 如果为false，则用户必须使用提升的权限重新启动安装程序。
    "allowToChangeInstallationDirectory": true, // 允许修改安装目录
    "installerIcon": "./build/icons/aaa.ico", // 安装图标
    "uninstallerIcon": "./build/icons/bbb.ico", //卸载图标
    "installerHeaderIcon": "./build/icons/aaa.ico", // 安装时头部图标
    "createDesktopShortcut": true, // 创建桌面图标
    "createStartMenuShortcut": true, // 创建开始菜单图标
    "shortcutName": "xxxx", // 图标名称
    "include": "build/script/installer.nsh" // 包含的自定义nsis脚本
    }
  

# 解决

- 打包安装依赖下载过慢

  离线下载：https://blog.csdn.net/qq_32682301/article/details/105234408



启动 yarn run build:dev -> yarn run dev