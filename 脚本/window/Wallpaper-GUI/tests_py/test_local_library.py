from importlib import import_module

from wallpaper_app.cache import CacheIndex


def test_local_folders_are_persisted_and_restore_selected_folder(tmp_path):
    first = tmp_path / "风景"
    second = tmp_path / "收藏"
    first.mkdir()
    second.mkdir()

    cache = CacheIndex(tmp_path / "Cache")
    cache.settings.add_local_folder(first)
    cache.settings.add_local_folder(second)
    cache.settings.set_selected_local_folder(second)

    restored = CacheIndex(tmp_path / "Cache").settings
    assert restored.local_folders() == [first, second]
    assert restored.selected_local_folder() == second


def test_local_library_recursively_returns_supported_image_files(tmp_path):
    root = tmp_path / "图库"
    nested = root / "旅行"
    nested.mkdir(parents=True)
    first = root / "海岸.JPG"
    second = nested / "森林.webp"
    ignored = nested / "说明.txt"
    first.write_bytes(b"jpeg")
    second.write_bytes(b"webp")
    ignored.write_text("ignore", encoding="utf-8")

    records_from_folder = import_module("wallpaper_app.local_library").records_from_folder
    records = records_from_folder(root)

    assert {record.file for record in records} == {str(first), str(second)}
    assert {record.source for record in records} == {"本地"}
