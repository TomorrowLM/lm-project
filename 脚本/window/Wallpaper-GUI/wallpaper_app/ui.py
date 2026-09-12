"""PySide6 application window."""

from __future__ import annotations

from pathlib import Path
import shutil
import threading

from PySide6.QtCore import QObject, Qt, Signal
from PySide6.QtGui import QPixmap
from PySide6.QtWidgets import QComboBox, QDialog, QFrame, QGridLayout, QHBoxLayout, QLabel, QMainWindow, QFileDialog, QPushButton, QScrollArea, QVBoxLayout, QWidget

from .cache import CacheIndex, ImageRecord
from .local_library import records_from_folder
from .platforms import create_wallpaper_adapter
from .providers import fetch_bing, fetch_spotlight


THEME = """
QMainWindow { background: #10151d; color: #ecf3fb; }
QLabel#eyebrow { color: #79b8ff; font-size: 11px; font-weight: 700; letter-spacing: 1px; }
QLabel#title { font-size: 28px; font-weight: 700; color: #f8fbff; }
QLabel#status { color: #9babbd; padding: 10px 0; }
QPushButton { background: #1d2938; color: #dcecff; border: 1px solid #32445a; border-radius: 9px; padding: 9px 14px; font-weight: 600; }
QPushButton:hover { background: #26384d; border-color: #5d9ad3; }
QPushButton#primary { background: #2679c8; border-color: #4398e7; color: white; }
QPushButton:checked { background: #215f94; border-color: #55a9ee; color: white; }
QFrame#card { background: #18212d; border: 1px solid #28384b; border-radius: 14px; }
QScrollArea { border: none; }
"""


class DownloadSignals(QObject):
    image_ready = Signal(object)
    completed = Signal(list)
    failed = Signal(str)


class ImagePreviewDialog(QDialog):
    def __init__(self, image: ImageRecord, apply_callback, parent: QWidget) -> None:
        super().__init__(parent)
        self.image = image
        self.setWindowTitle(f"预览：{image.title}")
        self.setMinimumSize(720, 560)
        layout = QVBoxLayout(self)
        preview = QLabel()
        preview.setMinimumSize(680, 430)
        preview.setAlignment(Qt.AlignmentFlag.AlignCenter)
        pixmap = QPixmap(image.file)
        if pixmap.isNull():
            preview.setText("此图片无法预览")
        else:
            preview.setPixmap(pixmap.scaled(920, 650, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation))
        layout.addWidget(preview, 1)
        metadata = QLabel(f"{image.source} · {image.date or '本地文件'}")
        metadata.setStyleSheet("color:#9babbd")
        layout.addWidget(metadata)
        actions = QHBoxLayout()
        actions.addStretch()
        self.apply_button = QPushButton("应用壁纸")
        self.apply_button.setObjectName("primary")
        self.apply_button.clicked.connect(lambda: apply_callback(image))
        close_button = QPushButton("关闭")
        close_button.clicked.connect(self.accept)
        actions.addWidget(self.apply_button)
        actions.addWidget(close_button)
        layout.addLayout(actions)


class ElidedLabel(QLabel):
    def __init__(self, text: str, width: int = 300) -> None:
        super().__init__()
        self.setFixedWidth(width)
        self.setWordWrap(False)
        self.setToolTip(text)
        self.setText(self.fontMetrics().elidedText(text, Qt.TextElideMode.ElideRight, width))


class ImageCard(QFrame):
    def __init__(self, image: ImageRecord, apply_callback, preview_callback) -> None:
        super().__init__()
        self.setObjectName("card")
        self.setMaximumWidth(324)
        self.image = image
        layout = QVBoxLayout(self)
        preview = QLabel()
        preview.setFixedSize(300, 168)
        preview.setAlignment(Qt.AlignmentFlag.AlignCenter)
        pixmap = QPixmap(image.file)
        if pixmap.isNull():
            preview.setText("预览不可用")
        else:
            preview.setPixmap(pixmap.scaled(preview.size(), Qt.AspectRatioMode.KeepAspectRatioByExpanding, Qt.TransformationMode.SmoothTransformation))
        preview.setCursor(Qt.CursorShape.PointingHandCursor)
        preview.mousePressEvent = lambda _: preview_callback(image)
        layout.addWidget(preview)
        self.title_label = ElidedLabel(image.title)
        layout.addWidget(self.title_label)
        meta = QLabel(f"{image.source} · {image.date or '已缓存'}")
        meta.setStyleSheet("color:#8fa1b4;font-size:11px")
        layout.addWidget(meta)
        button = QPushButton("应用壁纸")
        button.clicked.connect(lambda: apply_callback(image))
        layout.addWidget(button)
        preview_button = QPushButton("放大预览")
        preview_button.clicked.connect(lambda: preview_callback(image))
        layout.addWidget(preview_button)


class MainWindow(QMainWindow):
    def __init__(self, cache_root: Path | None = None) -> None:
        super().__init__()
        self.cache = CacheIndex(cache_root or Path(__file__).resolve().parents[1] / "Cache")
        self.bing_offset = 0
        self.mode = "线上"
        self.online_source = "Bing"
        self.setWindowTitle("在线壁纸 · 画廊")
        self.resize(1120, 760)
        self.setStyleSheet(THEME)
        self._build()
        self.load_cached()

    def _build(self) -> None:
        root = QWidget(); self.setCentralWidget(root)
        layout = QVBoxLayout(root); layout.setContentsMargins(28, 24, 28, 20); layout.setSpacing(10)
        eyebrow = QLabel("CURATED WALLPAPER COLLECTION"); eyebrow.setObjectName("eyebrow"); layout.addWidget(eyebrow)
        title = QLabel("在线壁纸画廊"); title.setObjectName("title"); layout.addWidget(title)
        actions = QHBoxLayout()
        self.online_mode_button = QPushButton("线上图库")
        self.online_mode_button.setCheckable(True)
        self.online_mode_button.clicked.connect(lambda: self.set_mode("线上"))
        self.local_mode_button = QPushButton("本地图库")
        self.local_mode_button.setCheckable(True)
        self.local_mode_button.clicked.connect(lambda: self.set_mode("本地"))
        self.bing_source_button = QPushButton("Bing 每日壁纸")
        self.bing_source_button.setCheckable(True)
        self.bing_source_button.clicked.connect(lambda: self.set_online_source("Bing"))
        self.spotlight_source_button = QPushButton("Windows 聚焦")
        self.spotlight_source_button.setCheckable(True)
        self.spotlight_source_button.clicked.connect(lambda: self.set_online_source("Windows 聚焦"))
        self.folder_selector = QComboBox()
        self.folder_selector.setMinimumWidth(220)
        self.folder_selector.currentIndexChanged.connect(self.select_local_folder)
        self.choose_folder_button = QPushButton("选择文件夹")
        self.choose_folder_button.clicked.connect(self.choose_local_folder)
        self.refresh_button = QPushButton(self._refresh_label()); self.refresh_button.setObjectName("primary")
        self.refresh_button.clicked.connect(self.fetch_more)
        actions.addWidget(self.online_mode_button); actions.addWidget(self.local_mode_button)
        actions.addWidget(self.bing_source_button); actions.addWidget(self.spotlight_source_button)
        actions.addWidget(self.folder_selector); actions.addWidget(self.choose_folder_button)
        actions.addStretch(); actions.addWidget(self.refresh_button)
        layout.addLayout(actions)
        utilities = QHBoxLayout()
        self.sync_button = QPushButton("同步当前桌面壁纸")
        self.sync_button.clicked.connect(self.sync_current)
        self.clear_button = QPushButton("清理缓存")
        self.clear_button.clicked.connect(self.clear_cache)
        utilities.addWidget(self.sync_button); utilities.addWidget(self.clear_button); utilities.addStretch()
        layout.addLayout(utilities)
        self.scroll = QScrollArea(); self.scroll.setWidgetResizable(True)
        self.gallery = QWidget(); self.grid = QGridLayout(self.gallery); self.grid.setSpacing(14); self.grid.setAlignment(Qt.AlignmentFlag.AlignTop)
        self.scroll.setWidget(self.gallery); layout.addWidget(self.scroll, 1)
        self.status = QLabel("准备就绪"); self.status.setObjectName("status"); layout.addWidget(self.status)
        self._sync_folder_selector()
        self._update_mode_controls()

    def load_cached(self) -> None:
        self.bing_offset = sum(item.source == "Bing" for item in self.cache.records())
        records = self.visible_records()
        self.render(records)
        self.status.setText(f"已加载 {len(records)} 张 {self.online_source} 缓存图片" if records else f"{self.online_source} 缓存为空，点击“获取更多”开始下载")

    def visible_records(self) -> list[ImageRecord]:
        if self.mode == "本地":
            folder = self.cache.settings.selected_local_folder()
            return records_from_folder(folder)[:30] if folder else []
        return [record for record in self.cache.records() if record.source == self.online_source][:30]

    def _sync_folder_selector(self) -> None:
        selected = self.cache.settings.selected_local_folder()
        self.folder_selector.blockSignals(True)
        self.folder_selector.clear()
        folders = self.cache.settings.local_folders()
        if not folders:
            self.folder_selector.addItem("尚未选择文件夹", "")
        for folder in folders:
            self.folder_selector.addItem(folder.name or str(folder), str(folder))
        if selected:
            index = self.folder_selector.findData(str(selected))
            self.folder_selector.setCurrentIndex(index if index >= 0 else 0)
        self.folder_selector.blockSignals(False)

    def _update_mode_controls(self) -> None:
        online = self.mode == "线上"
        self.online_mode_button.setChecked(online)
        self.local_mode_button.setChecked(not online)
        self.bing_source_button.setChecked(self.online_source == "Bing")
        self.spotlight_source_button.setChecked(self.online_source == "Windows 聚焦")
        self.bing_source_button.setVisible(online)
        self.spotlight_source_button.setVisible(online)
        self.folder_selector.setVisible(not online)
        self.choose_folder_button.setVisible(not online)
        self.refresh_button.setVisible(online)

    def set_mode(self, mode: str) -> None:
        if mode not in {"线上", "本地"}:
            raise ValueError(f"不支持的图库模式：{mode}")
        self.mode = mode
        self._sync_folder_selector()
        self._update_mode_controls()
        records = self.visible_records()
        self.render(records)
        if mode == "本地" and not self.cache.settings.selected_local_folder():
            self.status.setText("尚未选择本地文件夹")
        else:
            self.status.setText(f"当前展示 {len(records)} 张{'本地' if mode == '本地' else self.online_source}图片")

    def select_local_folder(self, index: int) -> None:
        value = self.folder_selector.itemData(index)
        if not value:
            return
        self.cache.settings.set_selected_local_folder(Path(value))
        if self.mode == "本地":
            records = self.visible_records()
            self.render(records)
            self.status.setText(f"当前展示 {len(records)} 张本地图片")

    def choose_local_folder(self) -> None:
        selected = self.cache.settings.selected_local_folder() or Path.home()
        folder = QFileDialog.getExistingDirectory(self, "选择壁纸文件夹", str(selected))
        if not folder:
            return
        self.cache.settings.add_local_folder(Path(folder))
        self._sync_folder_selector()
        self.set_mode("本地")

    def _refresh_label(self) -> str:
        return "获取更多 Bing 图片" if self.online_source == "Bing" else "获取更多 Windows 聚焦图片"

    def set_online_source(self, source: str) -> None:
        if source not in {"Bing", "Windows 聚焦"}:
            raise ValueError(f"不支持的线上来源：{source}")
        self.online_source = source
        self.bing_source_button.setChecked(source == "Bing")
        self.spotlight_source_button.setChecked(source == "Windows 聚焦")
        self.refresh_button.setText(self._refresh_label())
        records = self.visible_records()
        self.render(records)
        self.status.setText(f"当前展示 {len(records)} 张 {source} 缓存图片")

    def fetch_current_source(self, callback, source: str | None = None) -> list[ImageRecord]:
        source = source or self.online_source
        if source == "Bing":
            return fetch_bing(self.cache, self.bing_offset, on_image=callback)
        return fetch_spotlight(self.cache, on_image=callback)

    def render(self, images: list[ImageRecord]) -> None:
        while self.grid.count():
            item = self.grid.takeAt(0)
            if item.widget(): item.widget().deleteLater()
        for index, image in enumerate(images[:30]):
            self.grid.addWidget(ImageCard(image, self.apply_image, self.preview_image), index // 3, index % 3)

    def fetch_more(self) -> None:
        self.refresh_button.setEnabled(False); self.status.setText("正在后台获取壁纸…")
        signals = DownloadSignals(); self._signals = signals
        signals.image_ready.connect(self._image_ready); signals.completed.connect(self._download_finished); signals.failed.connect(self._download_failed)
        source = self.online_source
        def work() -> None:
            try:
                callback = signals.image_ready.emit
                images = self.fetch_current_source(callback, source)
                if source == "Bing":
                    self.bing_offset += 5
                signals.completed.emit(images)
            except Exception as error:
                signals.failed.emit(str(error))
        threading.Thread(target=work, daemon=True).start()

    def _download_finished(self, images: list[ImageRecord]) -> None:
        records = self.visible_records(); self.render(records)
        self.status.setText(f"下载完成：新增 {len(images)} 张，当前显示 {len(records)} 张")
        self.refresh_button.setEnabled(True)

    def _image_ready(self, image: ImageRecord) -> None:
        if self.mode != "线上" or image.source != self.online_source:
            return
        records = self.visible_records()
        self.render(records)
        self.status.setText(f"已加载：{image.title} · 当前显示 {len(records)} 张")

    def _download_failed(self, message: str) -> None:
        self.status.setText(f"下载失败：{message}"); self.refresh_button.setEnabled(True)

    def apply_image(self, image: ImageRecord) -> None:
        destination = Path.home() / "Pictures" / "Online Wallpapers" / Path(image.file).name
        destination.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(image.file, destination)
        self._sync(destination, f"已应用：{image.title}")

    def create_preview_dialog(self, image: ImageRecord) -> ImagePreviewDialog:
        return ImagePreviewDialog(image, self.apply_image, self)

    def preview_image(self, image: ImageRecord) -> None:
        self.create_preview_dialog(image).exec()

    def sync_current(self) -> None:
        try:
            self._sync(create_wallpaper_adapter().current_wallpaper(), "已同步当前桌面壁纸")
        except Exception as error:
            self.status.setText(f"同步失败：{error}")

    def _sync(self, path: Path, success: str) -> None:
        try:
            create_wallpaper_adapter().sync_wallpaper(path); self.status.setText(success)
        except Exception as error:
            self.status.setText(f"同步失败：{error}")

    def clear_cache(self) -> None:
        for directory in (self.cache.root / "Bing", self.cache.root / "Spotlight"):
            if directory.is_dir():
                shutil.rmtree(directory)
        if self.cache.index_path.exists():
            self.cache.index_path.unlink()
        self.render(self.visible_records()); self.bing_offset = 0; self.status.setText("线上缓存已清理；本地文件夹设置未受影响")
