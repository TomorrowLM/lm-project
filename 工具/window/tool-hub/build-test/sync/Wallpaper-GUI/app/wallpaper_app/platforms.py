"""Operating-system wallpaper adapters."""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
import platform
import subprocess


class WallpaperAdapter(ABC):
    @abstractmethod
    def current_wallpaper(self) -> Path: ...

    @abstractmethod
    def sync_wallpaper(self, path: Path) -> None: ...


class WindowsWallpaperAdapter(WallpaperAdapter):
    def current_wallpaper(self) -> Path:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Control Panel\Desktop") as key:
            value, _ = winreg.QueryValueEx(key, "WallPaper")
        path = Path(value)
        if not path.is_file():
            fallback = Path.home() / "AppData/Roaming/Microsoft/Windows/Themes/TranscodedWallpaper"
            path = fallback
        if not path.is_file():
            raise FileNotFoundError("未找到当前 Windows 壁纸文件。")
        return path

    def sync_wallpaper(self, path: Path) -> None:
        if not path.is_file():
            raise FileNotFoundError(path)
        from pyvda import get_virtual_desktops
        desktops = get_virtual_desktops()
        for desktop in desktops:
            desktop.set_wallpaper(str(path))


class MacWallpaperAdapter(WallpaperAdapter):
    def current_wallpaper(self) -> Path:
        script = 'tell application "System Events" to get POSIX path of picture of desktop 1'
        result = subprocess.run(["osascript", "-e", script], check=True, capture_output=True, text=True)
        return Path(result.stdout.strip())

    def sync_wallpaper(self, path: Path) -> None:
        if not path.is_file():
            raise FileNotFoundError(path)
        escaped = str(path).replace('"', '\\"')
        script = f'tell application "System Events" to set picture of every desktop to POSIX file "{escaped}"'
        subprocess.run(["osascript", "-e", script], check=True, capture_output=True, text=True)


def create_wallpaper_adapter() -> WallpaperAdapter:
    if platform.system() == "Windows":
        return WindowsWallpaperAdapter()
    if platform.system() == "Darwin":
        return MacWallpaperAdapter()
    raise OSError(f"暂不支持 {platform.system()} 系统。")
