import io

import pytest
from django.core.files.base import ContentFile
from django.core.management import call_command
from PIL import Image, ImageDraw

from catalog.engine.tryon_anchors import compute_tryon_anchors
from catalog.models import Product
from catalog.services import prepare_mannequin_asset
from core.tests.factories import ProductFactory


def canvas(size=(100, 100)):
    image = Image.new("RGBA", size, (0, 0, 0, 0))
    return image, ImageDraw.Draw(image)


def test_a_top_gets_shoulder_ends_and_a_hem_centre():
    image, draw = canvas()
    draw.rectangle((20, 10, 80, 90), fill=(10, 20, 30, 255))
    anchors = compute_tryon_anchors(image, "tshirt")
    assert anchors["l_shoulder"][0] == 20 and anchors["l_shoulder"][1] == pytest.approx(15.67)
    assert anchors["r_shoulder"][0] == 81
    assert anchors["hem_center"] == [50.5, 91]


def test_the_shoulder_width_comes_from_the_top_band_not_the_sleeves_below_it():
    image, draw = canvas()
    draw.rectangle((20, 10, 80, 30), fill=(10, 20, 30, 255))
    draw.rectangle((0, 35, 100, 90), fill=(10, 20, 30, 255))  # wide sleeves / body below the band
    anchors = compute_tryon_anchors(image, "jacket")
    assert anchors["l_shoulder"][0] == 20 and anchors["r_shoulder"][0] == 81


def test_trousers_get_a_waistband_and_a_hem():
    image, draw = canvas()
    draw.rectangle((20, 10, 45, 90), fill=(10, 20, 30, 255))
    draw.rectangle((55, 10, 80, 90), fill=(10, 20, 30, 255))
    anchors = compute_tryon_anchors(image, "jeans")
    assert anchors["l_waist"] == [20, 12.43]
    assert anchors["r_waist"] == [81, 12.43]
    assert anchors["hem_center"] == [50.5, 91]


def test_a_pair_of_shoes_is_split_and_one_shoe_is_boxed():
    image, draw = canvas()
    draw.rectangle((5, 40, 35, 60), fill=(10, 20, 30, 255))
    draw.rectangle((65, 40, 95, 60), fill=(10, 20, 30, 255))
    anchors = compute_tryon_anchors(image, "sneakers")
    x, y, width, height = anchors["shoe_box"]
    assert width == 31 and height == 21
    assert x == 5 and y == 40
    assert anchors["heel"] == [8.1, 50.5]
    assert anchors["toe"] == [32.9, 50.5]


def test_a_single_shoe_is_not_cut_in_half():
    image, draw = canvas()
    draw.rectangle((20, 40, 80, 60), fill=(10, 20, 30, 255))
    anchors = compute_tryon_anchors(image, "formal_shoes")
    assert anchors["shoe_box"] == [20, 40, 61, 21]


def test_a_watch_is_centred_with_a_strap_width():
    image, draw = canvas()
    draw.rectangle((40, 30, 60, 70), fill=(10, 20, 30, 255))
    anchors = compute_tryon_anchors(image, "watch")
    assert anchors["center"] == [50.5, 50.5]
    assert anchors["strap_width"] == pytest.approx(11.55)


def test_a_cap_uses_its_width():
    image, draw = canvas()
    draw.rectangle((25, 30, 75, 60), fill=(10, 20, 30, 255))
    assert compute_tryon_anchors(image, "cap") == {"center": [50.5, 45.5], "width": 51.0}


def test_a_bag_has_no_ar_anchors_and_an_empty_image_has_none():
    image, draw = canvas()
    draw.rectangle((20, 10, 80, 90), fill=(10, 20, 30, 255))
    assert compute_tryon_anchors(image, "bag") is None
    assert compute_tryon_anchors(Image.new("RGBA", (10, 10), (0, 0, 0, 0)), "shirt") is None


@pytest.mark.django_db
def test_preparing_a_cut_out_fills_the_ar_fields(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "media"
    product = ProductFactory(name="Plain Shirt", slot="top", kind="shirt")
    source = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
    ImageDraw.Draw(source).rectangle((20, 10, 80, 90), fill=(20, 20, 20, 255))

    prepare_mannequin_asset(product, source_image=source, detector=None, cloth=None)
    product.refresh_from_db()
    assert product.mannequin_ready and product.tryon_ready
    assert set(product.tryon_anchors) == {"l_shoulder", "r_shoulder", "hem_center"}


@pytest.mark.django_db
def test_the_compute_command_is_idempotent(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "media"
    product = ProductFactory(name="Plain Jeans", slot="bottom", kind="jeans", mannequin_ready=True)
    image = Image.new("RGBA", (40, 60), (0, 0, 0, 0))
    ImageDraw.Draw(image).rectangle((5, 5, 35, 55), fill=(10, 10, 10, 255))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    product.mannequin_image.save("jeans.png", ContentFile(buffer.getvalue()), save=True)

    call_command("compute_tryon_anchors", stdout=io.StringIO())
    product.refresh_from_db()
    first = product.tryon_anchors
    assert product.tryon_ready and first["hem_center"] == [20.5, 56.0]

    out = io.StringIO()
    call_command("compute_tryon_anchors", stdout=out)
    product.refresh_from_db()
    assert product.tryon_anchors == first
    assert "0 ready" in out.getvalue()
    # --force recomputes the same dots rather than drifting.
    call_command("compute_tryon_anchors", "--force", stdout=io.StringIO())
    product.refresh_from_db()
    assert product.tryon_anchors == first
    assert Product.objects.filter(tryon_ready=True).count() == 1


@pytest.mark.django_db
def test_staff_can_save_anchors_and_readiness_follows_them(staff_client, api_client):
    product = ProductFactory(name="Dotted Shirt", slot="top", kind="shirt", mannequin_ready=True)
    anchors = {"l_shoulder": [10, 12], "r_shoulder": [90, 12], "hem_center": [50, 100]}

    response = staff_client.put(f"/api/products/{product.id}/", {"tryon_anchors": anchors}, format="json")
    assert response.status_code == 200
    product.refresh_from_db()
    assert product.tryon_anchors == anchors and product.tryon_ready

    shopper = api_client.put(f"/api/products/{product.id}/", {"tryon_anchors": anchors}, format="json")
    assert shopper.status_code in (401, 403)


@pytest.mark.django_db
def test_bad_anchor_shapes_are_rejected(staff_client):
    product = ProductFactory(name="Bad Dots", slot="top", kind="shirt", mannequin_ready=True)
    response = staff_client.put(
        f"/api/products/{product.id}/",
        {"tryon_anchors": {"l_shoulder": [10, 12], "r_shoulder": "wide", "hem_center": [50, 100]}},
        format="json",
    )
    assert response.status_code == 400
    assert "errors" in response.json()
    product.refresh_from_db()
    assert product.tryon_anchors == {}


@pytest.mark.django_db
def test_clearing_anchors_clears_readiness(staff_client):
    product = ProductFactory(
        name="Cleared Dots", slot="top", kind="shirt", mannequin_ready=True, tryon_ready=True,
        tryon_anchors={"l_shoulder": [1, 1], "r_shoulder": [2, 2], "hem_center": [3, 3]},
    )
    response = staff_client.put(f"/api/products/{product.id}/", {"tryon_anchors": {}}, format="json")
    assert response.status_code == 200
    product.refresh_from_db()
    assert product.tryon_anchors == {} and not product.tryon_ready
