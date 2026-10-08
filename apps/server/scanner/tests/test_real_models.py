"""Runs the real, downloaded models. Skipped when `make models` has not been run."""
from pathlib import Path

import cv2
import numpy as np
import pytest
from PIL import Image

from scanner.engine.landmarks import FaceDetector
from scanner.engine.pipeline import analyze_frame, consensus
from scanner.engine.regions import EXCLUDED, region_mask

pytestmark = pytest.mark.models


@pytest.fixture(scope="module")
def models_dir():
    from django.conf import settings
    return settings.ML_MODELS_DIR


@pytest.fixture(scope="module")
def detector(models_dir):
    path = models_dir / "face_landmarker.task"
    if not path.exists():
        pytest.skip("face_landmarker.task missing: run `make models`")
    detector = FaceDetector(path)
    yield detector
    detector.close()


@pytest.fixture(scope="module")
def portrait(models_dir):
    path = models_dir / "test_assets" / "portrait.jpg"
    if not path.exists():
        pytest.skip("test portrait missing: run `make models`")
    return cv2.imread(str(path))


def test_mediapipe_finds_478_landmarks_on_a_real_face(detector, portrait):
    landmarks = detector.detect(portrait)
    assert landmarks is not None and landmarks.shape == (478, 2)
    assert landmarks[:, 0].min() >= 0 and landmarks[:, 0].max() <= portrait.shape[1]


def test_mediapipe_finds_no_face_in_a_plain_image(detector):
    assert detector.detect(np.full((400, 400, 3), 128, dtype=np.uint8)) is None


def test_the_sampling_regions_avoid_eyes_brows_mouth_and_nose_on_a_real_face(detector, portrait):
    landmarks = detector.detect(portrait)
    mask = region_mask(landmarks, portrait.shape)
    assert mask.sum() > 2500
    for group, indices in EXCLUDED.items():
        for i in indices:
            x, y = landmarks[i].astype(int)
            assert not mask[y, x], f"{group} landmark {i} fell inside a sampling region"


def test_the_full_pipeline_gives_a_valid_reading_on_a_real_photo(detector, portrait):
    result = analyze_frame(portrait, detector)
    assert result["ok"], result
    assert result["depth"] in {"Fair", "Medium", "Dark"} and 1 <= result["monk"] <= 10
    assert result["undertone"] in {"warm", "cool", "neutral"}
    assert 0 < result["confidence"] <= 100 and result["skin_pixels"] > 2500


def test_three_frames_of_the_same_photo_agree_completely(detector, portrait):
    final = consensus([analyze_frame(portrait, detector) for _ in range(3)])
    assert final["agreement"] == 1.0 and final["frames_agreeing"] == 3


def test_a_small_brightness_change_does_not_flip_the_reading_wildly(detector, portrait):
    base = analyze_frame(portrait, detector)
    dimmer = analyze_frame(cv2.convertScaleAbs(portrait, alpha=0.92), detector)
    assert abs(base["monk"] - dimmer["monk"]) <= 1


def test_real_rembg_cuts_the_background_out_of_a_product_photo(models_dir):
    weights = list((models_dir / "rembg").rglob("isnet-general-use.onnx"))
    photo = Path(__file__).resolve().parents[2] / "seed_media" / "products" / "Blue_Tie.jpeg"
    if not weights:
        pytest.skip("rembg weights missing: run `make models`")
    from catalog.engine.color import palette_from_image
    from catalog.engine.cutout import cut_out, rembg_remover

    remover = rembg_remover(model_dir=models_dir / "rembg")
    with Image.open(photo) as source:
        result = cut_out(source, remover)

    alpha = np.asarray(result)[..., 3]
    assert result.mode == "RGBA"
    assert (alpha < 128).mean() > 0.2, "the background should be mostly transparent"
    assert (alpha >= 128).mean() > 0.01, "the product should survive"
    assert palette_from_image(result)[0]["name"] in {"Navy Blue", "Royal Blue", "Denim Blue", "Deep Purple"}
