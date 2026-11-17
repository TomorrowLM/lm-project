# Wallpaper-GUI

基于 Python + PySide6 的壁纸画廊工具，支持 Bing 每日壁纸、Windows 聚焦、本地图库和虚拟桌面同步。

## 操作说明

- “应用壁纸”：只设置当前壁纸，不会复制文件。
- 卡片上的爱心按钮：收藏壁纸并复制到 `Pictures\Online Wallpapers`。
- 再次点击爱心：取消收藏标记，但不会删除已经保存的图片。
- 重启后会根据收藏记录恢复爱心状态。
- “同步当前桌面壁纸”：读取当前系统壁纸并同步到虚拟桌面。
- “清理缓存”：只清理线上下载缓存，不删除收藏图片或本地图库设置。

## 用户数据

源码目录直接运行时，缓存位于：

```text
Wallpaper-GUI\Cache\
├─ Bing\
├─ Spotlight\
├─ images.jsonl
└─ settings.json
```

部署到 `.lm-exe` 后，缓存和收藏配置位于：

```text
C:\Users\<当前用户>\.lm-exe\wallpaper-gui\
├─ cache\
│  ├─ Bing\
│  ├─ Spotlight\
│  ├─ images.jsonl
│  └─ settings.json
└─ config\
   └─ favorites.json
```

收藏后的图片副本位于：

```text
C:\Users\<当前用户>\Pictures\Online Wallpapers\
```

收藏记录只保存图片的稳定标识，不依赖缓存文件的绝对路径，因此迁移运行目录后仍能恢复收藏状态。
