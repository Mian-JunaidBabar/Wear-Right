import numpy as np
import pytest
from PIL import Image

from catalog.engine.color import REFERENCE_COLORS, dominant_palette, nearest_color, palette_from_image


def _rgb(hex_value):
    return np.array([int(hex_value[i:i + 2], 16) for i in (1, 3, 5)], dtype=int)


def _close(hex_a, hex_b, tolerance=2):
    """Colours match within a couple of units per channel (float round-trip through CIELAB)."""
    return int(np.max(np.abs(_rgb(hex_a) - _rgb(hex_b)))) <= tolerance


def test_every_reference_colour_names_itself():
    for name, hex_value in REFERENCE_COLORS:
        found, distance = nearest_color(hex_value)
        assert found == name
        assert distance == pytest.approx(0, abs=1e-6)


def test_nearest_name_is_by_perceptual_distance():
    name, distance = nearest_color("#1e90ff")  # dodger blue sits between Royal Blue and Sky Blue
    assert name == "Royal Blue"
    assert 0 < distance < 20


def test_solid_image_is_one_colour_with_full_share():
    palette = palette_from_image(Image.new("RGB", (40, 40), "#000080"))

    assert len(palette) == 1
    assert palette[0]["name"] == "Navy Blue"
    assert _close(palette[0]["hex"], "#000080")
    assert palette[0]["share"] == 1.0


def test_two_colours_are_listed_largest_share_first():
    image = Image.new("RGBA", (100, 100), (255, 0, 0, 255))
    image.paste((0, 0, 128, 255), (0, 0, 70, 100))  # 70% navy, 30% red

    palette = palette_from_image(image)

    assert [entry["name"] for entry in palette] == ["Navy Blue", "Bright Red"]
    assert palette[0]["share"] == pytest.approx(0.7, abs=0.01)
    assert palette[1]["share"] == pytest.approx(0.3, abs=0.01)


def test_transparent_pixels_are_ignored():
    image = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
    image.paste((200, 30, 40, 255), (30, 0, 100, 100))  # the left 30% is background

    palette = palette_from_image(image)

    assert len(palette) == 1
    assert palette[0]["name"] == "Bright Red"
    assert _close(palette[0]["hex"], "#c81e28")


def test_fully_transparent_image_has_no_colour():
    assert palette_from_image(Image.new("RGBA", (10, 10), (0, 0, 0, 0))) == []


def test_k_is_capped_by_the_number_of_distinct_pixels():
    palette = dominant_palette(np.zeros((4, 4, 3), dtype=np.uint8), k=3)

    assert len(palette) == 1


def test_sampling_is_repeatable_and_keeps_the_dominant_colour_first():
    rng = np.random.default_rng(1)
    rgb = rng.integers(0, 256, size=(120, 120, 3), dtype=np.uint8)
    rgb[:, :90] = (0, 0, 128)  # three quarters navy, so sampling must keep it first

    first = dominant_palette(rgb, k=3, max_samples=500)
    second = dominant_palette(rgb, k=3, max_samples=500)

    assert first == second
    assert first[0]["name"] == "Navy Blue"
    # Noise pixels that land near navy join its cluster, so the share is at least the flat three quarters.
    assert first[0]["share"] >= 0.75


def test_shares_add_up_to_one():
    rng = np.random.default_rng(2)
    rgb = rng.integers(0, 256, size=(60, 60, 3), dtype=np.uint8)

    palette = dominant_palette(rgb, k=3)

    assert sum(entry["share"] for entry in palette) == pytest.approx(1.0, abs=0.01)
