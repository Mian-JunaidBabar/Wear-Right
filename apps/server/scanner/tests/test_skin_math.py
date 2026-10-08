import numpy as np
import pytest
from coloraide import Color

from scanner.engine.skin import (
    MONK_SWATCHES, bgr_to_lab, depth_from_ita, hue_degrees, ita_degrees, nearest_monk,
    trimmed_median_lab, undertone_from_hue,
)


def _bgr(hex_value):
    return np.array([[int(hex_value[i:i + 2], 16) for i in (5, 3, 1)]], dtype=np.uint8)


@pytest.mark.parametrize("hex_value", ["#ff0000", "#c68642", "#8d5524", "#f1c27d", "#336699", "#808080"])
def test_lab_conversion_matches_coloraide(hex_value):
    ours = bgr_to_lab(_bgr(hex_value))[0]
    reference = Color(hex_value).convert("lab-d65").coords()
    assert ours == pytest.approx(reference, abs=0.35)


def test_ita_is_the_angle_of_l_minus_50_over_b():
    assert ita_degrees([70.0, 10.0, 20.0]) == pytest.approx(45.0)
    assert ita_degrees([50.0, 10.0, 20.0]) == pytest.approx(0.0)
    assert ita_degrees([30.0, 10.0, 20.0]) == pytest.approx(-45.0)


def test_ita_stays_defined_when_b_is_zero_or_negative():
    assert np.isfinite(ita_degrees([60.0, 5.0, 0.0]))
    assert ita_degrees([60.0, 5.0, -4.0]) == ita_degrees([60.0, 5.0, 1.0])


@pytest.mark.parametrize(("ita", "depth"), [(80, "Fair"), (41.1, "Fair"), (41, "Medium"), (10, "Medium"), (9.9, "Dark"), (-50, "Dark")])
def test_depth_buckets_follow_the_prd_thresholds(ita, depth):
    assert depth_from_ita(ita) == depth


@pytest.mark.parametrize(("hue", "undertone"), [(70, "warm"), (58, "warm"), (57.9, "neutral"), (50, "neutral"), (49.9, "cool"), (30, "cool")])
def test_undertone_follows_the_hue_angle(hue, undertone):
    assert undertone_from_hue(hue) == undertone


def test_hue_is_the_angle_of_b_over_a():
    assert hue_degrees([60.0, 10.0, 10.0]) == pytest.approx(45.0)
    assert hue_degrees([60.0, 0.0, 10.0]) == pytest.approx(90.0)


def test_every_monk_swatch_maps_to_its_own_number():
    for number, hex_value in enumerate(MONK_SWATCHES, start=1):
        lab = Color(hex_value).convert("lab-d65").coords()
        found, distance = nearest_monk(lab)
        assert found == number
        assert distance == pytest.approx(0, abs=1e-3)


def test_there_are_ten_swatches_from_light_to_dark():
    lightness = [Color(h).convert("lab-d65").coords()[0] for h in MONK_SWATCHES]
    assert len(MONK_SWATCHES) == 10
    assert lightness[0] > lightness[-1]
    # Swatches 2 and 3 differ mainly in yellowness, so L* is only monotonic from swatch 3 on.
    assert lightness[2:] == sorted(lightness[2:], reverse=True)


def test_trimmed_median_ignores_highlights_and_shadows():
    skin = np.tile([60.0, 15.0, 20.0], (80, 1))
    outliers = np.vstack([np.tile([98.0, 0.0, 0.0], (10, 1)), np.tile([5.0, 0.0, 0.0], (10, 1))])  # glare and shadow
    result = trimmed_median_lab(np.vstack([skin, outliers]))
    assert result == pytest.approx([60.0, 15.0, 20.0])
