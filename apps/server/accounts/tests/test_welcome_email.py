"""Signing up sends one welcome email, after the account is committed, and never blocks signup."""
import pytest
from django.core import mail
from django.core.mail import EmailMultiAlternatives

pytestmark = pytest.mark.django_db

REGISTER = {
    "name": "Ayesha Khan",
    "email": "ayesha@example.com",
    "password": "Brand-New-Pass-9",
    "password_confirm": "Brand-New-Pass-9",
}


def test_register_sends_a_welcome_email(django_capture_on_commit_callbacks, api_client, settings):
    with django_capture_on_commit_callbacks(execute=True):
        response = api_client.post("/api/auth/register/", REGISTER, format="json")

    assert response.status_code == 201
    assert len(mail.outbox) == 1
    message = mail.outbox[0]
    assert message.to == ["ayesha@example.com"]
    assert message.subject == "Welcome to Wear Right"
    assert "Ayesha" in message.body
    assert f"{settings.FRONTEND_URL}/shop" in message.body
    html, content_type = message.alternatives[0]
    assert content_type == "text/html"
    assert "Welcome to Wear Right" in html


def test_a_broken_mail_server_does_not_break_signup(
    django_capture_on_commit_callbacks, api_client, monkeypatch,
):
    def explode(*args, **kwargs):
        raise ConnectionRefusedError("mailpit is down")

    monkeypatch.setattr(EmailMultiAlternatives, "send", explode)

    with django_capture_on_commit_callbacks(execute=True):
        response = api_client.post("/api/auth/register/", REGISTER, format="json")

    assert response.status_code == 201
    assert api_client.get("/api/auth/me/").status_code == 200
