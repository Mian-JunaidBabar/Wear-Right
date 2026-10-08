"""The mannequin pipeline on real model-photos with the real models. Skipped when `make models` has not been run."""
from pathlib import Path

import pytest
from PIL import Image

from catalog.engine.cutout import cloth_remover, cut_out, rembg_remover
from catalog.engine.mannequin import NOTE_EXTRACTED, content_share, face_view, skin_share
from catalog.services import prepare_mannequin_asset
from core.tests.factories import ProductFactory
from scanner.engine.landmarks import FaceDetector

pytestmark = [pytest.mark.models, pytest.mark.django_db]
SEEDS = Path(__file__).resolve().parents[2] / "seed_media" / "products"


@pytest.fixture(scope="module")
def real(request):
    from django.conf import settings
    root = settings.ML_MODELS_DIR
    needed = [root / "face_landmarker.task", *(root / "rembg" / "models" / name / f"{name}.onnx" for name in ("isnet-general-use", "u2net_cloth_seg"))]
    if not all(path.exists() for path in needed):
        pytest.skip("models missing: run `make models`")
    detector = FaceDetector(root / "face_landmarker.task")
    request.addfinalizer(detector.close)
    return {"detector": detector, "isnet": rembg_remover(model_dir=root / "rembg"), "cloth": cloth_remover(model_dir=root / "rembg")}


def prepared(real, tmp_path, settings, photo, slot):
    settings.MEDIA_ROOT = tmp_path
    with Image.open(SEEDS / photo) as source:
        cutout = cut_out(source, real["isnet"])
    product = ProductFactory(slot=slot, gender="men")
    prepare_mannequin_asset(product, source_image=cutout, detector=real["detector"], cloth=real["cloth"])
    product.refresh_from_db()
    return product, cutout


def test_a_shirt_is_cut_out_of_a_photo_of_a_man_wearing_it(real, tmp_path, settings):
    product, cutout = prepared(real, tmp_path, settings, "Off_White_Casual_Shirt.jpeg", "top")

    assert real["detector"].detect(face_view(cutout)) is not None, "the original cut-out really does contain a face"
    assert product.mannequin_ready and product.mannequin_note == NOTE_EXTRACTED
    with Image.open(product.mannequin_image.path) as garment:
        assert content_share(garment) > 0.3                      # the trimmed crop is mostly garment
        assert skin_share(garment) < 0.12                        # head, neck and hands are gone
        assert real["detector"].detect(face_view(garment)) is None  # no face left


def test_trousers_are_cut_out_of_a_headless_model_crop(real, tmp_path, settings):
    product, _ = prepared(real, tmp_path, settings, "Khaki_Casual_Pant.jpeg", "bottom")

    assert product.mannequin_ready and product.mannequin_note == NOTE_EXTRACTED
    with Image.open(product.mannequin_image.path) as garment:
        assert garment.height > 2 * garment.width                # two legs, not a torso (khaki is skin-coloured, so no skin test)
        assert content_share(garment) > 0.4                      # and no black gaps: the garment fills its box


def test_a_beige_blazer_that_looks_like_skin_to_the_colour_test_still_ends_up_ready_and_clean(real, tmp_path, settings):
    product, _ = prepared(real, tmp_path, settings, "beige_blazer.png", "outerwear")

    assert product.mannequin_ready  # either kept as it was or cut out again; both are fine
    with Image.open(product.mannequin_image.path) as garment:
        assert content_share(garment) > 0.5
        assert real["detector"].detect(face_view(garment)) is None
