"""CSRF strategy: cookie-authenticated unsafe requests need Django's CSRF token.

The web app reads the `csrftoken` cookie and echoes it in the X-CSRFToken header
(apps/web/src/lib/api.ts). The Next.js origin is trusted via CSRF_TRUSTED_ORIGINS
because the rewrite makes Origin (:3000) differ from Django's Host (:8000).
"""
import pytest
from rest_framework.test import APIClient

from core.tests.factories import DEFAULT_PASSWORD, ProductFactory, UserFactory

pytestmark = pytest.mark.django_db

NEXT_ORIGIN = "http://localhost:3000"


@pytest.fixture
def logged_in():
    client = APIClient(enforce_csrf_checks=True)
    user = UserFactory()
    r = client.post("/api/auth/login/", {"email": user.email, "password": DEFAULT_PASSWORD}, format="json")
    assert r.status_code == 200  # login itself needs no CSRF token
    return client, user, r.cookies["csrftoken"].value


def order_payload():
    return {"customer_name": "Ali", "product": ProductFactory().id, "quantity": 1}


def test_unsafe_request_without_csrf_header_is_rejected(logged_in):
    client, _, _ = logged_in
    r = client.post("/api/orders/", order_payload(), format="json")
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "PermissionDenied"
    assert "CSRF" in r.json()["error"]["message"]


def test_unsafe_request_with_wrong_csrf_header_is_rejected(logged_in):
    client, _, _ = logged_in
    r = client.post("/api/orders/", order_payload(), format="json", HTTP_X_CSRFTOKEN="wrong")
    assert r.status_code == 403


def test_unsafe_request_with_csrf_header_succeeds(logged_in):
    client, _, token = logged_in
    r = client.post("/api/orders/", order_payload(), format="json", HTTP_X_CSRFTOKEN=token)
    assert r.status_code == 201


def test_safe_requests_need_no_csrf_header(logged_in):
    client, _, _ = logged_in
    assert client.get("/api/orders/").status_code == 200
    assert client.get("/api/auth/me/").status_code == 200


def test_trusted_next_origin_is_accepted(logged_in):
    client, _, token = logged_in
    r = client.post("/api/orders/", order_payload(), format="json", HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN=NEXT_ORIGIN)
    assert r.status_code == 201


def test_foreign_origin_is_rejected_even_with_a_valid_token(logged_in):
    client, _, token = logged_in
    r = client.post("/api/orders/", order_payload(), format="json",
                    HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN="http://evil.example")
    assert r.status_code == 403


def test_logout_and_profile_updates_are_csrf_protected(logged_in):
    client, _, token = logged_in
    assert client.patch("/api/auth/me/", {"gender": "male"}, format="json").status_code == 403
    assert client.patch("/api/auth/me/", {"gender": "male"}, format="json", HTTP_X_CSRFTOKEN=token).status_code == 200
    assert client.post("/api/auth/logout/", {}, format="json").status_code == 403
    assert client.post("/api/auth/logout/", {}, format="json", HTTP_X_CSRFTOKEN=token).status_code == 200


def test_anonymous_guest_requests_need_no_csrf_token():
    # No auth cookie means no ambient credentials to abuse, so no token is demanded.
    client = APIClient(enforce_csrf_checks=True)
    r = client.post("/api/scanner/analyze/", {}, format="multipart")
    assert r.status_code == 400  # reached the view (missing image), not blocked by CSRF
