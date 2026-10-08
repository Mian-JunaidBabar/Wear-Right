import pytest
from rest_framework.test import APIClient

from core.tests.factories import ProductFactory

pytestmark = pytest.mark.django_db


def test_the_product_list_hides_drafts_from_shoppers_but_not_staff(api_client, staff_client):
    ProductFactory(name="Shown", status="Active")
    ProductFactory(name="Hidden", status="Draft")

    shopper = api_client.get("/api/products/").json()
    assert shopper["total_products"] == 1
    assert [product["name"] for product in shopper["products"]] == ["Shown"]

    staff = staff_client.get("/api/products/").json()
    assert staff["total_products"] == 2


def test_a_signed_in_customer_does_not_see_drafts(user):
    client = APIClient()
    client.force_authenticate(user=user)
    ProductFactory(status="Draft")

    assert client.get("/api/products/").json()["total_products"] == 0


def test_a_draft_detail_is_404_for_shoppers_and_visible_to_staff(api_client, staff_client):
    draft = ProductFactory(status="Draft")
    url = f"/api/products/{draft.id}/"

    assert api_client.get(url).status_code == 404
    assert staff_client.get(url).status_code == 200


def test_staff_can_price_and_activate_a_draft_and_shoppers_then_see_it(api_client, staff_client):
    draft = ProductFactory(status="Draft", price=0)
    url = f"/api/products/{draft.id}/"

    response = staff_client.put(url, {"price": "4200.00", "status": "Active"}, format="json")

    assert response.status_code == 200
    assert api_client.get(url).status_code == 200


def test_the_catalog_fields_are_returned_by_the_api(staff_client):
    product = ProductFactory(
        external_id="1234", slot="top", gender="men", formality=4, style_tags=["Formal"],
        color_name="Navy Blue", color_hex="#000080", color_palette=[{"hex": "#000080", "name": "Navy Blue", "share": 1.0}],
    )

    body = staff_client.get(f"/api/products/{product.id}/").json()["product"]

    assert body["external_id"] == "1234"
    assert body["slot"] == "top"
    assert body["gender"] == "men"
    assert body["formality"] == 4
    assert body["style_tags"] == ["Formal"]
    assert body["color_name"] == "Navy Blue"
    assert body["color_hex"] == "#000080"
    assert body["color_palette"][0]["name"] == "Navy Blue"


def test_a_customer_cannot_order_a_draft(user):
    client = APIClient()
    client.force_authenticate(user=user)
    draft = ProductFactory(status="Draft", stock_quantity=5)

    response = client.post(
        "/api/orders/", {"customer_name": "Ali", "product": draft.id, "quantity": 1}, format="json",
    )

    assert response.status_code == 400
    assert "not available" in str(response.json())
