"""Team password reset and the optional email invite: same reset flow, admin audience only."""
import re
from urllib.parse import parse_qs, urlparse

import pytest
from django.contrib.auth.models import User
from django.core import mail
from django.core.cache import cache
from rest_framework.test import APIClient

from core.tests.factories import DEFAULT_PASSWORD, UserFactory
from staff.cookies import ADMIN_REFRESH_COOKIE
from staff.models import AdminMember, AdminRole

pytestmark = pytest.mark.django_db

RESET = '/api/admin/auth/password/reset/'
CONFIRM = '/api/admin/auth/password/reset/confirm/'
SAME_ANSWER = {'detail': 'If an account exists for this email, we sent a reset link.'}
NEW_PASSWORD = 'Brand-New-Pass-9'


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def boss():
    role = AdminRole.objects.get(slug='super-admin')
    user = User.objects.create_user(
        username='boss@example.com', email='boss@example.com', password=DEFAULT_PASSWORD,
        first_name='Boss', is_staff=True,
    )
    member = AdminMember.objects.create(user=user, role=role)
    client = APIClient()
    client.post('/api/admin/auth/login/', {'email': 'boss@example.com', 'password': DEFAULT_PASSWORD}, format='json')
    return client, member


def reset_link(message):
    match = re.search(r'https?://\S+', message.body)
    assert match, message.body
    parsed = urlparse(match.group(0))
    return parsed, parse_qs(parsed.query)


def test_admin_reset_sends_one_email_to_the_frontend_admin_link(boss, settings):
    _, member = boss

    response = APIClient().post(RESET, {'email': 'BOSS@example.com'}, format='json')

    assert response.status_code == 200
    assert response.json() == SAME_ANSWER
    assert len(mail.outbox) == 1
    message = mail.outbox[0]
    assert message.to == [member.user.email]
    assert message.subject == 'Reset your Wear Right password'
    parsed, query = reset_link(message)
    assert f'{parsed.scheme}://{parsed.netloc}' == settings.FRONTEND_URL
    assert parsed.path == '/admin/reset-password'
    assert query['uid'] and query['token']


def test_admin_reset_ignores_customers_and_unknown_addresses():
    UserFactory(email='shopper@example.com')

    for email in ('shopper@example.com', 'nobody@example.com'):
        response = APIClient().post(RESET, {'email': email}, format='json')
        assert response.status_code == 200
        assert response.json() == SAME_ANSWER
    assert mail.outbox == []


def test_admin_confirm_changes_the_password_and_clears_the_panel(boss):
    client, member = boss
    APIClient().post(RESET, {'email': member.user.email}, format='json')
    _, query = reset_link(mail.outbox[0])
    old_refresh = client.cookies[ADMIN_REFRESH_COOKIE].value

    response = APIClient().post(CONFIRM, {
        'uid': query['uid'][0],
        'token': query['token'][0],
        'new_password1': NEW_PASSWORD,
        'new_password2': NEW_PASSWORD,
    }, format='json')

    assert response.status_code == 200
    member.user.refresh_from_db()
    assert member.user.check_password(NEW_PASSWORD)
    assert response.cookies['wr-admin-access']['max-age'] == 0
    assert response.cookies[ADMIN_REFRESH_COOKIE]['max-age'] == 0
    # The refresh token from before the reset cannot open a new panel session.
    replay = APIClient()
    replay.cookies[ADMIN_REFRESH_COOKIE] = old_refresh
    assert replay.post('/api/admin/auth/refresh/').status_code == 401
    assert APIClient().post('/api/admin/auth/login/', {
        'email': member.user.email, 'password': NEW_PASSWORD,
    }, format='json').status_code == 200


def test_admin_confirm_rejects_a_bad_token():
    role = AdminRole.objects.get(slug='super-admin')
    user = User.objects.create_user(username='boss@example.com', email='boss@example.com',
                                    password=DEFAULT_PASSWORD, is_staff=True)
    AdminMember.objects.create(user=user, role=role)

    response = APIClient().post(CONFIRM, {
        'uid': 'bad-uid', 'token': 'bad-token',
        'new_password1': NEW_PASSWORD, 'new_password2': NEW_PASSWORD,
    }, format='json')

    assert response.status_code == 400
    user.refresh_from_db()
    assert user.check_password(DEFAULT_PASSWORD)


def test_creating_a_member_without_a_password_needs_the_invite(boss):
    manager = AdminRole.objects.get(slug='manager')
    client, _ = boss

    response = client.post('/api/admin/members/', {
        'name': 'Ali Tariq', 'email': 'ali@example.com', 'role': manager.id,
    }, format='json')

    assert response.status_code == 400
    assert 'password' in response.json()['error']['details']


def test_email_invite_creates_the_member_and_sends_a_set_password_link(boss, django_capture_on_commit_callbacks):
    manager = AdminRole.objects.get(slug='manager')
    client, _ = boss

    with django_capture_on_commit_callbacks(execute=True):
        response = client.post('/api/admin/members/', {
            'name': 'Ali Tariq', 'email': 'ali@example.com', 'role': manager.id, 'email_invite': True,
        }, format='json')

    assert response.status_code == 201, response.json()
    assert len(mail.outbox) == 1
    message = mail.outbox[0]
    assert message.to == ['ali@example.com']
    assert message.subject == 'You have been added to the Wear Right team'
    parsed, query = reset_link(message)
    assert parsed.path == '/admin/reset-password'
    assert query['uid'] and query['token']

    member = AdminMember.objects.get(user__email='ali@example.com')
    assert not member.user.has_usable_password()
    assert APIClient().post('/api/admin/auth/login/', {
        'email': 'ali@example.com', 'password': 'anything',
    }, format='json').status_code == 400

    set_password = APIClient().post(CONFIRM, {
        'uid': query['uid'][0],
        'token': query['token'][0],
        'new_password1': NEW_PASSWORD,
        'new_password2': NEW_PASSWORD,
    }, format='json')
    assert set_password.status_code == 200
    assert APIClient().post('/api/admin/auth/login/', {
        'email': 'ali@example.com', 'password': NEW_PASSWORD,
    }, format='json').status_code == 200


def test_inactive_invite_is_created_without_an_email(boss, django_capture_on_commit_callbacks):
    manager = AdminRole.objects.get(slug='manager')
    client, _ = boss

    with django_capture_on_commit_callbacks(execute=True):
        response = client.post('/api/admin/members/', {
            'name': 'Ali', 'email': 'ali@example.com', 'role': manager.id,
            'email_invite': True, 'is_active': False,
        }, format='json')

    assert response.status_code == 201
    assert mail.outbox == []
