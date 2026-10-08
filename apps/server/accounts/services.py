from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import transaction

from .models import UserProfile
from .selectors import get_user_by_email

PROFILE_FIELDS = (
    'skin_tone', 'monk_tone', 'undertone', 'cultural_preference', 'gender', 'preferred_style',
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
    return user


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
