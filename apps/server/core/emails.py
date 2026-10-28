"""Transactional email: one helper so every message has both a plain-text and an HTML part.

Email is never allowed to break a customer action. `send_email` logs a failure and returns False
instead of raising, so a dead SMTP server cannot roll back a checkout or a registration. When the
caller is inside a transaction, wrap the call in `transaction.on_commit(...)` so the message is
sent only after the database has committed.
"""
import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


def send_email(*, to, subject, template, context=None):
    """Render `emails/<template>.txt` and `.html` and send both in one multipart email.

    Returns True when the message was handed to the mail backend, False otherwise. Never raises
    for a missing recipient, a template problem or an SMTP error.
    """
    if not to:
        logger.warning("Skipped email %r: no recipient.", subject)
        return False

    context = dict(context or {})
    context.setdefault("subject", subject)
    context.setdefault("frontend_url", getattr(settings, "FRONTEND_URL", "http://localhost:3000"))

    try:
        text_body = render_to_string(f"emails/{template}.txt", context)
        html_body = render_to_string(f"emails/{template}.html", context)
        message = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[to],
        )
        message.attach_alternative(html_body, "text/html")
        message.send(fail_silently=False)
        return True
    except Exception:  # noqa: BLE001 - email must never take the customer's action down with it
        logger.exception("Could not send email %r to %s.", subject, to)
        return False
