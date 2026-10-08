import numpy as np
import pytest

from scanner.engine.pipeline import analyze_frame, consensus, white_balance_gains
from scanner.engine.skin import MONK_SWATCHES
from scanner.tests.fakes import FACE_BOX, NoFaceDetector, synthetic_face


def _bgr(hex_value):
    return tuple(int(hex_value[i:i + 2], 16) for i in (5, 3, 1))


def test_no_face_asks_for_a_new_scan():
    image, _ = synthetic_face((140, 172, 224))
    result = analyze_frame(image, NoFaceDetector())
    assert result["ok"] is False and result["reason"] == "no_face"
    assert "face" in result["message"].lower()


def test_an_unreadable_image_is_reported():
    assert analyze_frame(None, NoFaceDetector())["reason"] == "unreadable"


def test_a_face_that_is_too_small_asks_to_move_closer():
    image, detector = synthetic_face((140, 172, 224))
    far = np.full((2400, 3000, 3), 120, dtype=np.uint8)  # the same face box, in a frame 7.5 times as wide
    far[:500, :400] = image
    detector.reference_width = 3000
    assert analyze_frame(far, detector)["reason"] == "face_too_small"


def test_a_nearly_black_frame_is_too_dark():
    image, detector = synthetic_face((8, 8, 8), background_bgr=(5, 5, 5), bright_eyes=False)
    result = analyze_frame(image, detector)
    assert result["reason"] == "too_dark" and result["lighting"] == "Too Low"


def test_a_clipped_frame_is_too_bright():
    image, detector = synthetic_face((255, 255, 255), background_bgr=(255, 255, 255))
    result = analyze_frame(image, detector)
    assert result["reason"] == "too_bright" and result["lighting"] == "Too Bright"


@pytest.mark.parametrize("number", range(1, 10))
def test_a_patch_painted_with_a_monk_swatch_is_read_back_as_that_swatch(number):
    image, detector = synthetic_face(_bgr(MONK_SWATCHES[number - 1]))
    result = analyze_frame(image, detector)
    assert result["ok"] and result["monk"] == number


def test_depth_gets_darker_as_the_swatch_gets_darker():
    order = {"Fair": 0, "Medium": 1, "Dark": 2}
    depths = []
    for hex_value in MONK_SWATCHES[:9]:
        image, detector = synthetic_face(_bgr(hex_value))
        depths.append(order[analyze_frame(image, detector)["depth"]])
    assert depths == sorted(depths)
    assert depths[0] == 0 and depths[-1] == 2


def test_the_result_has_every_field_the_api_needs():
    image, detector = synthetic_face(_bgr(MONK_SWATCHES[4]))
    result = analyze_frame(image, detector)
    assert {"depth", "undertone", "monk", "ita", "hue", "lab", "lighting", "brightness", "confidence", "skin_pixels"} <= set(result)
    assert 0 < result["confidence"] <= 100


def test_the_background_colour_does_not_change_the_reading_by_default():
    """v1 balanced colour from the face itself; v2 must not let the surroundings or the face shift the result."""
    skin = _bgr(MONK_SWATCHES[4])
    readings = []
    for background in [(120, 120, 120), (200, 120, 40), (30, 60, 200)]:
        image, detector = synthetic_face(skin, background_bgr=background)
        result = analyze_frame(image, detector)
        readings.append((result["lab"], result["undertone"]))
    assert readings[0] == readings[1] == readings[2]


def test_a_face_filling_the_frame_is_not_greyed_out():
    """With gray-world on the face (the v1 bug) a uniform skin patch averages to grey and loses its undertone."""
    image, detector = synthetic_face(_bgr(MONK_SWATCHES[4]))
    result = analyze_frame(image, detector)
    assert result["undertone"] == "warm" and result["lab"][2] > 15


def test_background_balancing_is_opt_in_and_clamped():
    image, detector = synthetic_face(_bgr(MONK_SWATCHES[4]), background_bgr=(220, 120, 20))
    gains = white_balance_gains(image, FACE_BOX)
    assert gains is not None and gains.min() >= 0.88 and gains.max() <= 1.14
    off = analyze_frame(image, detector)
    on = analyze_frame(image, detector, white_balance=True)
    assert off["white_balance"] is False and on["white_balance"] is True
    assert on["lab"] != off["lab"]


def test_balancing_is_skipped_when_the_face_fills_the_frame():
    assert white_balance_gains(np.zeros((100, 100, 3), np.uint8), (0, 0, 100, 100)) is None


def _frame(depth, lab, confidence=100.0, lighting="Good"):
    return {"ok": True, "depth": depth, "lab": lab, "confidence": confidence, "lighting": lighting, "brightness": 100.0}


FAIR_LAB, MEDIUM_LAB = [70.0, 12.0, 24.0], [52.0, 14.0, 22.0]


def test_consensus_is_none_when_no_frame_was_usable():
    assert consensus([{"ok": False, "reason": "no_face"}]) is None


def test_three_agreeing_frames_give_full_agreement():
    result = consensus([_frame("Fair", FAIR_LAB)] * 3)
    assert result["agreement"] == 1.0 and result["frames_agreeing"] == 3 and result["confidence"] == 100.0


def test_a_disagreeing_frame_lowers_agreement_and_confidence():
    result = consensus([_frame("Fair", FAIR_LAB)] * 2 + [_frame("Medium", MEDIUM_LAB)])
    assert result["depth"] == "Fair"
    assert result["agreement"] == pytest.approx(0.67, abs=0.01) and result["frames_agreeing"] == 2
    assert result["confidence"] == pytest.approx(66.7, abs=0.1)


def test_one_frame_cannot_show_agreement_so_it_earns_less():
    assert consensus([_frame("Fair", FAIR_LAB)])["confidence"] == 90.0


def test_failed_frames_are_ignored_by_consensus():
    result = consensus([{"ok": False, "reason": "too_dark"}, _frame("Fair", FAIR_LAB), _frame("Fair", FAIR_LAB)])
    assert result["frames_used"] == 2 and result["agreement"] == 1.0


def test_consensus_reads_monk_and_undertone_from_the_median_lab():
    result = consensus([_frame("Fair", FAIR_LAB)] * 3)
    assert result["monk"] in range(1, 11) and result["undertone"] in {"warm", "cool", "neutral"}
