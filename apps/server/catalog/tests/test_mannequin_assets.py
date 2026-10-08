import io

import pytest
from django.core.files.base import ContentFile
from django.core.management import call_command
from PIL import Image
from rest_framework.test import APIClient

from accounts.models import UserProfile
from catalog.engine.mannequin import NOTE_EXTRACTED, REASON_FACE, REASON_NO_SPLIT
from catalog.services import prepare_mannequin_asset
from core.tests.factories import ProductFactory

pytestmark = pytest.mark.django_db

SKIN = (224, 172, 140)


def photo(boxes, colour=(0, 0, 128), size=(100, 100)):
    image = Image.new("RGBA", size, (0, 0, 0, 0))
    for box in boxes:
        image.paste(colour + (255,), box)
    return image


class Faces:
    def __init__(self, found):
        self.found = found

    def detect(self, bgr):
        return object() if self.found else None


def cloth_giving(upper=None, lower=None, full=None, size=(100, 100)):
    """Stand-in for the cloth model: three stacked layers with the given garment boxes."""
    def run(image):
        out = Image.new("RGBA", (size[0], size[1] * 3), (0, 0, 0, 0))
        for index, box in enumerate((upper, lower, full)):
            if box:
                out.paste((30, 90, 30, 255), (box[0], index * size[1] + box[1], box[2], index * size[1] + box[3]))
        return out
    return run


@pytest.fixture(autouse=True)
def media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "media"


def make(slot="top", **extra):
    return ProductFactory(slot=slot, gender="men", **extra)


def test_a_flat_lay_keeps_its_cutout_trimmed_and_is_ready():
    product = make("top")
    prepare_mannequin_asset(product, source_image=photo([(20, 30, 80, 90)]), detector=Faces(False), cloth=cloth_giving())
    product.refresh_from_db()
    assert product.mannequin_ready and product.mannequin_note == ""
    with Image.open(product.mannequin_image.path) as saved:
        assert saved.size == (60, 60) and saved.mode == "RGBA"


def test_a_person_in_the_photo_is_replaced_by_the_garment_cut_out_of_it():
    product = make("top")
    prepare_mannequin_asset(
        product, source_image=photo([(10, 5, 90, 95)], colour=SKIN), detector=Faces(True),
        cloth=cloth_giving(upper=(20, 20, 80, 60)),
    )
    product.refresh_from_db()
    assert product.mannequin_ready and product.mannequin_note == NOTE_EXTRACTED
    with Image.open(product.mannequin_image.path) as saved:
        assert saved.size == (60, 40)  # just the garment, not the person


def test_a_headless_model_crop_is_caught_by_clothing_in_the_other_body_layer():
    product = make("bottom")
    prepare_mannequin_asset(
        product, source_image=photo([(30, 0, 70, 100)]), detector=Faces(False),   # no face, no skin
        cloth=cloth_giving(upper=(10, 0, 90, 20), lower=(30, 30, 70, 100)),         # but a shirt hem above the trousers
    )
    product.refresh_from_db()
    assert product.mannequin_ready and product.mannequin_note == NOTE_EXTRACTED
    with Image.open(product.mannequin_image.path) as saved:
        assert saved.size == (40, 70)


def test_a_failed_separation_is_reported_instead_of_placing_the_person():
    product = make("top")
    prepare_mannequin_asset(product, source_image=photo([(0, 0, 100, 100)], colour=SKIN), detector=Faces(True), cloth=cloth_giving())
    product.refresh_from_db()
    assert not product.mannequin_ready and product.mannequin_note == REASON_NO_SPLIT


def test_a_person_in_a_shoe_or_accessory_photo_cannot_be_extracted():
    product = make("footwear")
    prepare_mannequin_asset(product, source_image=photo([(0, 0, 100, 100)]), detector=Faces(True), cloth=cloth_giving(upper=(0, 0, 90, 90)))
    product.refresh_from_db()
    assert not product.mannequin_ready and product.mannequin_note == REASON_FACE


def test_brown_shoes_are_not_mistaken_for_skin():
    product = make("footwear")
    prepare_mannequin_asset(product, source_image=photo([(10, 40, 90, 80)], colour=SKIN), detector=Faces(False), cloth=cloth_giving())
    product.refresh_from_db()
    assert product.mannequin_ready


def test_without_a_cloth_model_a_person_photo_is_simply_flagged():
    product = make("top")
    prepare_mannequin_asset(product, source_image=photo([(0, 0, 100, 100)], colour=SKIN), detector=Faces(False), cloth=None)
    product.refresh_from_db()
    assert not product.mannequin_ready and "skin" in product.mannequin_note


# ---- the command ----------------------------------------------------------------------------------------

@pytest.fixture
def stand_ins(monkeypatch):
    monkeypatch.setattr("catalog.management.commands.prepare_mannequin_assets.get_detector", lambda: Faces(False))
    monkeypatch.setattr("catalog.management.commands.prepare_mannequin_assets.cloth_remover", lambda **kw: cloth_giving())


def with_photo(product):
    buffer = io.BytesIO()
    photo([(10, 10, 90, 90)]).save(buffer, format="PNG")
    product.image.save("p.png", ContentFile(buffer.getvalue()), save=True)
    return product


def run(**options):
    out, err = io.StringIO(), io.StringIO()
    call_command("prepare_mannequin_assets", stdout=out, stderr=err, **options)
    return out.getvalue(), err.getvalue()


def test_the_command_prepares_each_product_once_and_force_redoes_them(stand_ins):
    product = with_photo(make("top"))
    ProductFactory(image=None)  # no photo: left alone

    out, _ = run()
    product.refresh_from_db()
    first_file = product.mannequin_image.name
    assert "Prepared 1 products: 1 ready" in out and first_file

    out, _ = run()
    assert "Prepared 0 products" in out

    out, _ = run(force=True)
    assert "Prepared 1 products" in out


def test_one_broken_photo_is_reported_and_the_rest_continue(stand_ins):
    good = with_photo(make("top"))
    broken = make("bottom")
    broken.image.name = "products/missing.png"
    broken.save()

    out, err = run()

    good.refresh_from_db()
    assert good.mannequin_ready and "Prepared 1 products" in out
    assert f"Failed product {broken.pk}" in err


# ---- the API --------------------------------------------------------------------------------------------

def test_the_api_returns_the_mannequin_fields_with_relative_urls():
    product = with_photo(make("top"))
    prepare_mannequin_asset(product, source_image=photo([(10, 10, 90, 90)]), detector=Faces(False))
    client = APIClient()
    body = client.get(f"/api/products/{product.id}/").json()["product"]
    assert body["mannequin_ready"] is True and body["mannequin_image"].startswith("/media/products/mannequin/")
    assert body["back_image"] is None and body["mannequin_note"] == ""


def test_the_look_response_names_the_gender_of_the_body_to_draw():
    anchor = ProductFactory(slot="top", gender="women", status="Active", stock_quantity=5)
    body = APIClient().get(f"/api/looks/complete/?product_id={anchor.id}").json()
    assert body["gender"] == "women"


def test_the_body_size_preset_defaults_to_regular_and_can_be_saved(user):
    UserProfile.objects.create(user=user)
    client = APIClient()
    client.force_authenticate(user=user)
    assert client.get("/api/auth/me/").json()["profile"]["body_preset"] == "regular"
    assert client.patch("/api/auth/me/", {"body_preset": "plus"}, format="json").status_code == 200
    assert UserProfile.objects.get(user=user).body_preset == "plus"
    assert client.patch("/api/auth/me/", {"body_preset": "huge"}, format="json").status_code == 400
