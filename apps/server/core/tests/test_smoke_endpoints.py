"""Phase 0 smoke tests: one per endpoint, asserting status code and top-level keys."""
import io

import cv2
import numpy as np
import pytest

from core.tests.factories import (
    BookingFactory,
    FaceScanRecordFactory,
    OrderFactory,
    ProductFactory,
    UserProfileFactory,
)

pytestmark = pytest.mark.django_db


def _jpeg_bytes():
    img = np.full((400, 400, 3), (140, 172, 224), dtype=np.uint8)  # BGR skin-like patch
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return io.BytesIO(buf.tobytes())


def test_admin_dashboard(staff_client):
    r = staff_client.get("/api/admin/dashboard/")
    assert r.status_code == 200
    assert set(r.json()) == {"status", "dashboard"}
    assert "total_products" in r.json()["dashboard"]


def test_scanner_analyze(staff_client):
    image = _jpeg_bytes()
    image.name = "frame.jpg"
    r = staff_client.post("/api/scanner/analyze/", {"images": image}, format="multipart")
    assert r.status_code == 200
    body = r.json()
    assert {"status", "detected_skin_tone", "confidence_score", "lighting_quality",
            "brightness", "message", "all_frame_results"} <= set(body)


def test_scanner_analyze_requires_image(staff_client):
    r = staff_client.post("/api/scanner/analyze/", {}, format="multipart")
    assert r.status_code == 400


def test_products_list_and_create(staff_client):
    ProductFactory()
    r = staff_client.get("/api/products/")
    assert r.status_code == 200
    assert set(r.json()) == {"status", "total_products", "products"}
    payload = {
        "name": "New Shirt", "category": "Men Shirt", "cultural_tag": "Casual",
        "compatible_skin_tone": "All", "price": "1500", "stock_quantity": 5,
    }
    r = staff_client.post("/api/products/", payload, format="json")
    assert r.status_code == 201
    assert set(r.json()) == {"status", "message", "product"}


def test_product_detail_update_delete(staff_client):
    product = ProductFactory()
    url = f"/api/products/{product.id}/"
    r = staff_client.get(url)
    assert r.status_code == 200
    assert set(r.json()) == {"status", "product"}
    assert r.json()["product"]["name"] == product.name
    r = staff_client.put(url, {"name": "Renamed"}, format="json")
    assert r.status_code == 200
    assert r.json()["product"]["name"] == "Renamed"
    r = staff_client.delete(url)
    assert r.status_code == 200
    assert staff_client.get(url).status_code == 404


def test_product_image_url_is_relative(staff_client):
    product = ProductFactory(image="products/Blue_Tie.jpeg")
    r = staff_client.get(f"/api/products/{product.id}/")
    assert r.json()["product"]["image"] == "/media/products/Blue_Tie.jpeg"


def test_recommendations(staff_client):
    ProductFactory(compatible_skin_tone="Medium", cultural_tag="Western")
    r = staff_client.get("/api/products/recommendations/?tone=Medium&style=Western")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"status", "target_tone", "target_style", "total_items", "curated_items"}
    assert body["total_items"] == 1


def test_profiles(staff_client):
    UserProfileFactory()
    r = staff_client.get("/api/profiles/")
    assert r.status_code == 200
    assert set(r.json()) == {"status", "profiles"}


def test_outfit_generate(staff_client):
    main = ProductFactory(category="Men Shirt")
    ProductFactory(category="Men Pant", garment_type="Bottom")
    r = staff_client.get(f"/api/outfit/generate/?product_id={main.id}")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"status", "message", "main_item", "outfit"}
    assert set(body["outfit"]) == {"shirt", "pant", "shoes", "accessory", "coat_or_jacket"}
    assert body["outfit"]["pant"] is not None


def test_outfit_generate_validation(staff_client):
    assert staff_client.get("/api/outfit/generate/").status_code == 400
    assert staff_client.get("/api/outfit/generate/?product_id=999999").status_code == 404


def test_orders_list_create_detail(staff_client):
    product = ProductFactory(stock_quantity=3)
    r = staff_client.post("/api/orders/", {
        "customer_name": "Ali", "product": product.id, "quantity": 2,
    }, format="json")
    assert r.status_code == 201
    assert set(r.json()) == {"status", "message", "order"}
    order_id = r.json()["order"]["id"]
    product.refresh_from_db()
    assert product.stock_quantity == 1

    r = staff_client.get("/api/orders/")
    assert r.status_code == 200
    assert set(r.json()) == {"status", "total_orders", "orders"}

    r = staff_client.get(f"/api/orders/{order_id}/")
    assert r.status_code == 200
    assert set(r.json()) == {"status", "order"}
    r = staff_client.put(f"/api/orders/{order_id}/", {"order_status": "Confirmed"}, format="json")
    assert r.status_code == 200
    r = staff_client.delete(f"/api/orders/{order_id}/")
    assert r.status_code == 200
    assert staff_client.get(f"/api/orders/{order_id}/").status_code == 404


def test_order_rejects_more_than_stock(staff_client):
    product = ProductFactory(stock_quantity=1)
    r = staff_client.post("/api/orders/", {
        "customer_name": "Ali", "product": product.id, "quantity": 5,
    }, format="json")
    assert r.status_code == 400


def test_bookings_list_create_detail(staff_client):
    r = staff_client.post("/api/bookings/", {
        "customer_name": "Ali", "booking_type": "Styling Consultation",
        "booking_date": "2030-01-01T10:00:00Z",
    }, format="json")
    assert r.status_code == 201
    assert set(r.json()) == {"status", "message", "booking"}
    booking_id = r.json()["booking"]["id"]

    r = staff_client.get("/api/bookings/")
    assert r.status_code == 200
    assert set(r.json()) == {"status", "total_bookings", "bookings"}

    r = staff_client.get(f"/api/bookings/{booking_id}/")
    assert r.status_code == 200
    assert set(r.json()) == {"status", "booking"}
    r = staff_client.put(f"/api/bookings/{booking_id}/", {"status": "Confirmed"}, format="json")
    assert r.status_code == 200
    r = staff_client.delete(f"/api/bookings/{booking_id}/")
    assert r.status_code == 200
    assert staff_client.get(f"/api/bookings/{booking_id}/").status_code == 404


def test_face_scans(staff_client):
    FaceScanRecordFactory()
    r = staff_client.get("/api/face-scans/")
    assert r.status_code == 200
    assert set(r.json()) == {"status", "total_records", "face_scan_records"}
    assert r.json()["total_records"] == 1


def test_booking_and_order_factories_load():
    # keeps the factories honest: they must stay valid for the permission matrix
    assert OrderFactory().total_amount == 2000
    assert BookingFactory().pk


def test_blank_external_id_is_stored_as_null_so_products_do_not_collide(staff_client):
    payload = {"name": "Blank id", "category": "Men Shirt", "cultural_tag": "Casual",
               "compatible_skin_tone": "All", "price": "1500", "external_id": ""}

    first = staff_client.post("/api/products/", payload, format="json")
    second = staff_client.post("/api/products/", {**payload, "name": "Blank id 2"}, format="json")

    assert first.status_code == 201 and second.status_code == 201
    assert first.json()["product"]["external_id"] is None
    assert second.json()["product"]["external_id"] is None


def test_an_unexpected_crash_is_a_json_500_with_a_friendly_message(monkeypatch):
    from rest_framework.test import APIClient

    def boom(**kwargs):
        raise RuntimeError("database exploded")

    monkeypatch.setattr("accounts.views.register_user", boom)
    client = APIClient(raise_request_exception=False)
    r = client.post("/api/auth/register/", {"name": "A B", "email": "a@example.com", "password": "secret1"}, format="json")
    assert r.status_code == 500
    assert r.json()["error"]["code"] == "ServerError" and "try again" in r.json()["error"]["message"]
    assert "exploded" not in r.content.decode()  # the cause is logged, not shown to shoppers
