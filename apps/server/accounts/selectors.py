from django.contrib.auth.models import User

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


def get_or_create_profile(user):
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile
