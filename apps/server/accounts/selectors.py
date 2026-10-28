from django.contrib.auth.models import User
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode

from .models import UserProfile


def get_profiles(user):
    """Profiles the user may see: their own, or all for staff."""
    profiles = UserProfile.objects.select_related('user').order_by('id')
    if user.is_staff:
        return profiles
    return profiles.filter(user=user)


def get_user_by_email(email):
    return User.objects.filter(email__iexact=email).first()


def email_is_taken(email):
    return User.objects.filter(email__iexact=email).exists() or User.objects.filter(username__iexact=email).exists()


def _is_reset_target(user, audience):
    """Who may reset a password: active shoppers for the shop, active team members for admin."""
    if user is None or not user.is_active:
        return None
    if audience == 'admin':
        from staff.selectors import is_admin_account
        return user if is_admin_account(user) else None
    return None if user.is_staff or user.is_superuser else user


def get_password_reset_target(*, audience='shop', email=None, uid=None):
    """Resolve a reset link or a request email to an eligible user, or None.

    Both audiences share this lookup so the two endpoints cannot drift apart. Looking up an unknown
    or ineligible account returns None; the request endpoint still answers with the same message.
    """
    if email is not None:
        user = get_user_by_email((email or '').strip())
    elif uid is not None:
        try:
            user = User.objects.select_related('userprofile').filter(
                pk=force_str(urlsafe_base64_decode(uid))
            ).first()
        except (TypeError, ValueError, OverflowError):
            user = None
    else:
        user = None
    return _is_reset_target(user, audience)


def get_or_create_profile(user):
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile
