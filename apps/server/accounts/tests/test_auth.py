import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

from core.tests.factories import DEFAULT_PASSWORD, UserFactory

pytestmark = pytest.mark.django_db

REGISTER = {"name": "Ayesha Khan", "email": "ayesha@example.com", "password": DEFAULT_PASSWORD}


def assert_error_shape(response, status_code):
    assert response.status_code == status_code
    body = response.json()
    assert set(body) == {"error"}
    assert set(body["error"]) == {"code", "message", "details"}
    assert body["error"]["message"]


def cookie(response, name):
    return response.cookies[name]


def test_register_creates_user_profile_and_logs_in(api_client):
    r = api_client.post("/api/auth/register/", REGISTER, format="json")
    assert r.status_code == 201
    body = r.json()
    assert set(body) == {"user", "profile"}
    assert body["user"]["email"] == "ayesha@example.com"
    assert body["user"]["name"] == "Ayesha Khan"
    assert body["user"]["is_staff"] is False
    assert body["profile"]["gender"] == "unspecified"
    assert "access" not in body and "refresh" not in body
    assert User.objects.get(email="ayesha@example.com").userprofile
    # Cookies set by register work immediately.
    assert api_client.get("/api/auth/me/").status_code == 200


def test_register_cookies_are_httponly(api_client):
    r = api_client.post("/api/auth/register/", REGISTER, format="json")
    for name in ("wr-access", "wr-refresh"):
        assert cookie(r, name)["httponly"]
        assert cookie(r, name)["samesite"] == "Lax"


def test_register_rejects_duplicate_email_case_insensitively(api_client):
    UserFactory(username="taken@example.com", email="taken@example.com")
    r = api_client.post("/api/auth/register/", {**REGISTER, "email": "Taken@Example.com"}, format="json")
    assert_error_shape(r, 400)
    assert "email" in r.json()["error"]["details"]
    assert User.objects.filter(email__iexact="taken@example.com").count() == 1


@pytest.mark.parametrize("password", ["short1", "password", "12345678901234", "ayesha@example.com"])
def test_register_rejects_weak_passwords(api_client, password):
    r = api_client.post("/api/auth/register/", {**REGISTER, "password": password}, format="json")
    assert_error_shape(r, 400)
    assert "password" in r.json()["error"]["details"]
    assert not User.objects.filter(email="ayesha@example.com").exists()


def test_register_requires_fields(api_client):
    assert_error_shape(api_client.post("/api/auth/register/", {}, format="json"), 400)


def test_login_sets_both_httponly_cookies(api_client):
    user = UserFactory()
    r = api_client.post("/api/auth/login/", {"email": user.email, "password": DEFAULT_PASSWORD}, format="json")
    assert r.status_code == 200
    assert set(r.json()) == {"user", "profile"}
    for name in ("wr-access", "wr-refresh"):
        assert cookie(r, name).value
        assert cookie(r, name)["httponly"]
    assert "csrftoken" in r.cookies  # needed for later unsafe requests


def test_login_accepts_username_and_is_case_insensitive_on_email(api_client):
    user = UserFactory(username="shopper", email="Shopper@Example.com")
    assert api_client.post("/api/auth/login/", {"username": "shopper", "password": DEFAULT_PASSWORD}, format="json").status_code == 200
    assert api_client.post("/api/auth/login/", {"email": "shopper@example.COM", "password": DEFAULT_PASSWORD}, format="json").status_code == 200
    assert user.pk


def test_login_with_wrong_password_fails_without_cookies(api_client):
    user = UserFactory()
    r = api_client.post("/api/auth/login/", {"email": user.email, "password": "wrong-password-1"}, format="json")
    assert_error_shape(r, 400)
    assert "wr-access" not in r.cookies


def test_me_works_with_cookie_and_returns_401_without(api_client):
    user = UserFactory()
    anonymous = api_client.get("/api/auth/me/")
    assert_error_shape(anonymous, 401)
    assert anonymous.json()["error"]["code"] == "NotAuthenticated"

    api_client.post("/api/auth/login/", {"email": user.email, "password": DEFAULT_PASSWORD}, format="json")
    r = api_client.get("/api/auth/me/")
    assert r.status_code == 200
    assert r.json()["user"]["email"] == user.email
    assert "csrftoken" in r.cookies


def test_me_patch_updates_profile_and_name(api_client):
    user = UserFactory()
    api_client.post("/api/auth/login/", {"email": user.email, "password": DEFAULT_PASSWORD}, format="json")
    r = api_client.patch("/api/auth/me/", {
        "name": "Sara Ahmed", "gender": "female", "preferred_style": "eastern",
        "top_size": "M", "bottom_size": "30", "shoe_size": "38",
    }, format="json")
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["name"] == "Sara Ahmed"
    assert body["profile"]["gender"] == "female"
    assert body["profile"]["preferred_style"] == "eastern"
    assert (body["profile"]["top_size"], body["profile"]["bottom_size"], body["profile"]["shoe_size"]) == ("M", "30", "38")
    user.refresh_from_db()
    assert user.first_name == "Sara"


def test_me_patch_rejects_invalid_choice_and_ignores_privilege_fields(api_client):
    user = UserFactory()
    api_client.post("/api/auth/login/", {"email": user.email, "password": DEFAULT_PASSWORD}, format="json")
    assert_error_shape(api_client.patch("/api/auth/me/", {"gender": "robot"}, format="json"), 400)
    r = api_client.patch("/api/auth/me/", {"is_staff": True, "is_superuser": True}, format="json")
    assert r.status_code == 200
    user.refresh_from_db()
    assert not user.is_staff and not user.is_superuser


def test_refresh_rotates_and_blacklists_the_old_token(api_client):
    user = UserFactory()
    login = api_client.post("/api/auth/login/", {"email": user.email, "password": DEFAULT_PASSWORD}, format="json")
    old_refresh = cookie(login, "wr-refresh").value

    r = api_client.post("/api/auth/token/refresh/", {}, format="json")
    assert r.status_code == 200
    assert "access" not in r.json() and "refresh" not in r.json()
    new_refresh = cookie(r, "wr-refresh").value
    assert new_refresh and new_refresh != old_refresh
    assert cookie(r, "wr-access")["httponly"] and cookie(r, "wr-refresh")["httponly"]

    # The rotated-out token is blacklisted and can no longer be used.
    replay = APIClient()
    replay.cookies["wr-refresh"] = old_refresh
    assert_error_shape(replay.post("/api/auth/token/refresh/", {}, format="json"), 401)
    # The new one still works.
    assert api_client.post("/api/auth/token/refresh/", {}, format="json").status_code == 200


def test_refresh_without_cookie_is_401(api_client):
    assert_error_shape(api_client.post("/api/auth/token/refresh/", {}, format="json"), 401)


def test_logout_clears_cookies_and_blacklists_refresh_token(api_client):
    user = UserFactory()
    login = api_client.post("/api/auth/login/", {"email": user.email, "password": DEFAULT_PASSWORD}, format="json")
    refresh = cookie(login, "wr-refresh").value

    r = api_client.post("/api/auth/logout/", {}, format="json")
    assert r.status_code == 200
    for name in ("wr-access", "wr-refresh"):
        assert cookie(r, name).value == ""
        assert cookie(r, name)["max-age"] == 0
    assert BlacklistedToken.objects.count() == 1

    # Cookies are gone, so me/ is 401 again; and the old refresh token is dead.
    assert api_client.get("/api/auth/me/").status_code == 401
    replay = APIClient()
    replay.cookies["wr-refresh"] = refresh
    assert replay.post("/api/auth/token/refresh/", {}, format="json").status_code == 401


def test_invalid_access_cookie_is_treated_as_anonymous(api_client):
    api_client.cookies["wr-access"] = "not-a-real-token"
    assert api_client.get("/api/products/").status_code == 200  # public stays public
    assert_error_shape(api_client.get("/api/auth/me/"), 401)  # protected stays protected
