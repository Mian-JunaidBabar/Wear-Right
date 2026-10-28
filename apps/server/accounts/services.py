from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.db import transaction
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from core.emails import send_email

from .models import UserProfile
from .selectors import get_password_reset_target, get_user_by_email

PROFILE_FIELDS = (
    'skin_tone', 'monk_tone', 'undertone', 'favorite_colors', 'avoided_colors', 'body_preset', 'cultural_preference', 'gender', 'preferred_style',
    'top_size', 'bottom_size', 'shoe_size',
)


def split_name(name):
    first, _, last = (name or '').strip().partition(' ')
    return first, last.strip()


@transaction.atomic
def register_user(*, email, password, name='', **profile_fields):
    """Create a customer account and its profile. The email doubles as the username."""
    email = email.strip().lower()
    first_name, last_name = split_name(name)
    user = User.objects.create_user(
        username=email, email=email, password=password,
        first_name=first_name, last_name=last_name,
    )
    UserProfile.objects.create(user=user, **profile_fields)
    transaction.on_commit(lambda: send_welcome_email(user))
    return user


def send_welcome_email(user):
    """A hello after sign-up. Failures are logged by send_email and never reach the customer."""
    return send_email(
        to=user.email,
        subject='Welcome to Wear Right',
        template='welcome',
        context={'name': user.get_full_name() or user.first_name or 'there'},
    )


def authenticate_credentials(*, identifier, password):
    """Log in with an email or a username. Returns the user or None."""
    identifier = (identifier or '').strip()
    match = get_user_by_email(identifier) if '@' in identifier else None
    username = match.username if match else identifier
    user = authenticate(username=username, password=password)
    if user is not None and user.is_active:
        return user
    return None


@transaction.atomic
def update_account(user, profile, *, name=None, **profile_fields):
    """Update the user's display name and profile preferences."""
    if name is not None:
        user.first_name, user.last_name = split_name(name)
        user.save(update_fields=['first_name', 'last_name'])
    for field, value in profile_fields.items():
        setattr(profile, field, value)
    if profile_fields:
        profile.save()
    return user, profile


def save_own_profile(user, **fields):
    """Create or update the signed-in user's profile (POST /api/profiles/)."""
    profile, created = UserProfile.objects.update_or_create(user=user, defaults=fields)
    return profile, created


def save_scan_result(user, *, depth, monk, undertone):
    """Remember a successful scan on the user's profile so they never have to scan again."""
    UserProfile.objects.update_or_create(
        user=user, defaults={'skin_tone': depth, 'monk_tone': monk, 'undertone': undertone},
    )


def password_reset_link(user, *, audience='shop'):
    """The web-app URL a reset email points at. Django serves no HTML for this flow."""
    path = '/admin/reset-password' if audience == 'admin' else '/reset-password'
    query = urlencode({
        'uid': urlsafe_base64_encode(force_bytes(user.pk)),
        'token': default_token_generator.make_token(user),
    })
    return f'{settings.FRONTEND_URL}{path}?{query}'


def send_password_reset_email(user, *, audience='shop', subject=None, template='password_reset', extra_context=None):
    """Send a reset/set-password email. A dead SMTP server logs and returns False, never raises."""
    context = {
        'name': user.get_full_name() or user.first_name or 'there',
        'reset_url': password_reset_link(user, audience=audience),
        'expires_in_minutes': max(settings.PASSWORD_RESET_TIMEOUT // 60, 1),
    }
    context.update(extra_context or {})
    return send_email(
        to=user.email,
        subject=subject or 'Reset your Wear Right password',
        template=template,
        context=context,
    )


def request_password_reset(*, email, audience='shop'):
    """Email a reset link if the address belongs to an eligible account, otherwise do nothing.

    Returns the user or None. Callers must answer the same way in both cases (no enumeration).
    """
    user = get_password_reset_target(email=email, audience=audience)
    if user is not None:
        send_password_reset_email(user, audience=audience)
    return user


@transaction.atomic
def reset_password(*, user, new_password):
    """Set the new password and revoke every refresh token issued before the reset."""
    user.set_password(new_password)
    user.save(update_fields=['password'])
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)
    return user
