"""Mannequin (alpha) engine on synthetic photos: alignment, layer cutting, checks and stacking order."""
import numpy as np
import pytest
from PIL import Image

from catalog.engine import alpha_layers as al
from catalog.engine.cutout import cloth_masks_from_predict

from .alpha_fixtures import SHOES, TEE, TROUSERS, WRIST, cloth_masks, fake_segment, person

BASE = person()
BASE_CLOTH = cloth_masks()


def inside(alpha, box, pad=6):
    x0, y0, x1, y1 = box
    return alpha[y0 + pad:y1 - pad, x0 + pad:x1 - pad]


def test_to_canvas_resizes_a_3_4_photo_and_pads_other_shapes():
    assert al.to_canvas(Image.new("RGB", (1792, 2400), "red")).shape == (1280, 960, 3)
    padded = al.to_canvas(Image.new("RGB", (1000, 1000), (10, 20, 30)))
    assert padded.shape == (1280, 960, 3)
    assert tuple(padded[0, 0]) == (10, 20, 30)


def test_align_recovers_a_small_shift():
    render = person(top=(200, 40, 40), shift=(4, -3))
    aligned, report = al.align(BASE, render)
    assert report.ecc is not None and report.ecc > 0.9
    assert abs(report.shift_x - 4) < 1.0 and abs(report.shift_y + 3) < 1.0
    # after alignment the untouched head matches the base again
    x0, y0, x1, y1 = (440, 90, 520, 190)
    assert al.delta_e(BASE[y0:y1, x0:x1], aligned[y0:y1, x0:x1]).mean() < 6


def test_a_shirt_layer_covers_the_shirt_and_nothing_else():
    render = person(top=(200, 40, 40), shift=(2, 1))
    layer, report = al.make_layer(BASE, render, "top", BASE_CLOTH, fake_segment())
    alpha = layer[..., 3]
    assert al.problems(report) == []
    assert (inside(alpha, TEE) > 0).mean() > 0.95
    assert (inside(alpha, TROUSERS) == 0).mean() > 0.95
    assert alpha[:200].max() == 0  # head untouched
    assert (layer[..., :3][alpha == 0] == 0).all()  # transparent pixels carry no colour


def test_a_trouser_layer_reaches_up_under_the_tee_hem():
    render = person(bottom=(30, 60, 120))
    layer, report = al.make_layer(BASE, render, "bottom", BASE_CLOTH, fake_segment())
    alpha = layer[..., 3]
    assert al.problems(report) == []
    assert (inside(alpha, TROUSERS) > 0).mean() > 0.95
    # the waist extension: the bottom rows of the tee are covered with trouser colour
    hem = layer[TEE[3] - 30:TEE[3] - 2, TROUSERS[0] + 10:TROUSERS[2] - 10]
    assert (hem[..., 3] > 0).all()
    assert abs(hem[..., 2].astype(int).mean() - 120) < 20  # blue channel of the new trousers


def test_shoes_are_two_parts_and_a_watch_is_one():
    _, shoes = al.make_layer(BASE, person(shoes=(90, 50, 30)), "shoes", BASE_CLOTH, fake_segment())
    assert shoes.components == 2 and al.problems(shoes) == []
    watch_layer, watch = al.make_layer(BASE, person(watch=(20, 20, 20)), "watch", BASE_CLOTH, fake_segment())
    assert watch.components == 1 and al.problems(watch) == []
    assert (inside(watch_layer[..., 3], WRIST, pad=4) > 0).mean() > 0.9


def test_a_render_where_the_person_moved_is_rejected():
    moved = person(top=(200, 40, 40), shift=(60, 0))
    _, report = al.make_layer(BASE, moved, "top", BASE_CLOTH, fake_segment())
    assert al.problems(report)


def test_a_render_with_no_change_is_rejected():
    _, report = al.make_layer(BASE, person(), "watch", BASE_CLOTH, fake_segment())
    assert any("no change" in reason or "part" in reason for reason in al.problems(report))


def test_composite_draws_top_over_bottom_over_shoes():
    def solid(box, colour):
        layer = np.zeros((*BASE.shape[:2], 4), np.uint8)
        x0, y0, x1, y1 = box
        layer[y0:y1, x0:x1] = (*colour, 255)
        return layer

    overlap = (400, 600, 500, 700)
    out = al.composite(BASE, [("top", solid(overlap, (255, 0, 0))), ("bottom", solid(overlap, (0, 0, 255)))])
    assert tuple(out[650, 450]) == (255, 0, 0)
    out = al.composite(BASE, [("bottom", solid(overlap, (0, 0, 255))), ("shoes", solid(overlap, (0, 255, 0)))])
    assert tuple(out[650, 450]) == (0, 0, 255)


def test_base_top_redraws_the_tee_unchanged():
    base_top, _ = al.build_layer(BASE, BASE, "base_top", BASE_CLOTH, BASE_CLOTH)
    out = al.composite(BASE, [("base_top", base_top)])
    assert np.abs(out.astype(int) - BASE.astype(int)).max() <= 1


def test_cloth_masks_come_from_the_first_two_predict_masks():
    upper = Image.new("L", (4, 4), 0)
    upper.putpixel((1, 1), 255)
    lower = Image.new("L", (4, 4), 255)
    up, low = cloth_masks_from_predict([upper, lower, Image.new("L", (4, 4), 0)])
    assert up.sum() == 1 and up[1, 1] and low.all()
    with pytest.raises(ValueError):
        cloth_masks_from_predict([upper])


@pytest.mark.models
def test_the_real_cloth_model_returns_two_masks_of_the_image_size():
    from django.conf import settings

    from catalog.engine.cutout import cloth_segmenter

    weights = settings.ML_MODELS_DIR / "rembg" / "models" / "u2net_cloth_seg" / "u2net_cloth_seg.onnx"
    if not weights.exists():
        pytest.skip("models missing: run `make models`")
    upper, lower = cloth_segmenter(model_dir=settings.ML_MODELS_DIR / "rembg")(BASE)
    assert upper.shape == lower.shape == BASE.shape[:2]
    assert upper.dtype == bool and lower.dtype == bool
