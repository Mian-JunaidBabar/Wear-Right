"""Admin Mannequin page API: list layers with their checks, upload one product's render, hide / delete."""
import io

import pytest
from PIL import Image

from catalog.alpha_services import import_alpha_kit
from catalog.models import MannequinLayer
from core.tests.factories import ProductFactory
from staff.services import create_role
from staff.tests.test_rbac import client_with_role

from .alpha_fixtures import FAIR, fake_segment, person
from .test_alpha_mannequin import make_kit, products

pytestmark = pytest.mark.django_db
URL = "/api/admin/mannequin/layers/"


@pytest.fixture(autouse=True)
def media_root(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "media"
    return settings.MEDIA_ROOT


@pytest.fixture(autouse=True)
def no_model(monkeypatch):
    monkeypatch.setattr("catalog.alpha_views.get_segmenter", lambda: fake_segment())


def png_upload(array, name):
    buffer = io.BytesIO()
    Image.fromarray(array).save(buffer, format="PNG")
    buffer.seek(0)
    buffer.name = name
    return buffer


def test_staff_see_every_layer_with_its_checks(tmp_path):
    products()
    import_alpha_kit(source_dir=make_kit(tmp_path / "kit"), gender="men", segment=fake_segment())
    MannequinLayer.objects.filter(slot="watch").update(approved=False, note="hand-hidden")

    body = client_with_role("inventory-staff").get(URL, {"gender": "men"}).json()

    assert len(body["layers"]) == 4
    watch = next(row for row in body["layers"] if row["slot"] == "watch")
    assert watch["approved"] is False and watch["note"] == "hand-hidden"
    assert body["bases"]["men"]["image"].startswith("/media/")
    assert {"value": "kurta", "label": "Kurtas"} in body["slots"]


def test_a_role_without_products_view_cannot_open_the_mannequin_page():
    # The seeded Order Handler deliberately has products.view (needed to read product
    # names on orders) so it CAN open this page read-only. A role with no product
    # permission at all is the real RBAC gate.
    role, error = create_role(name="Bookings only", permissions=["bookings.view"])
    assert error is None
    assert client_with_role(role.slug).get(URL).status_code == 403


def test_an_order_handler_can_read_layers_but_not_upload_them():
    client = client_with_role("order-handler")
    response = client.get(URL)
    assert response.status_code == 200
    render = png_upload(person(), "x.png")
    product = ProductFactory(gender="men")
    assert client.post(
        URL, {"product_id": product.id, "slot": "top", "render": render}, format="multipart"
    ).status_code == 403


def test_uploading_a_render_adds_an_approved_layer_with_skin_copies(tmp_path):
    products()
    import_alpha_kit(source_dir=make_kit(tmp_path / "kit"), gender="men", segment=fake_segment())
    new = ProductFactory(gender="men", name="Green shirt")
    client = client_with_role("inventory-staff")

    response = client.post(URL, {
        "product_id": new.id, "slot": "top",
        "render": png_upload(person(top=(40, 160, 40)), "green.png"),
        "render_fair": png_upload(person(top=(40, 160, 40), skin=FAIR), "green fair.png"),
    }, format="multipart")

    assert response.status_code == 201, response.json()
    assert response.json()["skins"] == {"fair": "ok", "dark": "missing"}
    layer = MannequinLayer.objects.get(product=new)
    assert layer.approved and layer.image_fair and not layer.image_dark


def test_a_render_that_moved_is_stored_as_rejected(tmp_path):
    products()
    import_alpha_kit(source_dir=make_kit(tmp_path / "kit"), gender="men", segment=fake_segment())
    new = ProductFactory(gender="men")

    response = client_with_role("inventory-staff").post(URL, {
        "product_id": new.id, "slot": "top", "render": png_upload(person(top=(40, 160, 40), shift=(60, 0)), "moved.png"),
    }, format="multipart")

    assert response.status_code == 422 and response.json()["reason"]
    assert not MannequinLayer.objects.get(product=new).approved


def test_upload_needs_a_base_and_a_known_slot():
    product = ProductFactory(gender="women")
    client = client_with_role("inventory-staff")
    render = png_upload(person(), "x.png")
    assert client.post(URL, {"product_id": product.id, "slot": "hat", "render": render}, format="multipart").status_code == 400
    response = client.post(URL, {"product_id": product.id, "slot": "top", "render": png_upload(person(), "y.png")}, format="multipart")
    assert response.status_code == 400 and "no women mannequin" in response.json()["message"]


def test_staff_can_hide_and_delete_a_layer(tmp_path):
    products()
    import_alpha_kit(source_dir=make_kit(tmp_path / "kit"), gender="men", segment=fake_segment())
    layer = MannequinLayer.objects.get(slot="top")
    client = client_with_role("inventory-staff")

    assert client.patch(f"{URL}{layer.id}/", {"approved": False}, format="json").json()["approved"] is False
    assert not MannequinLayer.objects.get(pk=layer.id).approved
    assert client.delete(f"{URL}{layer.id}/").status_code == 204
    assert not MannequinLayer.objects.filter(pk=layer.id).exists()
