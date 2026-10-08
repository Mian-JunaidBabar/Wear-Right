import numpy as np
import pytest
from PIL import Image

from catalog.engine.mannequin import (
    REASON_EMPTY, REASON_FACE, REASON_SKIN, assess, clean_cutout, content_share, extract_garment, skin_share,
    flatten_on_white, split_layers, trim_to_content, union_layers,
)

SKIN = (224, 172, 140)


def blank(size=(100, 100)):
    return Image.new("RGBA", size, (0, 0, 0, 0))


def patch(image, box, colour):
    image.paste(colour + (255,), box)
    return image


class FaceDetector:
    def __init__(self, found):
        self.found = found

    def detect(self, bgr):
        assert bgr.ndim == 3 and bgr.shape[2] == 3
        return object() if self.found else None


def test_trim_crops_to_the_visible_pixels():
    image = patch(blank(), (20, 30, 60, 70), (10, 20, 30))
    assert trim_to_content(image).size == (40, 40)


def test_trim_leaves_an_empty_image_alone():
    assert trim_to_content(blank()).size == (100, 100)


def test_skin_share_is_high_for_skin_and_low_for_navy():
    assert skin_share(patch(blank(), (0, 0, 100, 100), SKIN)) > 0.9
    assert skin_share(patch(blank(), (0, 0, 100, 100), (0, 0, 128))) < 0.05
    assert skin_share(blank()) == 0.0


def test_transparent_pixels_do_not_count_as_skin():
    image = patch(blank(), (0, 0, 10, 10), (0, 0, 128))  # navy garment, transparent elsewhere
    assert skin_share(image) < 0.05 and content_share(image) == pytest.approx(0.01)


def test_a_clean_garment_is_ready():
    garment = patch(blank(), (10, 10, 80, 90), (0, 0, 128))
    assert assess(garment, FaceDetector(False), "top") == (True, "")


def test_a_photo_with_a_face_is_not_ready():
    garment = patch(blank(), (10, 10, 80, 90), (0, 0, 128))
    assert assess(garment, FaceDetector(True), "top") == (False, REASON_FACE)
    assert assess(garment, FaceDetector(True), "footwear") == (False, REASON_FACE)


def test_visible_skin_makes_apparel_not_ready():
    assert assess(patch(blank(), (0, 0, 100, 100), SKIN), FaceDetector(False), "top") == (False, REASON_SKIN)
    assert assess(patch(blank(), (0, 0, 100, 100), SKIN), None, "") == (False, REASON_SKIN)  # slot unknown: be strict


def test_skin_coloured_shoes_and_accessories_are_not_mistaken_for_people():
    brown = patch(blank(), (0, 0, 100, 100), SKIN)
    for slot in ("footwear", "accessory"):
        assert assess(brown, FaceDetector(False), slot) == (True, "")


def test_an_almost_empty_cutout_is_not_ready():
    assert assess(patch(blank(), (0, 0, 3, 3), (0, 0, 128)), None, "top") == (False, REASON_EMPTY)


def test_clean_cutout_makes_the_edge_hard_and_drops_specks():
    image = blank((200, 200))
    patch(image, (50, 50, 150, 150), (20, 40, 60))
    patch(image, (5, 5, 7, 7), (255, 0, 0))                       # a speck far from the garment
    image.putpixel((100, 100), (20, 40, 60, 100))                 # a half-transparent pixel inside
    cleaned = np.asarray(clean_cutout(image))
    assert set(np.unique(cleaned[..., 3])) == {0, 255}
    assert cleaned[6, 6, 3] == 0 and cleaned[100, 100, 3] == 0    # speck gone, soft pixel became transparent
    assert cleaned[60, 60, 3] == 255
    assert tuple(cleaned[6, 6, :3]) == (0, 0, 0)
    assert trim_to_content(clean_cutout(image)).size == (100, 100)


def stacked(upper=None, lower=None, full=None, size=(60, 60)):
    layers = []
    for box in (upper, lower, full):
        layer = blank(size)
        if box:
            patch(layer, box, (30, 90, 30))
        layers.append(layer)
    out = Image.new("RGBA", (size[0], size[1] * 3))
    for i, layer in enumerate(layers):
        out.paste(layer, (0, i * size[1]))
    return out


def test_split_layers_returns_the_three_stacked_images():
    layers = split_layers(stacked(upper=(0, 0, 10, 10)))
    assert [layer.size for layer in layers] == [(60, 60)] * 3
    assert content_share(layers[0]) > 0 and content_share(layers[1]) == 0


def test_union_layers_combines_garment_pixels():
    first, second = blank((20, 20)), blank((20, 20))
    patch(first, (0, 0, 10, 10), (1, 2, 3))
    patch(second, (10, 10, 20, 20), (4, 5, 6))
    merged = np.asarray(union_layers([first, second]))
    assert merged[5, 5, 3] == 255 and merged[15, 15, 3] == 255 and merged[5, 15, 3] == 0


def test_a_top_comes_from_the_upper_layer_and_trousers_in_the_photo_count_as_a_leak():
    garment, leak = extract_garment("top", split_layers(stacked(upper=(5, 5, 50, 30), lower=(5, 35, 50, 59))))
    assert trim_to_content(garment).size == (45, 25) and leak > 0.1


def test_trousers_come_from_the_lower_layer_and_a_shirt_in_the_photo_is_a_leak():
    garment, leak = extract_garment("bottom", split_layers(stacked(upper=(5, 5, 50, 20), lower=(10, 25, 40, 59))))
    assert trim_to_content(garment).size == (30, 34) and leak > 0.05


def test_a_flat_lay_has_no_leak():
    _, leak = extract_garment("top", split_layers(stacked(upper=(5, 5, 50, 50))))
    assert leak == 0.0


def test_a_kurta_is_the_upper_layer_plus_the_full_body_layer():
    garment, _ = extract_garment("kurta", split_layers(stacked(upper=(10, 0, 50, 20), full=(10, 20, 50, 55))))
    assert trim_to_content(garment).size == (40, 55)


def test_flatten_on_white_replaces_transparency_with_white_and_keeps_the_garment():
    flat = flatten_on_white(patch(blank((10, 10)), (2, 2, 6, 6), (0, 0, 128)))
    assert flat.mode == "RGB" and flat.getpixel((0, 0)) == (255, 255, 255) and flat.getpixel((3, 3)) == (0, 0, 128)


def test_outerwear_is_not_judged_by_the_lower_body_layer():
    """A flat-lay blazer is partly labelled lower-body clothing by the cloth model; that must not read as a person."""
    _, leak = extract_garment("outerwear", split_layers(stacked(upper=(5, 5, 50, 30), lower=(5, 35, 50, 59))))
    assert leak == 0.0
