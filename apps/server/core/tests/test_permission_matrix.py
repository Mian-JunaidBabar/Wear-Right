"""One parametrized matrix: every endpoint x method x role.

Roles: anonymous, user (owns the order/booking/profile/scan under test), other (a different
signed-in customer) and staff. Expected statuses follow the Phase 1 spec:
  401 anonymous on a protected endpoint, 403 signed-in but not allowed,
  404 someone else's object (never reveal it exists), 200/201 allowed.
"""
import io

import cv2
import numpy as np
import pytest
from rest_framework.test import APIClient

from core.tests.factories import (
    BookingFactory,
    FaceScanRecordFactory,
    OrderFactory,
    ProductFactory,
    StaffFactory,
    UserFactory,
    UserProfileFactory,
)

pytestmark = pytest.mark.django_db

ROLES = ("anonymous", "user", "other", "staff")


def _frame():
    ok, buf = cv2.imencode(".jpg", np.full((300, 300, 3), (140, 172, 224), dtype=np.uint8))
    assert ok
    f = io.BytesIO(buf.tobytes())
    f.name = "frame.jpg"
    return f


@pytest.fixture
def world(db):
    """Data owned by `user`, plus the three people who will make requests."""
    user, other, staff = UserFactory(), UserFactory(), StaffFactory()
    product = ProductFactory(stock_quantity=50)
    UserProfileFactory(user=user)
    UserProfileFactory(user=other)
    return {
        "users": {"user": user, "other": other, "staff": staff},
        "product": product.id,
        "order": OrderFactory(user=user, product=product).id,
        "booking": BookingFactory(user=user).id,
        "scan": FaceScanRecordFactory(user=user).id,
    }


def client_for(role, world):
    client = APIClient()
    if role != "anonymous":
        client.force_authenticate(user=world["users"][role])
    return client


def product_json(w):
    return {"name": "Matrix Shirt", "category": "Men Shirt", "cultural_tag": "Casual",
            "compatible_skin_tone": "All", "price": "1500", "stock_quantity": 5}


def order_json(w):
    return {"customer_name": "Ali", "product": w["product"], "quantity": 1}


def booking_json(w):
    return {"customer_name": "Ali", "booking_type": "Styling Consultation",
            "booking_date": "2030-01-01T10:00:00Z"}


# (method, path template, payload builder, format, {role: expected status})
def row(anonymous, user, other, staff):
    return dict(zip(ROLES, (anonymous, user, other, staff)))


MATRIX = {
    # catalog: public read, staff-only write
    "GET products/": ("GET", "/api/products/", None, "json", row(200, 200, 200, 200)),
    "POST products/": ("POST", "/api/products/", product_json, "json", row(401, 403, 403, 201)),
    "GET products/<id>/": ("GET", "/api/products/{product}/", None, "json", row(200, 200, 200, 200)),
    "PUT products/<id>/": ("PUT", "/api/products/{product}/", lambda w: {"name": "Renamed"}, "json", row(401, 403, 403, 200)),
    "DELETE products/<id>/": ("DELETE", "/api/products/{product}/", None, "json", row(401, 403, 403, 200)),
    "GET products/<id>/ missing": ("GET", "/api/products/999999/", None, "json", row(404, 404, 404, 404)),
    "GET products/recommendations/": ("GET", "/api/products/recommendations/", None, "json", row(200, 200, 200, 200)),
    # recommender and scanner analysis are public
    "GET outfit/generate/": ("GET", "/api/outfit/generate/?product_id={product}", None, "json", row(200, 200, 200, 200)),
    "POST scanner/analyze/": ("POST", "/api/scanner/analyze/", lambda w: {"images": _frame()}, "multipart", row(200, 200, 200, 200)),
    # profiles: authenticated, scoped
    "GET profiles/": ("GET", "/api/profiles/", None, "json", row(401, 200, 200, 200)),
    "POST profiles/": ("POST", "/api/profiles/", lambda w: {"gender": "female"}, "json", row(401, 201, 201, 201)),
    # orders: authenticated, scoped; write/delete on an existing order is staff-only
    "GET orders/": ("GET", "/api/orders/", None, "json", row(401, 200, 200, 200)),
    "POST orders/": ("POST", "/api/orders/", order_json, "json", row(401, 201, 201, 201)),
    "GET orders/<id>/": ("GET", "/api/orders/{order}/", None, "json", row(401, 200, 404, 200)),
    "PUT orders/<id>/": ("PUT", "/api/orders/{order}/", lambda w: {"order_status": "Confirmed"}, "json", row(401, 403, 403, 200)),
    "DELETE orders/<id>/": ("DELETE", "/api/orders/{order}/", None, "json", row(401, 403, 403, 200)),
    "GET orders/<id>/ missing": ("GET", "/api/orders/999999/", None, "json", row(401, 404, 404, 404)),
    # bookings: same shape as orders
    "GET bookings/": ("GET", "/api/bookings/", None, "json", row(401, 200, 200, 200)),
    "POST bookings/": ("POST", "/api/bookings/", booking_json, "json", row(401, 201, 201, 201)),
    "GET bookings/<id>/": ("GET", "/api/bookings/{booking}/", None, "json", row(401, 200, 404, 200)),
    "PUT bookings/<id>/": ("PUT", "/api/bookings/{booking}/", lambda w: {"status": "Confirmed"}, "json", row(401, 403, 403, 200)),
    "DELETE bookings/<id>/": ("DELETE", "/api/bookings/{booking}/", None, "json", row(401, 403, 403, 200)),
    # scans and the dashboard
    "GET face-scans/": ("GET", "/api/face-scans/", None, "json", row(401, 200, 200, 200)),
    "GET admin/dashboard/": ("GET", "/api/admin/dashboard/", None, "json", row(401, 403, 403, 200)),
}


@pytest.mark.parametrize("role", ROLES)
@pytest.mark.parametrize("name", list(MATRIX))
def test_permission_matrix(name, role, world):
    method, path, payload, fmt, expected = MATRIX[name]
    call = getattr(client_for(role, world), method.lower())
    url = path.format(**world)
    if method in ("POST", "PUT", "PATCH"):
        response = call(url, payload(world) if payload else None, format=fmt)
    else:
        response = call(url)
    assert response.status_code == expected[role], (name, role, response.content[:300])
    if response.status_code in (401, 403, 404) and "error" in response.json():
        assert set(response.json()["error"]) == {"code", "message", "details"}


def test_denied_responses_use_the_error_format(world):
    r = client_for("anonymous", world).get("/api/orders/")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "NotAuthenticated"
    r = client_for("user", world).get("/api/admin/dashboard/")
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "PermissionDenied"


# ---- A can never see or change B's data ------------------------------------------------------

def test_lists_only_contain_the_callers_rows(world):
    other = client_for("other", world)
    assert other.get("/api/orders/").json()["total_orders"] == 0
    assert other.get("/api/bookings/").json()["total_bookings"] == 0
    assert other.get("/api/face-scans/").json()["total_records"] == 0
    profiles = other.get("/api/profiles/").json()["profiles"]
    assert [p["user"] for p in profiles] == [world["users"]["other"].id]

    owner = client_for("user", world)
    assert owner.get("/api/orders/").json()["total_orders"] == 1
    assert owner.get("/api/bookings/").json()["total_bookings"] == 1
    assert owner.get("/api/face-scans/").json()["total_records"] == 1

    staff = client_for("staff", world)
    assert len(staff.get("/api/profiles/").json()["profiles"]) == 2


def test_other_user_cannot_read_or_change_the_owners_order_booking_scan_or_profile(world):
    from accounts.models import UserProfile
    from orders.models import Booking, Order

    other = client_for("other", world)
    owner = world["users"]["user"]

    assert other.get(f"/api/orders/{world['order']}/").status_code == 404
    assert other.put(f"/api/orders/{world['order']}/", {"order_status": "Delivered"}, format="json").status_code == 403
    assert other.delete(f"/api/orders/{world['order']}/").status_code == 403
    assert Order.objects.get(id=world["order"]).order_status == "Pending"

    assert other.get(f"/api/bookings/{world['booking']}/").status_code == 404
    assert other.put(f"/api/bookings/{world['booking']}/", {"status": "Cancelled"}, format="json").status_code == 403
    assert other.delete(f"/api/bookings/{world['booking']}/").status_code == 403
    assert Booking.objects.get(id=world["booking"]).status == "Pending"

    # POSTing a profile only ever writes the caller's own, even when `user` points at someone else.
    r = other.post("/api/profiles/", {"user": owner.id, "gender": "male", "top_size": "XXL"}, format="json")
    assert r.status_code == 201
    assert r.json()["profile"]["user"] == world["users"]["other"].id
    mine = UserProfile.objects.get(user=owner)
    assert (mine.gender, mine.top_size) == ("unspecified", "")
    assert other.get("/api/face-scans/").json()["face_scan_records"] == []


def test_orders_and_bookings_are_owned_by_their_creator(world):
    other = client_for("other", world)
    r = other.post("/api/orders/", order_json(world), format="json")
    assert r.json()["order"]["user"] == world["users"]["other"].id
    r = other.post("/api/bookings/", booking_json(world), format="json")
    assert r.json()["booking"]["user"] == world["users"]["other"].id
    # `user` in the payload is ignored.
    r = other.post("/api/orders/", {**order_json(world), "user": world["users"]["user"].id}, format="json")
    assert r.json()["order"]["user"] == world["users"]["other"].id


def test_customers_cannot_self_approve_orders(world):
    r = client_for("user", world).post(
        "/api/orders/", {**order_json(world), "order_status": "Delivered", "payment_status": "Paid"}, format="json"
    )
    order = r.json()["order"]
    assert (order["order_status"], order["payment_status"]) == ("Pending", "Cash on Delivery")


def test_scan_is_stored_only_for_signed_in_users(world):
    from scanner.models import FaceScanRecord

    before = FaceScanRecord.objects.count()
    client_for("anonymous", world).post("/api/scanner/analyze/", {"images": _frame()}, format="multipart")
    assert FaceScanRecord.objects.count() == before

    client_for("other", world).post("/api/scanner/analyze/", {"images": _frame()}, format="multipart")
    assert FaceScanRecord.objects.count() == before + 1
    assert FaceScanRecord.objects.latest("id").user_id == world["users"]["other"].id
