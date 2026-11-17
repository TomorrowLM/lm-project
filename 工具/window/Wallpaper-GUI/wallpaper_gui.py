import sys
from PySide6.QtWidgets import QApplication
from wallpaper_app.ui import MainWindow


if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    raise SystemExit(app.exec())
