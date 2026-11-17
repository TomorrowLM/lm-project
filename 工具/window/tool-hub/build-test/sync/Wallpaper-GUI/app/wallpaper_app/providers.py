"""Online wallpaper providers."""

from __future__ import annotations

from hashlib import sha256
import json
from pathlib import Path
from typing import Callable
from urllib.request import Request, urlopen

from .cache import CacheIndex, ImageRecord, cache_file_path


def _json(url: str) -> dict:
    with urlopen(Request(url, headers={"User-Agent": "WallpaperGallery/1.0"}), timeout=30) as response:
        return json.loads(response.read())


def _download(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with urlopen(Request(url, headers={"User-Agent": "WallpaperGallery/1.0"}), timeout=30) as response:
        destination.write_bytes(response.read())


def fetch_bing(cache: CacheIndex, offset: int = 0, count: int = 5, on_image: Callable[[ImageRecord], None] | None = None) -> list[ImageRecord]:
    feed = _json(f"https://www.bing.com/HPImageArchive.aspx?format=js&idx={offset}&n={count}&mkt=zh-CN")
    added: list[ImageRecord] = []
    for item in feed.get("images", []):
        image = ImageRecord("Bing", item["title"], item["startdate"], "https://www.bing.com" + item["urlbase"] + "_1920x1080.jpg")
        if cache.contains(image):
            continue
        location = cache_file_path(cache.root, image)
        _download(image.url, location)
        record = cache.add(ImageRecord(**{**image.__dict__, "file": str(location)}))
        added.append(record)
        if on_image: on_image(record)
    return added


def fetch_spotlight(cache: CacheIndex, count: int = 5, on_image: Callable[[ImageRecord], None] | None = None) -> list[ImageRecord]:
    endpoint = "https://arc.msn.com/v3/Delivery/Placement?pid=209567&fmt=json&rafb=0&ua=WindowsShellClient%2F0&cdm=1&disphorzres=9999&dispvertres=9999&lo=80217&pl=zh-CN&lc=zh-CN&ctry=cn"
    added: list[ImageRecord] = []
    for _ in range(count * 5):
        if len(added) >= count:
            break
        data = _json(endpoint)
        item = json.loads(data["batchrsp"]["items"][0]["item"])
        raw = item["ad"]["image_fullscreen_001_landscape"]
        title = item["ad"].get("title_text", "Windows 聚焦")
        if isinstance(title, dict):
            title = title.get("tx", "Windows 聚焦")
        image = ImageRecord("Windows 聚焦", title, "", raw["u"], content_hash=raw.get("sha256", sha256(raw["u"].encode()).hexdigest()))
        if cache.contains(image):
            continue
        location = cache_file_path(cache.root, image)
        _download(image.url, location)
        record = cache.add(ImageRecord(**{**image.__dict__, "file": str(location)}))
        added.append(record)
        if on_image: on_image(record)
    return added
