import pytest

from recommender.engine.harmony import harmony, hue_gap, is_neutral, leather_match
from recommender.tests.helpers import HEX


def test_neutrals_go_with_anything_even_a_loud_colour():
    for neutral in ("Black", "White", "Grey", "Navy Blue", "Beige", "Khaki", "Brown", "Denim Blue"):
        assert is_neutral(HEX[neutral])
        score, reason = harmony(HEX[neutral], HEX["Hot Pink"])
        assert score >= 0.85 and "neutral" in reason


def test_analogous_colours_score_high():
    score, reason = harmony(HEX["Bright Red"], HEX["Coral"])
    assert score >= 0.85 and "analogous" in reason


def test_complementary_colours_score_high():
    score, reason = harmony(HEX["Royal Blue"], HEX["Orange"])
    assert hue_gap(HEX["Royal Blue"], HEX["Orange"]) >= 150
    assert score >= 0.8 and "complementary" in reason


def test_two_loud_colours_that_are_neither_close_nor_opposite_clash():
    score, reason = harmony(HEX["Hot Pink"], HEX["Yellow"])
    assert score <= 0.3 and "clash" in reason


def test_unknown_colours_are_neutral_ground_not_an_error():
    assert harmony(None, HEX["Black"])[0] == 0.5


def test_harmony_is_symmetric():
    assert harmony(HEX["Teal"], HEX["Coral"]) == harmony(HEX["Coral"], HEX["Teal"])


def test_hue_gap_wraps_around_the_colour_wheel():
    assert hue_gap("#ff0000", "#ff0040") < 20


def test_shoes_and_belt_should_be_the_same_leather():
    assert leather_match(HEX["Brown"], "#7a4a30") >= 0.9
    assert leather_match(HEX["Brown"], HEX["Black"]) <= 0.3
    assert leather_match(HEX["Dark Brown"], HEX["Tan"]) <= 0.3
