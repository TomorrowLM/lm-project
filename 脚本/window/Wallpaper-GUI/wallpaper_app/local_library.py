"""Read image files from a user-selected local folder."""

from __future__ import annotations

from datetime import datetime
from hashlib import sha256
from pathlib import Path

from .cache import ImageRecord


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def records_from_folder(folder: Path) -> list[ImageRecord]:
    if not folder.is_dir():
        return []
    records: list[ImageRecord] = []
    for path in sorted(folder.rglob("*"), key=lambda item: str(item).lower()):
        if not path.is_file() or path.suffix.lower() not in IMAGE_SUFFIXES:
            continue
        modified = datetime.fromtimestamp(path.stat().st_mtime).strftime("%Y-%m-%d")
        resolved = path.resolve()
        records.append(ImageRecord(
            source="本地",
            title=path.stem,
            date=modified,
            url=resolved.as_uri(),
            file=str(path),
            content_hash=sha256(str(resolved).encode("utf-8")).hexdigest(),
        ))
    return records
