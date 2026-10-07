"""The skin tone engine is pure Python (OpenCV + NumPy), so it runs without a database."""
import io

import cv2
import numpy as np

from scanner.engine.skin_tone import classify_skin_tone

EXPECTED_KEYS = {"tone", "confidence", "lighting_quality", "brightness", "message"}
VALID_TONES = {"Fair", "Medium", "Dark", "Rescan Required", "Unknown"}


def _encode(img_bgr):
    ok, buf = cv2.imencode(".png", img_bgr)
    assert ok
    return io.BytesIO(buf.tobytes())


def _synthetic_face_patch():
    """A skin-coloured patch (BGR) with some non-skin colour so white balance keeps it skin-like."""
    img = np.full((600, 600, 3), (200, 160, 90), dtype=np.uint8)  # bluish background
    img[120:420, 170:430] = (140, 172, 224)  # skin-like centre where the engine crops
    return img


def test_synthetic_skin_patch_returns_expected_keys():
    result = classify_skin_tone(_encode(_synthetic_face_patch()))
    assert EXPECTED_KEYS <= set(result)
    assert result["tone"] in VALID_TONES
    assert 0 <= result["confidence"] <= 100


def test_unreadable_image_is_unknown():
    result = classify_skin_tone(io.BytesIO(b"not an image"))
    assert result["tone"] == "Unknown"
    assert result["confidence"] == 0
    assert EXPECTED_KEYS <= set(result)


def test_dark_image_requires_rescan():
    dark = np.full((600, 600, 3), 10, dtype=np.uint8)
    result = classify_skin_tone(_encode(dark))
    assert result["tone"] == "Rescan Required"
    assert result["lighting_quality"] == "Too Low"
