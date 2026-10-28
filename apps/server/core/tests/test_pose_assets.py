from pathlib import Path

from core.management.commands import download_models


def test_pose_assets_copy_the_wasm_and_keep_an_existing_model(tmp_path, monkeypatch):
    source = tmp_path / "node_modules" / "wasm"
    source.mkdir(parents=True)
    (source / "vision_wasm_internal.js").write_text("glue")
    (source / "vision_wasm_internal.wasm").write_bytes(b"wasm")
    public = tmp_path / "public"
    public.mkdir()
    (public / "pose_landmarker_lite.task").write_bytes(b"model")

    monkeypatch.setattr(download_models, "POSE_ASSET_DIR", public)
    monkeypatch.setattr(download_models, "POSE_WASM_SOURCE", source)
    target, wasm_dirs = download_models.download_pose_assets()

    assert target.read_bytes() == b"model"
    assert (wasm_dirs[0] / "vision_wasm_internal.wasm").read_bytes() == b"wasm"
    assert (public / "wasm" / "vision_wasm_internal.js").read_text() == "glue"
    assert not list(public.glob("*.part"))


def test_missing_node_modules_is_reported_with_the_fix(tmp_path, monkeypatch):
    monkeypatch.setattr(download_models, "POSE_ASSET_DIR", Path(tmp_path) / "public")
    monkeypatch.setattr(download_models, "POSE_WASM_SOURCE", Path(tmp_path) / "missing")
    try:
        download_models.download_pose_assets()
    except FileNotFoundError as exc:
        assert "npm --prefix apps/web install" in str(exc)
    else:  # pragma: no cover - the missing path must raise
        raise AssertionError("expected FileNotFoundError")
