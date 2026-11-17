from pathlib import Path

from wallpaper_app import platforms


def test_windows_adapter_is_available():
    assert hasattr(platforms, "WindowsWallpaperAdapter")
