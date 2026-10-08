import pytest
from rest_framework.test import APIClient

from core.tests.factories import StaffFactory, UserFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return UserFactory()


@pytest.fixture
def staff_user(db):
    return StaffFactory()


@pytest.fixture
def staff_client(staff_user):
    client = APIClient()
    client.force_authenticate(user=staff_user)
    return client


@pytest.fixture(autouse=True)
def fast_password_hasher(settings):
    # PBKDF2 is deliberately slow; tests create many users.
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]


@pytest.fixture(autouse=True)
def fake_face_detector(request, monkeypatch):
    """Tests never load MediaPipe unless they are marked `models`; the default detector finds no face."""
    if request.node.get_closest_marker("models"):
        return
    from scanner.tests.fakes import NoFaceDetector
    monkeypatch.setattr("scanner.services.get_detector", lambda: NoFaceDetector())
