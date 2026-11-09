"""Photo quality gate: colour of the light, side light, head turn and blur, on synthetic faces."""
import numpy as np

from scanner.engine.pipeline import analyze_frame
from scanner.engine.quality import THRESHOLDS, check_quality, colour_cast
from scanner.engine.skin import bgr_to_lab
from scanner.tests.fakes import FACE_BOX, _RECTS, synthetic_face

SKIN = (140, 172, 224)
WHITE_WALL = (235, 235, 235)
YELLOW_WALL = (170, 228, 245)   # a white wall under a warm bulb (BGR)
BLUE_WALL = (250, 225, 200)     # a white wall in blue light (BGR)


def _b_star(bgr):
    return float(bgr_to_lab(np.array([bgr], dtype=np.uint8))[0, 2])


def _status(result, key):
    return next(check for check in result["checks"] if check["key"] == key)["status"]


def test_the_test_walls_have_the_colour_we_think():
    assert abs(_b_star(WHITE_WALL)) < 3
    assert THRESHOLDS["cast_b_warm_fail"] < _b_star(YELLOW_WALL) < 35
    assert _b_star(BLUE_WALL) < THRESHOLDS["cast_b_cool_fail"]


def test_daylight_against_a_white_wall_passes_the_cast_check():
    image, detector = synthetic_face(SKIN, background_bgr=WHITE_WALL)
    result = check_quality(image, detector.detect(image), FACE_BOX)
    assert _status(result, "cast") == "pass"


def test_a_yellow_bulb_fails_with_a_clear_message():
    image, detector = synthetic_face(SKIN, background_bgr=YELLOW_WALL)
    result = check_quality(image, detector.detect(image), FACE_BOX)
    assert result["ok"] is False and result["failed"]["key"] == "cast"
    assert "yellow" in result["failed"]["message"].lower()


def test_blue_light_fails():
    image, detector = synthetic_face(SKIN, background_bgr=BLUE_WALL)
    result = check_quality(image, detector.detect(image), FACE_BOX)
    assert result["failed"]["key"] == "cast" and "blue" in result["failed"]["message"].lower()


def test_without_a_neutral_reference_the_cast_is_unknown_and_only_warns():
    image, detector = synthetic_face(SKIN, background_bgr=(60, 60, 60))
    a, b, share = colour_cast(image, FACE_BOX, THRESHOLDS)
    assert a is None and b is None and share < THRESHOLDS["neutral_min_share"]
    result = check_quality(image, detector.detect(image), FACE_BOX)
    assert _status(result, "cast") == "warn" and result["ok"]


def test_light_from_one_side_is_caught():
    image, detector = synthetic_face(SKIN, background_bgr=WHITE_WALL)
    x0, y0, x1, y1 = _RECTS["right_cheek"]
    image[y0:y1, x0:x1] = (60, 75, 100)  # the right cheek in shadow
    result = check_quality(image, detector.detect(image), FACE_BOX)
    assert result["failed"]["key"] == "side_light"


def test_a_turned_head_is_caught():
    image, detector = synthetic_face(SKIN, background_bgr=WHITE_WALL)
    landmarks = detector.detect(image).copy()
    landmarks[1] = (FACE_BOX[0] + 15, 250)  # nose tip near the left edge of the face
    result = check_quality(image, landmarks, FACE_BOX)
    assert result["failed"]["key"] == "pose"


def test_blur_only_warns_by_default_and_can_be_made_to_fail():
    image, detector = synthetic_face(SKIN, background_bgr=WHITE_WALL)
    landmarks = detector.detect(image)
    assert _status(check_quality(image, landmarks, FACE_BOX), "blur") in ("pass", "warn")
    strict = check_quality(image, landmarks, FACE_BOX, {"blur_fail": 1000.0, "blur_warn": 2000.0})
    assert strict["failed"]["key"] == "blur"


def test_each_warning_lowers_confidence():
    image, detector = synthetic_face(SKIN, background_bgr=(60, 60, 60))  # cast unknown: one warning
    result = check_quality(image, detector.detect(image), FACE_BOX)
    warnings = sum(1 for check in result["checks"] if check["status"] == "warn")
    assert result["confidence_factor"] == round(THRESHOLDS["warn_factor"] ** warnings, 3)


def test_the_pipeline_rejects_a_yellow_lit_photo_with_the_reason_and_all_checks():
    image, detector = synthetic_face(SKIN, background_bgr=YELLOW_WALL)
    result = analyze_frame(image, detector)
    assert result["ok"] is False and result["reason"] == "cast"
    assert {check["key"] for check in result["quality"]["checks"]} == {"cast", "blur", "side_light", "pose"}


def test_the_pipeline_returns_the_checks_with_a_good_photo_and_can_skip_them():
    image, detector = synthetic_face(SKIN, background_bgr=WHITE_WALL)
    result = analyze_frame(image, detector)
    assert result["ok"] and result["quality"]["ok"]
    assert analyze_frame(image, detector, check_photo=False)["quality"] is None
