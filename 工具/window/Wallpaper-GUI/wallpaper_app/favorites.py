"""Persistent favorite wallpaper records."""

from __future__ import annotations

import json
from pathlib import Path


class FavoriteStore:
    def __init__(self, path: Path) -> None:
        self.path = path

    def keys(self) -> set[str]:
        if not self.path.exists():
            return set()
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return set()
        values = data.get("favorites", []) if isinstance(data, dict) else data
        return {str(value) for value in values if str(value)} if isinstance(values, list) else set()

    def contains(self, key: str) -> bool:
        return key in self.keys()

    def add(self, key: str) -> None:
        values = self.keys()
        values.add(key)
        self._save(values)

    def remove(self, key: str) -> None:
        values = self.keys()
        values.discard(key)
        self._save(values)

    def _save(self, values: set[str]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps({"favorites": sorted(values)}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
