"""Shopper password reset: no enumeration, one email, a working link, old sessions revoked."""
import re
from urllib.parse import parse_qs, urlparse

import pytest
from django.core import mail
from django.core.cache import cache
from rest_framework.test import APIClient

from core.tests.factories import DEFAULT_PASSWORD, StaffFactory, UserFactory

pytestmark = pytest.mark.django_db

RESET = "/api/auth/password/reset/"
CONFIRM = "/api/auth/password/reset/confirm/"
SAME_ANSWER = {"detail": "If an account exists for this email, we sent a reset link."}
NEW_PASSWORD = "Brand-New-Pass-9"


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    cache.clear()
    yield
    cache.clear()


def reset_link(message):
    match = re.search(r"https?://\S+", message.body)
    assert match, message.body
    parsed = urlparse(match.group(0))
    return parsed, parse_qs(parsed.query)


def request_reset(api_client, email):
    return api_client.post(RESET, {"email": email}, format="json")


def test_existing_customer_gets_one_email_with_the_frontend_link(api_client, settings):
    user = UserFactory(first_name="Ayesha", email="ayesha@example.com")

    response = request_reset(api_client, "Ayesha@Example.com")

    assert response.status_code == 200
    assert response.json() == SAME_ANSWER
    assert len(mail.outbox) == 1
    message = mail.outbox[0]
    assert message.to == [user.email]
    assert message.subject == "Reset your Wear Right password"
    parsed, query = reset_link(message)
    assert f"{parsed.scheme}://{parsed.netloc}" == settings.FRONTEND_URL
    assert parsed.path == "/reset-password"
    assert query["uid"] and query["token"]


def test_unknown_email_gets_the_same_answer_and_no_email(api_client):
    response = request_reset(api_client, "nobody@example.com")

    assert response.status_code == 200
    assert response.json() == SAME_ANSWER
    assert mail.outbox == []


def test_shop_reset_ignores_staff_and_inactive_accounts(api_client):
    StaffFactory(email="boss@wearright.com")
    UserFactory(email="gone@example.com", is_active=False)

    for email in ("boss@wearright.com", "gone@example.com"):
        response = request_reset(api_client, email)
        assert response.status_code == 200
        assert response.json() == SAME_ANSWER
    assert mail.outbox == []


def test_confirm_sets_the_password_and_revokes_old_refresh_tokens(api_client):
    user = UserFactory(email="ayesha@example.com")
    login = api_client.post("/api/auth/login/", {"email": user.email, "password": DEFAULT_PASSWORD}, format="json")
    old_refresh = login.cookies["wr-refresh"].value

    request_reset(api_client, user.email)
    _, query = reset_link(mail.outbox[0])
    response = api_client.post(CONFIRM, {
        "uid": query["uid"][0],
        "token": query["token"][0],
        "new_password1": NEW_PASSWORD,
        "new_password2": NEW_PASSWORD,
    }, format="json")

    assert response.status_code == 200
    user.refresh_from_db()
    assert user.check_password(NEW_PASSWORD)
    # The browser that reset the password is signed out immediately.
    assert response.cookies["wr-access"]["max-age"] == 0
    assert response.cookies["wr-refresh"]["max-age"] == 0
    # Every refresh token issued before the reset is dead.
    replay = APIClient()
    replay.cookies["wr-refresh"] = old_refresh
    assert replay.post("/api/auth/token/refresh/", {}, format="json").status_code == 401
    assert api_client.post("/api/auth/login/", {"email": user.email, "password": NEW_PASSWORD}, format="json").status_code == 200
    assert api_client.post("/api/auth/login/", {"email": user.email, "password": DEFAULT_PASSWORD}, format="json").status_code == 400


def test_a_used_link_cannot_be_replayed(api_client):
    user = UserFactory(email="ayesha@example.com")
    request_reset(api_client, user.email)
    _, query = reset_link(mail.outbox[0])
    payload = {
        "uid": query["uid"][0],
        "token": query["token"][0],
        "new_password1": NEW_PASSWORD,
        "new_password2": NEW_PASSWORD,
    }
    assert api_client.post(CONFIRM, payload, format="json").status_code == 200
    assert api_client.post(CONFIRM, payload, format="json").status_code == 400


def test_bad_token_and_mismatched_passwords_are_rejected(api_client):
    user = UserFactory(email="ayesha@example.com")
    request_reset(api_client, user.email)
    _, query = reset_link(mail.outbox[0])
    base = {"uid": query["uid"][0], "token": query["token"][0]}

    wrong = api_client.post(CONFIRM, {**base, "token": "not-the-token", "new_password1": NEW_PASSWORD, "new_password2": NEW_PASSWORD}, format="json")
    assert wrong.status_code == 400
    mismatch = api_client.post(CONFIRM, {**base, "new_password1": NEW_PASSWORD, "new_password2": "Something-Else-9"}, format="json")
    assert mismatch.status_code == 400
    user.refresh_from_db()
    assert user.check_password(DEFAULT_PASSWORD)


def test_short_password_is_rejected_by_the_django_validators(api_client):
    user = UserFactory(email="ayesha@example.com")
    request_reset(api_client, user.email)
    _, query = reset_link(mail.outbox[0])

    response = api_client.post(CONFIRM, {
        "uid": query["uid"][0],
        "token": query["token"][0],
        "new_password1": "12345",
        "new_password2": "12345",
    }, format="json")

    assert response.status_code == 400
    assert "new_password1" in response.json()["error"]["details"]


def test_reset_requests_are_throttled(api_client):
    for _ in range(5):
        assert request_reset(api_client, "nobody@example.com").status_code == 200
    assert request_reset(api_client, "nobody@example.com").status_code == 429
