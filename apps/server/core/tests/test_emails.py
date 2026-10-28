"""The shared email helper: both parts, the right sender, and never breaking the caller."""
import pytest
from django.core import mail
from django.test import override_settings

from core.emails import send_email

TEMPLATES = {
    "emails/sample.txt": "Hello {{ name }}. Open {{ frontend_url }}/orders/{{ order_id }}/",
    "emails/sample.html": "<p>Hello {{ name }}.</p><p><a href=\"{{ frontend_url }}/orders/{{ order_id }}/\">Your order</a></p>",
}


@pytest.fixture
def email_settings(settings):
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    settings.DEFAULT_FROM_EMAIL = "Wear Right <no-reply@wearright.local>"
    settings.FRONTEND_URL = "http://localhost:3000"
    settings.TEMPLATES = [
        {
            "BACKEND": "django.template.backends.django.DjangoTemplates",
            "APP_DIRS": False,
            "OPTIONS": {
                "loaders": [("django.template.loaders.locmem.Loader", TEMPLATES)],
            },
        },
    ]


@pytest.mark.django_db
def test_send_email_renders_text_and_html_parts(email_settings):
    sent = send_email(
        to="ayesha@example.com",
        subject="Order WR-ABC12345 placed",
        template="sample",
        context={"name": "Ayesha", "order_id": 7},
    )

    assert sent is True
    assert len(mail.outbox) == 1
    message = mail.outbox[0]
    assert message.to == ["ayesha@example.com"]
    assert message.from_email == "Wear Right <no-reply@wearright.local>"
    assert message.subject == "Order WR-ABC12345 placed"
    assert "Hello Ayesha" in message.body
    assert "http://localhost:3000/orders/7/" in message.body
    html, content_type = message.alternatives[0]
    assert content_type == "text/html"
    assert "<p>Hello Ayesha.</p>" in html


@pytest.mark.django_db
def test_send_email_skips_a_missing_recipient(email_settings):
    assert send_email(to="", subject="Nothing", template="sample") is False
    assert mail.outbox == []


@pytest.mark.django_db
def test_smtp_failure_is_logged_and_swallowed(email_settings, monkeypatch, caplog):
    def explode(*args, **kwargs):
        raise ConnectionRefusedError("mailpit is down")

    monkeypatch.setattr(mail.EmailMultiAlternatives, "send", explode)

    assert send_email(to="ayesha@example.com", subject="Order placed", template="sample") is False
    assert "Could not send email" in caplog.text
