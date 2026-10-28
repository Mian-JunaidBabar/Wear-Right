"""Order emails: placed, status changed, cancelled, and never able to break checkout."""
import pytest
from django.core import mail
from django.core.mail import EmailMultiAlternatives
from rest_framework.test import APIClient

from catalog.models import Product
from core.tests.factories import ProductFactory
from orders.models import Order

pytestmark = pytest.mark.django_db


def checkout_body(**overrides):
    body = {
        'customer_name': 'Ayesha Khan', 'customer_phone': '03001234567',
        'customer_address': '12 Mall Road', 'city': 'Lahore', 'payment_method': 'cod',
    }
    body.update(overrides)
    return body


def order_for(user, **body):
    client = APIClient()
    client.force_authenticate(user=user)
    product = ProductFactory(name='Order Email Shirt', price=2500, stock_quantity=5)
    client.post('/api/cart/', {'product': product.id, 'size': 'M', 'quantity': 2}, format='json')
    response = client.post('/api/checkout/', checkout_body(**body), format='json')
    assert response.status_code == 201, response.json()
    return client, Order.objects.get(id=response.json()['order']['id'])


def test_checkout_sends_order_placed_with_items_total_and_address(user, django_capture_on_commit_callbacks):
    client = APIClient()
    client.force_authenticate(user=user)
    product = ProductFactory(name='Email Checkout Shirt', price=2500, stock_quantity=5)
    client.post('/api/cart/', {'product': product.id, 'size': 'M', 'quantity': 2}, format='json')

    with django_capture_on_commit_callbacks(execute=True):
        response = client.post('/api/checkout/', checkout_body(), format='json')

    assert response.status_code == 201
    order = Order.objects.get(id=response.json()['order']['id'])
    assert len(mail.outbox) == 1
    message = mail.outbox[0]
    assert message.to == [user.email]
    assert message.subject == f'Your Wear Right order {order.order_code} is placed'
    assert 'Email Checkout Shirt' in message.body
    assert 'Rs 5000.00' in message.body
    assert '12 Mall Road' in message.body and 'Lahore' in message.body
    assert 'Cash on delivery' in message.body
    assert f'/orders/{order.id}' in message.body
    html, content_type = message.alternatives[0]
    assert content_type == 'text/html'
    assert 'Email Checkout Shirt' in html


def test_admin_status_change_sends_order_status(user, staff_client, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        _, order = order_for(user)
    mail.outbox.clear()

    with django_capture_on_commit_callbacks(execute=True):
        response = staff_client.patch(f'/api/orders/{order.id}/status/', {'order_status': 'Confirmed'}, format='json')

    assert response.status_code == 200
    assert len(mail.outbox) == 1
    message = mail.outbox[0]
    assert message.subject == f'Your Wear Right order {order.order_code} is now confirmed'
    assert 'Confirmed' in message.body
    assert f'/orders/{order.id}' in message.body


def test_customer_cancel_sends_order_status(user, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        client, order = order_for(user)
    mail.outbox.clear()

    with django_capture_on_commit_callbacks(execute=True):
        response = client.post(f'/api/orders/{order.id}/cancel/', {}, format='json')

    assert response.status_code == 200
    assert len(mail.outbox) == 1
    assert 'Cancelled' in mail.outbox[0].body
    assert f'/orders/{order.id}' in mail.outbox[0].body


def test_a_broken_mail_server_does_not_break_checkout(user, django_capture_on_commit_callbacks, monkeypatch):
    def explode(*args, **kwargs):
        raise ConnectionRefusedError('mailpit is down')

    monkeypatch.setattr(EmailMultiAlternatives, 'send', explode)
    client = APIClient()
    client.force_authenticate(user=user)
    product = ProductFactory(name='Still Works', stock_quantity=3)
    client.post('/api/cart/', {'product': product.id, 'size': 'M'}, format='json')

    with django_capture_on_commit_callbacks(execute=True):
        response = client.post('/api/checkout/', checkout_body(), format='json')

    assert response.status_code == 201
    assert Order.objects.count() == 1
    product.refresh_from_db()
    assert product.stock_quantity == 2
