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
