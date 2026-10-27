"""Roles decide which admin endpoints a team member can use."""
import pytest
from rest_framework.test import APIClient

from core.tests.factories import DEFAULT_PASSWORD, OrderFactory, ProductFactory
from staff.models import AdminRole
from staff.services import create_member

pytestmark = pytest.mark.django_db


def client_with_role(slug, email=None):
    role = AdminRole.objects.get(slug=slug)
    email = email or f'{slug}@example.com'
    member, error = create_member(name=slug.title(), email=email, password=DEFAULT_PASSWORD, role=role)
    assert error is None
    client = APIClient()
    r = client.post('/api/admin/auth/login/', {'email': email, 'password': DEFAULT_PASSWORD}, format='json')
    assert r.status_code == 200
    return client


def test_anonymous_gets_401_everywhere():
    client = APIClient()
    for url in ('/api/admin/dashboard/', '/api/admin/products/', '/api/admin/orders/', '/api/admin/members/'):
        assert client.get(url).status_code == 401, url


@pytest.mark.parametrize('slug, url, expected', [
    ('inventory-staff', '/api/admin/products/', 200),
    ('inventory-staff', '/api/admin/orders/', 403),
    ('inventory-staff', '/api/admin/bookings/', 403),
    ('inventory-staff', '/api/admin/members/', 403),
    ('order-handler', '/api/admin/orders/', 200),
    ('order-handler', '/api/admin/bookings/', 200),
    ('order-handler', '/api/admin/face-scans/', 403),
    ('manager', '/api/admin/face-scans/', 200),
    ('manager', '/api/admin/roles/', 403),
    ('super-admin', '/api/admin/roles/', 200),
    ('super-admin', '/api/admin/members/', 200),
])
def test_read_access_follows_the_role(slug, url, expected):
    assert client_with_role(slug).get(url).status_code == expected


def test_order_handler_can_read_products_but_not_change_them():
    product = ProductFactory()
    client = client_with_role('order-handler')
    assert client.get(f'/api/admin/products/{product.id}/').status_code == 200
    assert client.put(f'/api/admin/products/{product.id}/', {'name': 'X'}, format='json').status_code == 403
    assert client.delete(f'/api/admin/products/{product.id}/').status_code == 403


def test_inventory_staff_can_edit_products():
    product = ProductFactory()
    client = client_with_role('inventory-staff')
    r = client.put(f'/api/admin/products/{product.id}/', {'name': 'Renamed'}, format='json')
    assert r.status_code == 200
    assert r.json()['product']['name'] == 'Renamed'


def test_order_handler_moves_order_status():
    order = OrderFactory()
    client = client_with_role('order-handler')
    r = client.patch(f'/api/admin/orders/{order.id}/status/', {'order_status': 'Confirmed'}, format='json')
    assert r.status_code == 200
    assert r.json()['order']['order_status'] == 'Confirmed'


def test_admin_sees_drafts_and_every_order():
    ProductFactory(status='Draft')
    OrderFactory()
    client = client_with_role('manager')
    statuses = [row['status'] for row in client.get('/api/admin/products/').json()['products']]
    assert 'Draft' in statuses  # the shop hides drafts; the admin list shows them
    assert len(client.get('/api/admin/orders/').json()['orders']) == 1


def test_me_lists_only_the_roles_permissions():
    body = client_with_role('inventory-staff').get('/api/admin/auth/me/').json()
    assert set(body['permissions']) == {'dashboard.view', 'products.view', 'products.manage', 'catalog.manage'}
