import pytest
from django.contrib.auth.models import User
from django.core.management import call_command

from accounts.models import UserProfile
from catalog.models import Product

pytestmark = pytest.mark.django_db


def test_seed_is_idempotent_and_creates_demo_logins(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    settings.DEBUG = True

    call_command("seed_products")
    first = Product.objects.count()
    call_command("seed_products")

    assert first == 11
    assert Product.objects.count() == first  # running twice does not duplicate
    assert (tmp_path / "products" / "Blue_Tie.jpeg").exists()  # seed images copied into MEDIA_ROOT

    admin = User.objects.get(username="admin")
    assert admin.is_staff and admin.email == "admin@wearright.local" and admin.check_password("admin12345")
    demo = User.objects.get(email="demo@wearright.local")
    assert not demo.is_staff and demo.check_password("demo12345")
    assert UserProfile.objects.filter(user=demo).count() == 1
    assert User.objects.filter(email="demo@wearright.local").count() == 1


def test_seed_creates_no_logins_without_a_password_outside_debug(settings, tmp_path, monkeypatch):
    settings.MEDIA_ROOT = tmp_path
    settings.DEBUG = False
    monkeypatch.delenv("DEMO_ADMIN_PASSWORD", raising=False)
    monkeypatch.delenv("DEMO_USER_PASSWORD", raising=False)

    call_command("seed_products")

    assert not User.objects.filter(username__in=["admin", "demo@wearright.local"]).exists()
