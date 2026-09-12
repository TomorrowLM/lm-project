"""Persistent image-cache primitives."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path

from .settings import SettingsStore


@dataclass(frozen=True)
class ImageRecord:
    source: str
    title: str
    date: str
    url: str
    file: str = ""
    content_hash: str = ""
    cached_at: str = ""

    @property
    def key(self) -> str:
        return f"Bing|{self.date}" if self.source == "Bing" else f"{self.source}|{self.content_hash or sha256(self.url.encode()).hexdigest()}"


def _safe_name(value: str) -> str:
    safe = "".join(char if char.isalnum() or char in "-_." else "_" for char in value).strip("_")
    return safe or "wallpaper"


def cache_file_path(cache_root: Path, image: ImageRecord) -> Path:
    if image.source == "Bing":
        return cache_root / "Bing" / image.date / f"{_safe_name(image.title)}.jpg"
    digest = _safe_name(image.content_hash or sha256(image.url.encode()).hexdigest())
    return cache_root / "Spotlight" / f"{digest}.jpg"


class CacheIndex:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.index_path = root / "images.jsonl"
        self.settings = SettingsStore(root / "settings.json")

    def records(self, limit: int | None = None) -> list[ImageRecord]:
        if not self.index_path.exists():
            return []
        seen: set[str] = set()
        result: list[ImageRecord] = []
        for line in self.index_path.read_text(encoding="utf-8").splitlines():
            try:
                record = ImageRecord(**json.loads(line))
            except (TypeError, json.JSONDecodeError):
                continue
            if record.key in seen or not Path(record.file).is_file():
                continue
            seen.add(record.key)
            result.append(record)
        result.sort(key=lambda item: item.cached_at, reverse=True)
        return result[:limit] if limit else result

    def contains(self, image: ImageRecord) -> bool:
        return any(record.key == image.key for record in self.records())

    def add(self, image: ImageRecord) -> ImageRecord:
        self.root.mkdir(parents=True, exist_ok=True)
        record = ImageRecord(**{**asdict(image), "cached_at": image.cached_at or datetime.now(timezone.utc).isoformat()})
        with self.index_path.open("a", encoding="utf-8") as file:
            file.write(json.dumps(asdict(record), ensure_ascii=False) + "\n")
        return record
