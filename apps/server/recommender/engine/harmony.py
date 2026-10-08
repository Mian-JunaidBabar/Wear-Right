"""Colour harmony between two garments. Pure Python, no Django.

Rules from the PRD: neutrals go with anything; otherwise analogous hues (within 30 degrees) or
complementary hues (150 to 210 apart) score high; two loud saturated colours score low.
"""
import colorsys

from catalog.engine.color import nearest_color

NEUTRAL_NAMES = {
    "White", "Off-White", "Cream", "Beige", "Khaki", "Tan", "Brown", "Dark Brown",
    "Light Grey", "Grey", "Charcoal Grey", "Black", "Navy Blue", "Denim Blue",
}
LOUD_SATURATION = 0.6
HIGH, MID, LOW = 0.9, 0.5, 0.2


def _hls(hex_value):
    r, g, b = (int(hex_value[i:i + 2], 16) / 255 for i in (1, 3, 5))
    hue, lightness, saturation = colorsys.rgb_to_hls(r, g, b)
    return hue * 360, lightness, saturation


def is_neutral(hex_value):
    return nearest_color(hex_value)[0] in NEUTRAL_NAMES


def hue_gap(hex_a, hex_b):
    gap = abs(_hls(hex_a)[0] - _hls(hex_b)[0])
    return min(gap, 360 - gap)


def harmony(hex_a, hex_b):
    """(score 0..1, short reason) for wearing the two colours together."""
    if hex_a is None or hex_b is None:
        return MID, "colour unknown"
    if is_neutral(hex_a) or is_neutral(hex_b):
        return HIGH, "a neutral goes with anything"
    gap = hue_gap(hex_a, hex_b)
    if gap <= 30:
        return HIGH, "analogous colours"
    if 150 <= gap <= 210:
        return 0.85, "complementary colours"
    (_, _, sat_a), (_, _, sat_b) = _hls(hex_a), _hls(hex_b)
    if sat_a > LOUD_SATURATION and sat_b > LOUD_SATURATION:
        return LOW, "two loud colours clash"
    return MID, "colours neither match nor clash"


def leather_match(hex_a, hex_b):
    """Shoes and a belt should be the same leather colour: close in hue and lightness."""
    if hex_a is None or hex_b is None:
        return MID
    (h1, l1, _), (h2, l2, _) = _hls(hex_a), _hls(hex_b)
    gap = min(abs(h1 - h2), 360 - abs(h1 - h2))
    return HIGH if gap <= 25 and abs(l1 - l2) <= 0.18 else LOW
