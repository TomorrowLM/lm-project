from wallpaper_app.cache import CacheIndex, ImageRecord, cache_file_path
from wallpaper_app import providers


def test_cache_module_exposes_date_and_hash_paths():
    bing = ImageRecord("Bing", "海岸", "20260908", "https://example.test/bing.jpg")
    spotlight = ImageRecord("Windows 聚焦", "山脉", "20260909", "https://example.test/spot.jpg", content_hash="ab/c+=")
    assert cache_file_path(__import__("pathlib").Path("Cache"), bing).as_posix().endswith("Bing/20260908/海岸.jpg")
    assert cache_file_path(__import__("pathlib").Path("Cache"), spotlight).name == "ab_c.jpg"


def test_index_only_returns_existing_unique_files(tmp_path):
    image_file = tmp_path / "image.jpg"
    image_file.write_bytes(b"image")
    index = CacheIndex(tmp_path)
    image = ImageRecord("Bing", "保留", "20260908", "https://example.test/a.jpg", str(image_file))
    index.add(image)
    index.add(image)
    assert index.records() == [index.records()[0]]
    assert index.contains(image)


def test_bing_reports_each_image_after_it_is_cached(tmp_path, monkeypatch):
    monkeypatch.setattr(providers, "_json", lambda _: {"images": [{"title": "第一张", "startdate": "20260908", "urlbase": "/first"}]})
    monkeypatch.setattr(providers, "_download", lambda _, path: (path.parent.mkdir(parents=True, exist_ok=True), path.write_bytes(b"image")))
    received = []

    providers.fetch_bing(CacheIndex(tmp_path), on_image=received.append)

    assert len(received) == 1
    assert received[0].title == "第一张"
