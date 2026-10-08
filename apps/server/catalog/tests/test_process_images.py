import io

import pytest
from django.core.files.base import ContentFile
from django.core.management import call_command
from PIL import Image

from core.tests.factories import ProductFactory

pytestmark = pytest.mark.django_db


def _png(hex_value):
    buffer = io.BytesIO()
    Image.new("RGB", (40, 40), hex_value).save(buffer, format="PNG")
    return buffer.getvalue()


def _within(hex_a, hex_b, tolerance=2):
    a = [int(hex_a[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(hex_b[i:i + 2], 16) for i in (1, 3, 5)]
    return max(abs(x - y) for x, y in zip(a, b)) <= tolerance


@pytest.fixture(autouse=True)
def fake_rembg(monkeypatch, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "media"
    # Keeps every pixel opaque; the real remover is rembg and needs a model download.
    monkeypatch.setattr(
        "catalog.management.commands.process_product_images.rembg_remover",
        lambda **kwargs: lambda image: image.convert("RGBA"),
    )


def _run():
    out, err = io.StringIO(), io.StringIO()
    call_command("process_product_images", stdout=out, stderr=err)
    return out.getvalue(), err.getvalue()


def test_a_photo_without_a_colour_gets_a_cutout_and_colour_fields():
    product = ProductFactory(name="Navy Shirt")
    product.image.save("shirt.png", ContentFile(_png("#000080")), save=True)

    out, _ = _run()

    product.refresh_from_db()
    assert "Processed 1 product photos." in out
    assert "-cutout.png" in product.image.name
    assert _within(product.color_hex, "#000080")
    assert product.color_name == "Navy Blue"
    assert product.color_palette[0]["hex"] == product.color_hex


def test_an_admin_set_colour_name_is_kept():
    product = ProductFactory(color_name="Sea Green")
    product.image.save("shirt.png", ContentFile(_png("#000080")), save=True)

    _run()

    product.refresh_from_db()
    assert product.color_name == "Sea Green"
    assert product.color_hex is not None


def test_products_that_already_have_a_colour_are_left_alone():
    product = ProductFactory(color_hex="#123456")
    product.image.save("shirt.png", ContentFile(_png("#000080")), save=True)
    original_image = product.image.name

    out, _ = _run()

    product.refresh_from_db()
    assert product.image.name == original_image
    assert product.color_hex == "#123456"
    assert "Nothing to do" in out


def test_products_without_a_photo_are_skipped():
    ProductFactory(image=None)

    out, _ = _run()

    assert "Nothing to do" in out


def test_a_missing_photo_file_is_reported_and_the_rest_are_processed():
    broken = ProductFactory(name="Broken")
    broken.image.name = "products/does-not-exist.png"
    broken.save()
    good = ProductFactory(name="Good")
    good.image.save("shirt.png", ContentFile(_png("#000080")), save=True)

    out, err = _run()

    good.refresh_from_db()
    assert good.color_hex is not None
    assert "Processed 1 product photos." in out
    assert f"Failed product {broken.pk}" in err
