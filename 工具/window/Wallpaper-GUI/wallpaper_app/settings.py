"""Persistent user choices for the wallpaper gallery."""

from __future__ import annotations

import json
from pathlib import Path


class SettingsStore:
    def __init__(self, path: Path) -> None:
        self.path = path

    def _data(self) -> dict:
        if not self.path.exists():
            return {"local_folders": [], "selected_local_folder": ""}
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {"local_folders": [], "selected_local_folder": ""}
        return data if isinstance(data, dict) else {"local_folders": [], "selected_local_folder": ""}

    def _save(self, data: dict) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def local_folders(self) -> list[Path]:
        return [Path(item) for item in self._data().get("local_folders", []) if Path(item).is_dir()]

    def selected_local_folder(self) -> Path | None:
        selected = self._data().get("selected_local_folder", "")
        path = Path(selected) if selected else None
        return path if path and path.is_dir() else None

    def add_local_folder(self, folder: Path) -> None:
        folder = folder.resolve()
        if not folder.is_dir():
            raise ValueError(f"文件夹不存在：{folder}")
        data = self._data()
        folders = [Path(item) for item in data.get("local_folders", [])]
        if folder not in folders:
            folders.append(folder)
        data["local_folders"] = [str(item) for item in folders]
        data["selected_local_folder"] = str(folder)
        self._save(data)

    def set_selected_local_folder(self, folder: Path) -> None:
        folder = folder.resolve()
        if folder not in self.local_folders():
            raise ValueError(f"文件夹未保存：{folder}")
        data = self._data()
        data["selected_local_folder"] = str(folder)
        self._save(data)
