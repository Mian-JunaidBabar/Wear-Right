"""Write bodies.json for the model try-on photos.

Run once after replacing a body photo (needs `make models` for the pose model):

    apps/server/venv/bin/python apps/server/scripts/precompute_body_landmarks.py

The browser does not run pose detection on the model tab: these landmarks are precomputed so the
model view is instant even on a laptop without a GPU.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import mediapipe as mp
import numpy as np
from PIL import Image
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

ROOT = Path(__file__).resolve().parents[2] / "web"
BODIES = ROOT / "public" / "tryon" / "bodies"
MODEL = ROOT / "public" / "mediapipe" / "pose_landmarker_lite.task"


def landmarks_for(image: Image.Image) -> list[dict]:
    options = vision.PoseLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=str(MODEL)),
        running_mode=vision.RunningMode.IMAGE,
        num_poses=1,
    )
    with vision.PoseLandmarker.create_from_options(options) as detector:
        result = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(image)))
    if not result.pose_landmarks:
        raise ValueError("no pose found")
    return [
        {"x": round(point.x, 6), "y": round(point.y, 6), "z": round(point.z, 6), "visibility": round(point.visibility, 6)}
        for point in result.pose_landmarks[0]
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Fail when bodies.json is out of date instead of writing it.")
    args = parser.parse_args()
    if not MODEL.exists():
        raise SystemExit(f"Missing {MODEL}; run `make models` first.")
    rows = []
    for path in sorted(BODIES.glob("*.jpg")):
        gender, preset = path.stem.split("-", 1)
        with Image.open(path) as source:
            image = source.convert("RGB")
            try:
                landmarks = landmarks_for(image)
            except ValueError as exc:
                raise SystemExit(f"{path.name}: {exc}") from exc
        rows.append({
            "id": path.stem,
            "name": f"{gender.title()} · {preset.title()}",
            "gender": gender,
            "preset": preset,
            "image": f"/tryon/bodies/{path.name}",
            "width": image.width,
            "height": image.height,
            "landmarks": landmarks,
        })
    payload = json.dumps(rows, indent=2) + "\n"
    target = BODIES / "bodies.json"
    if args.check:
        if not target.exists() or target.read_text() != payload:
            raise SystemExit("bodies.json is out of date; run this script without --check.")
        return
    target.write_text(payload)
    print(f"wrote {target} ({len(rows)} bodies)")


if __name__ == "__main__":
    main()
