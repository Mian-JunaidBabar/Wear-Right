"""Team members and roles: create, read, update, delete, with the safety rules."""
import pytest
from rest_framework.test import APIClient

from core.tests.factories import DEFAULT_PASSWORD
from staff.models import AdminMember, AdminRole
from staff.services import create_member

pytestmark = pytest.mark.django_db


@pytest.fixture
def boss():
    role = AdminRole.objects.get(slug='super-admin')
    member, _ = create_member(name='Boss', email='boss@example.com', password=DEFAULT_PASSWORD, role=role)
    client = APIClient()
    client.post('/api/admin/auth/login/', {'email': 'boss@example.com', 'password': DEFAULT_PASSWORD}, format='json')
    client.member = member
    return client


def test_member_crud(boss):
    manager = AdminRole.objects.get(slug='manager')
    r = boss.post('/api/admin/members/', {
        'name': 'Ali Tariq', 'email': 'Ali@Example.com', 'password': 'ali-Passw0rd!', 'role': manager.id,
    }, format='json')
    assert r.status_code == 201, r.json()
    member = r.json()['member']
    assert member['email'] == 'ali@example.com' and member['role']['slug'] == 'manager'

    rows = boss.get('/api/admin/members/').json()['members']
    assert {row['email'] for row in rows} == {'boss@example.com', 'ali@example.com'}
    assert [row['is_self'] for row in rows if row['email'] == 'boss@example.com'] == [True]

    order_handler = AdminRole.objects.get(slug='order-handler')
    r = boss.patch(f"/api/admin/members/{member['id']}/", {'role': order_handler.id, 'is_active': False}, format='json')
    assert r.status_code == 200
    assert r.json()['member']['role']['slug'] == 'order-handler'
    assert r.json()['member']['is_active'] is False

    assert boss.delete(f"/api/admin/members/{member['id']}/").status_code == 200
    assert not AdminMember.objects.filter(id=member['id']).exists()


def test_new_member_signs_in_to_admin_not_shop(boss):
    role = AdminRole.objects.get(slug='manager')
    boss.post('/api/admin/members/', {'name': 'Ali', 'email': 'ali@example.com', 'password': 'ali-Passw0rd!', 'role': role.id}, format='json')
    assert APIClient().post('/api/admin/auth/login/', {'email': 'ali@example.com', 'password': 'ali-Passw0rd!'}, format='json').status_code == 200
    assert APIClient().post('/api/auth/login/', {'email': 'ali@example.com', 'password': 'ali-Passw0rd!'}, format='json').status_code == 400


def test_duplicate_email_is_refused(boss):
    role = AdminRole.objects.get(slug='manager')
    r = boss.post('/api/admin/members/', {'name': 'Again', 'email': 'boss@example.com', 'password': 'x-Passw0rd!', 'role': role.id}, format='json')
    assert r.status_code == 400
    assert 'already exists' in r.json()['message']


def test_cannot_lock_yourself_out(boss):
    me = boss.member.id
    manager = AdminRole.objects.get(slug='manager')
    assert boss.patch(f'/api/admin/members/{me}/', {'is_active': False}, format='json').status_code == 400
    assert boss.patch(f'/api/admin/members/{me}/', {'role': manager.id}, format='json').status_code == 400
    assert boss.delete(f'/api/admin/members/{me}/').status_code == 400


def test_last_super_admin_is_protected(boss):
    role = AdminRole.objects.get(slug='super-admin')
    other, _ = create_member(name='Other', email='other@example.com', password=DEFAULT_PASSWORD, role=role)
    # Two super admins: the other one can be removed.
    assert boss.delete(f'/api/admin/members/{other.id}/').status_code == 200
    # Only `boss` is left; the service refuses to demote the last one even for someone else.
    from staff.services import update_member
    manager = AdminRole.objects.get(slug='manager')
    second, _ = create_member(name='Second', email='second@example.com', password=DEFAULT_PASSWORD, role=manager)
    _, error = update_member(second.user, boss.member, role=manager)
    assert error == 'Keep at least one active Super Admin.'


def test_role_crud(boss):
    r = boss.get('/api/admin/roles/')
    assert r.status_code == 200
    assert any(p['key'] == 'orders.manage' for p in r.json()['permissions'])

    r = boss.post('/api/admin/roles/', {'name': 'Stylist', 'description': 'Looks only', 'permissions': ['products.view', 'scans.view']}, format='json')
    assert r.status_code == 201, r.json()
    role = r.json()['role']
    assert role['slug'] == 'stylist' and role['permissions'] == ['products.view', 'scans.view']

    r = boss.patch(f"/api/admin/roles/{role['id']}/", {'permissions': ['products.view']}, format='json')
    assert r.json()['role']['permissions'] == ['products.view']

    assert boss.post('/api/admin/roles/', {'name': 'Bad', 'permissions': ['launch.missiles']}, format='json').status_code == 400
    assert boss.delete(f"/api/admin/roles/{role['id']}/").status_code == 200


def test_system_role_and_roles_in_use_are_protected(boss):
    super_admin = AdminRole.objects.get(slug='super-admin')
    assert boss.patch(f'/api/admin/roles/{super_admin.id}/', {'permissions': []}, format='json').status_code == 400
    assert boss.delete(f'/api/admin/roles/{super_admin.id}/').status_code == 400
    manager = AdminRole.objects.get(slug='manager')
    create_member(name='M', email='m@example.com', password=DEFAULT_PASSWORD, role=manager)
    r = boss.delete(f'/api/admin/roles/{manager.id}/')
    assert r.status_code == 400 and 'members' in r.json()['message']
