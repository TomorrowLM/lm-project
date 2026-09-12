import threading

from wallpaper_app import ui
from wallpaper_app.cache import ImageRecord


def test_ui_exposes_main_window():
    assert hasattr(ui, "MainWindow")


def test_main_window_exposes_wallpaper_actions(qtbot, tmp_path):
    window = ui.MainWindow(cache_root=tmp_path)
    qtbot.addWidget(window)
    assert window.sync_button.text() == "同步当前桌面壁纸"
    assert window.refresh_button.text() == "获取更多 Bing 图片"
    assert window.bing_source_button.isChecked()


def test_background_image_signal_adds_card_immediately(qtbot, tmp_path):
    window = ui.MainWindow(cache_root=tmp_path)
    qtbot.addWidget(window)
    image_path = tmp_path / "Bing" / "20260909" / "one.jpg"
    image_path.parent.mkdir(parents=True)
    image_path.write_bytes(b"not-a-real-image")
    record = window.cache.add(ImageRecord("Bing", "第一张", "20260909", "https://example.com/one.jpg", file=str(image_path)))
    signals = ui.DownloadSignals()
    signals.image_ready.connect(window._image_ready)

    worker = threading.Thread(target=lambda: signals.image_ready.emit(record))
    worker.start()
    qtbot.waitUntil(lambda: window.grid.count() == 1)
    worker.join(timeout=1)

    assert "第一张" in window.status.text()


def test_online_source_switch_filters_gallery_and_changes_refresh_label(qtbot, tmp_path):
    bing_file = tmp_path / "Bing" / "20260909" / "bing.jpg"
    spotlight_file = tmp_path / "Spotlight" / "spotlight.jpg"
    bing_file.parent.mkdir(parents=True)
    spotlight_file.parent.mkdir(parents=True)
    bing_file.write_bytes(b"bing")
    spotlight_file.write_bytes(b"spotlight")
    cache = ui.CacheIndex(tmp_path)
    cache.add(ImageRecord("Bing", "Bing 图片", "20260909", "https://example.com/bing", file=str(bing_file)))
    cache.add(ImageRecord("Windows 聚焦", "聚焦图片", "", "https://example.com/spotlight", file=str(spotlight_file), content_hash="spot"))

    window = ui.MainWindow(cache_root=tmp_path)
    qtbot.addWidget(window)
    window.set_online_source("Bing")
    assert window.grid.count() == 1
    assert window.refresh_button.text() == "获取更多 Bing 图片"

    window.set_online_source("Windows 聚焦")
    assert window.grid.count() == 1
    assert window.refresh_button.text() == "获取更多 Windows 聚焦图片"


def test_fetch_current_source_only_calls_selected_provider(qtbot, tmp_path, monkeypatch):
    window = ui.MainWindow(cache_root=tmp_path)
    qtbot.addWidget(window)
    calls = []
    monkeypatch.setattr(ui, "fetch_bing", lambda *args, **kwargs: calls.append("Bing") or [])
    monkeypatch.setattr(ui, "fetch_spotlight", lambda *args, **kwargs: calls.append("Windows 聚焦") or [])

    window.set_online_source("Windows 聚焦")
    assert window.fetch_current_source(None) == []
    assert calls == ["Windows 聚焦"]


def test_clear_cache_keeps_saved_local_folders(qtbot, tmp_path):
    folder = tmp_path / "本地图库"
    folder.mkdir()
    window = ui.MainWindow(cache_root=tmp_path / "Cache")
    qtbot.addWidget(window)
    window.cache.settings.add_local_folder(folder)

    window.clear_cache()

    assert window.cache.settings.local_folders() == [folder]


def test_local_mode_shows_images_from_selected_folder(qtbot, tmp_path):
    folder = tmp_path / "本地图库"
    nested = folder / "子目录"
    nested.mkdir(parents=True)
    image_file = nested / "森林.png"
    image_file.write_bytes(b"image")
    cache = ui.CacheIndex(tmp_path / "Cache")
    cache.settings.add_local_folder(folder)

    window = ui.MainWindow(cache_root=tmp_path / "Cache")
    qtbot.addWidget(window)
    window.set_mode("本地")

    assert window.grid.count() == 1
    assert window.folder_selector.currentData() == str(folder.resolve())
    assert window.refresh_button.isHidden()


def test_preview_dialog_contains_selected_image_details(qtbot, tmp_path):
    image_file = tmp_path / "湖泊.jpg"
    image_file.write_bytes(b"image")
    window = ui.MainWindow(cache_root=tmp_path / "Cache")
    qtbot.addWidget(window)
    record = ImageRecord("本地", "湖泊", "2026-09-09", image_file.as_uri(), file=str(image_file), content_hash="lake")

    dialog = window.create_preview_dialog(record)
    qtbot.addWidget(dialog)

    assert dialog.windowTitle() == "预览：湖泊"
    assert dialog.apply_button.text() == "应用壁纸"


def test_choosing_local_folder_persists_and_loads_its_images(qtbot, tmp_path, monkeypatch):
    folder = tmp_path / "新图库"
    folder.mkdir()
    (folder / "沙漠.jpg").write_bytes(b"image")
    window = ui.MainWindow(cache_root=tmp_path / "Cache")
    qtbot.addWidget(window)
    monkeypatch.setattr(ui.QFileDialog, "getExistingDirectory", lambda *args: str(folder))

    window.choose_local_folder()

    assert window.cache.settings.selected_local_folder() == folder.resolve()
    assert window.folder_selector.currentData() == str(folder.resolve())
    assert window.grid.count() == 1


def test_image_card_elides_a_long_filename_and_keeps_full_tooltip(qtbot, tmp_path):
    image_file = tmp_path / "image.jpg"
    image_file.write_bytes(b"image")
    full_name = "2256728678588573196_12800000004955269_assets_landscapeimage_asset_1716549316238_3840x2160"
    record = ImageRecord("本地", full_name, "2026-09-09", image_file.as_uri(), file=str(image_file), content_hash="long-name")

    card = ui.ImageCard(record, lambda _: None, lambda _: None)
    qtbot.addWidget(card)

    assert card.title_label.text().endswith("…")
    assert card.title_label.toolTip() == full_name
    assert not card.title_label.wordWrap()
    assert card.maximumWidth() == 324
