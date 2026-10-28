import pytest
from django.test import Client, override_settings

from core.tests.factories import ProductFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def photo_with_file(settings, tmp_path):
    """A product whose photo exists on disk under the test MEDIA_ROOT, without using storage."""
    settings.MEDIA_ROOT = tmp_path / "media"
    name = "products/served.png"
    target = settings.MEDIA_ROOT / name
    target.parent.mkdir(parents=True)
    target.write_bytes(b"png bytes")
    product = ProductFactory(name="Served Shirt")
    product.image.name = name
    product.save()
    return product


@override_settings(DEBUG=False, SERVE_MEDIA=True)
def test_media_is_served_even_with_debug_off(photo_with_file):
    response = Client().get(photo_with_file.image.url)

    assert response.status_code == 200


@override_settings(DEBUG=False, SERVE_MEDIA=False)
def test_media_is_not_served_when_serve_media_is_off(photo_with_file):
    response = Client().get(photo_with_file.image.url)

    assert response.status_code == 404


def test_unknown_media_files_404(photo_with_file):
    response = Client().get("/media/products/nosuchfile.png")

    assert response.status_code == 404
