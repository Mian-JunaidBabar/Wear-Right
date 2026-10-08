import numpy as np
from PIL import Image

from catalog.engine.cutout import cut_out


def _white_background_remover(seen):
    """Stand-in for rembg: makes near-white pixels transparent. No model download."""
    def remover(image):
        seen["mode"] = image.mode
        rgb = np.asarray(image.convert("RGB"))
        alpha = np.where((rgb >= 245).all(axis=2), 0, 255).astype(np.uint8)
        return Image.fromarray(np.dstack([rgb, alpha]), "RGBA")
    return remover


def test_cut_out_hands_the_remover_rgb_and_returns_rgba_with_a_transparent_background():
    seen = {}
    source = Image.new("RGB", (20, 20), "white")
    source.paste((0, 0, 128), (5, 5, 15, 15))

    result = cut_out(source, _white_background_remover(seen))

    assert seen["mode"] == "RGB"
    assert result.mode == "RGBA"
    assert result.getpixel((0, 0))[3] == 0  # background is transparent
    assert result.getpixel((10, 10))[3] == 255  # garment stays opaque
    assert result.getpixel((10, 10))[:3] == (0, 0, 128)


def test_cut_out_accepts_images_that_are_not_rgb():
    source = Image.new("L", (10, 10), 255)

    result = cut_out(source, _white_background_remover({}))

    assert result.mode == "RGBA"
    assert result.getpixel((0, 0))[3] == 0
