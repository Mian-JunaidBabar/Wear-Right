"""Admin panel sessions are separate from shop sessions."""
import pytest
from rest_framework.test import APIClient

from core.tests.factories import DEFAULT_PASSWORD, UserFactory
from staff.cookies import ADMIN_ACCESS_COOKIE, ADMIN_HINT_COOKIE, ADMIN_REFRESH_COOKIE
from staff.models import AdminRole
from staff.services import create_member

pytestmark = pytest.mark.django_db


@pytest.fixture
def super_admin():
    role = AdminRole.objects.get(slug='super-admin')
    member, error = create_member(name='Hammad Ahmad', email='hammad@example.com', password=DEFAULT_PASSWORD, role=role)
    assert error is None
    return member


def admin_login(client, email='hammad@example.com', password=DEFAULT_PASSWORD):
    return client.post('/api/admin/auth/login/', {'email': email, 'password': password}, format='json')


def test_default_roles_exist():
    slugs = set(AdminRole.objects.values_list('slug', flat=True))
    assert {'super-admin', 'manager', 'inventory-staff', 'order-handler'} <= slugs


def test_admin_login_sets_scoped_cookies_and_returns_permissions(super_admin):
    client = APIClient()
    r = admin_login(client)
    assert r.status_code == 200
    body = r.json()
    assert body['user']['email'] == 'hammad@example.com'
    assert body['role']['slug'] == 'super-admin'
    assert 'team.manage' in body['permissions']
    assert r.cookies[ADMIN_ACCESS_COOKIE]['path'] == '/api/admin/'
    assert r.cookies[ADMIN_ACCESS_COOKIE]['httponly']
    assert r.cookies[ADMIN_REFRESH_COOKIE]['path'] == '/api/admin/'
    assert r.cookies[ADMIN_HINT_COOKIE].value == '1'
    assert 'wr-access' not in r.cookies  # no shop session is created


def test_customer_cannot_use_admin_login():
    UserFactory(username='shopper@example.com', email='shopper@example.com')
    r = admin_login(APIClient(), email='shopper@example.com')
    assert r.status_code == 400
    assert 'admin access' in r.json()['error']['message']


def test_team_member_cannot_use_shop_login(super_admin):
    r = APIClient().post('/api/auth/login/', {'email': 'hammad@example.com', 'password': DEFAULT_PASSWORD}, format='json')
    assert r.status_code == 400
    assert 'admin' in r.json()['error']['message'].lower()


def test_admin_cookie_opens_admin_api_but_not_shop_session(super_admin):
    client = APIClient()
    admin_login(client)
    assert client.get('/api/admin/dashboard/').status_code == 200
    assert client.get('/api/admin/auth/me/').status_code == 200
    # The shop does not see an admin session as a signed-in customer.
    assert client.get('/api/auth/me/').status_code == 401


def test_shop_cookie_does_not_open_admin_api():
    UserFactory(username='shopper@example.com', email='shopper@example.com')
    client = APIClient()
    r = client.post('/api/auth/login/', {'email': 'shopper@example.com', 'password': DEFAULT_PASSWORD}, format='json')
    assert r.status_code == 200
    assert client.get('/api/admin/dashboard/').status_code == 401
    assert client.get('/api/admin/auth/me/').status_code == 401


def test_refresh_rotates_and_logout_clears(super_admin):
    client = APIClient()
    admin_login(client)
    r = client.post('/api/admin/auth/refresh/')
    assert r.status_code == 200
    assert r.cookies[ADMIN_ACCESS_COOKIE].value
    r = client.post('/api/admin/auth/logout/')
    assert r.status_code == 200
    assert r.cookies[ADMIN_ACCESS_COOKIE].value == ''
    assert client.get('/api/admin/auth/me/').status_code == 401


def test_refresh_without_cookie_is_401():
    assert APIClient().post('/api/admin/auth/refresh/').status_code == 401


def test_deactivated_member_loses_access_immediately(super_admin):
    client = APIClient()
    admin_login(client)
    super_admin.is_active = False
    super_admin.save()
    assert client.get('/api/admin/auth/me/').status_code == 401
    assert admin_login(APIClient()).status_code == 400


def test_change_password(super_admin):
    client = APIClient()
    admin_login(client)
    r = client.post('/api/admin/auth/password/', {'current_password': 'wrong', 'new_password': 'n3w-Passw0rd!'}, format='json')
    assert r.status_code == 400
    r = client.post('/api/admin/auth/password/', {'current_password': DEFAULT_PASSWORD, 'new_password': 'n3w-Passw0rd!'}, format='json')
    assert r.status_code == 200
    assert admin_login(APIClient(), password='n3w-Passw0rd!').status_code == 200


def test_update_own_name(super_admin):
    client = APIClient()
    admin_login(client)
    r = client.patch('/api/admin/auth/me/', {'name': 'Hammad A.'}, format='json')
    assert r.status_code == 200
    assert r.json()['user']['name'] == 'Hammad A.'
