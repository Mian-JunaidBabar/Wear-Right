from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from catalog.models import Product
from core.tests.factories import ProductFactory, UserFactory
from orders.models import CartItem, Order

pytestmark = pytest.mark.django_db


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def checkout_body(**overrides):
    body = {
        'customer_name': 'Ayesha Khan', 'customer_phone': '03001234567',
        'customer_address': '12 Mall Road', 'city': 'Lahore', 'payment_method': 'cod',
    }
    body.update(overrides)
    return body


def test_cart_add_update_remove_and_merge(user):
    client = client_for(user)
    product = ProductFactory(name='Cart Shirt', stock_quantity=8)
    response = client.post('/api/cart/', {'product': product.id, 'size': 'M', 'quantity': 2}, format='json')
    assert response.status_code == 201
    assert response.json()['count'] == 2 and response.json()['subtotal'] == 4000
    item_id = response.json()['item_id']

    assert client.patch(f'/api/cart/items/{item_id}/', {'quantity': 3}, format='json').json()['count'] == 3
    assert client.delete(f'/api/cart/items/{item_id}/').status_code == 200
    assert client.get('/api/cart/').json()['cart']['items'] == []

    merged = client.post('/api/cart/merge/', {'items': [
        {'product': product.id, 'size': 'M', 'quantity': 1},
        {'product': product.id, 'size': 'M', 'quantity': 2},
        {'product': 999999, 'size': 'M', 'quantity': 1},
    ]}, format='json')
    assert merged.status_code == 200
    assert merged.json()['merged'] == 2 and len(merged.json()['skipped']) == 1
    assert merged.json()['count'] == 3


def test_cart_rejects_unknown_sizes_and_more_than_stock(user):
    client = client_for(user)
    product = ProductFactory(name='Sized Shirt', stock_quantity=3, size_m_stock=3, size_l_stock=0, sizes=['M'])

    assert client.post('/api/cart/', {'product': product.id, 'size': 'XL'}, format='json').status_code == 400
    assert client.post('/api/cart/', {'product': product.id, 'size': 'M', 'quantity': 4}, format='json').status_code == 400
    assert client.post('/api/cart/', {'product': product.id, 'size': 'M', 'quantity': 3}, format='json').status_code == 201


def test_checkout_is_one_transaction_with_snapshots_and_stock_decrement(user):
    client = client_for(user)
    first = ProductFactory(name='Checkout Shirt', price=2500, cost_price=1000, stock_quantity=5)
    second = ProductFactory(name='Checkout Shoes', price=4000, cost_price=2000, stock_quantity=2, slot='footwear')

    client.post('/api/cart/', {'product': first.id, 'size': 'M', 'quantity': 2}, format='json')
    client.post('/api/cart/', {'product': second.id, 'size': 'M', 'quantity': 1}, format='json')

    response = client.post('/api/checkout/', checkout_body(), format='json')
    assert response.status_code == 201
    order = Order.objects.get(id=response.json()['order']['id'])
    assert order.total_amount == Decimal('9000') and order.profit_amount == Decimal('5000')
    assert order.items.count() == 2 and order.items.get(name='Checkout Shirt').price == Decimal('2500')
    assert order.payment_method == 'cod' and order.order_status == 'Pending'
    assert CartItem.objects.filter(cart__user=user).count() == 0
    first.refresh_from_db(); second.refresh_from_db()
    assert first.stock_quantity == 3 and second.stock_quantity == 1


def test_checkout_fails_cleanly_when_stock_changed(user):
    client = client_for(user)
    product = ProductFactory(name='Almost Gone', stock_quantity=5)
    client.post('/api/cart/', {'product': product.id, 'size': 'M', 'quantity': 2}, format='json')
    Product.objects.filter(id=product.id).update(stock_quantity=1)

    response = client.post('/api/checkout/', checkout_body(), format='json')
    assert response.status_code == 400 and 'Only 1' in response.json()['message']
    assert Order.objects.count() == 0
    assert CartItem.objects.filter(cart__user=user).count() == 1
    product.refresh_from_db()
    assert product.stock_quantity == 1


def test_card_demo_never_accepts_card_numbers(user):
    client = client_for(user)
    product = ProductFactory(stock_quantity=2)
    client.post('/api/cart/', {'product': product.id, 'size': 'M'}, format='json')
    response = client.post('/api/checkout/', checkout_body(
        payment_method='card_demo', card_number='4242424242424242', cvv='123',
    ), format='json')
    assert response.status_code == 400
    assert 'card numbers' in str(response.json()).lower()


def test_order_detail_is_owner_only_and_status_transitions_are_checked(user, staff_client):
    owner = client_for(user)
    other = client_for(UserFactory())
    product = ProductFactory(name='Owner Product', stock_quantity=5)
    owner.post('/api/cart/', {'product': product.id, 'size': 'M'}, format='json')
    order = Order.objects.get(id=owner.post('/api/checkout/', checkout_body(), format='json').json()['order']['id'])

    assert owner.get(f'/api/orders/{order.id}/').status_code == 200
    assert other.get(f'/api/orders/{order.id}/').status_code == 404
    assert other.post(f'/api/orders/{order.id}/cancel/', {}, format='json').status_code == 404

    url = f'/api/orders/{order.id}/status/'
    assert staff_client.patch(url, {'order_status': 'Shipped'}, format='json').status_code == 400
    assert staff_client.patch(url, {'order_status': 'Confirmed'}, format='json').json()['order']['order_status'] == 'Confirmed'
    assert staff_client.patch(url, {'order_status': 'Shipped'}, format='json').status_code == 200
    assert staff_client.patch(url, {'order_status': 'Delivered'}, format='json').status_code == 200
    assert staff_client.patch(url, {'order_status': 'Cancelled'}, format='json').status_code == 400


def test_cancel_restores_stock_and_only_works_before_shipping(user):
    client = client_for(user)
    product = ProductFactory(name='Cancel Product', stock_quantity=4)
    client.post('/api/cart/', {'product': product.id, 'size': 'M', 'quantity': 2}, format='json')
    order = Order.objects.get(id=client.post('/api/checkout/', checkout_body(), format='json').json()['order']['id'])
    product.refresh_from_db()
    assert product.stock_quantity == 2

    response = client.post(f'/api/orders/{order.id}/cancel/', {}, format='json')
    assert response.status_code == 200 and response.json()['order']['order_status'] == 'Cancelled'
    product.refresh_from_db()
    assert product.stock_quantity == 4
    assert client.post(f'/api/orders/{order.id}/cancel/', {}, format='json').status_code == 400


def test_orders_list_keeps_owner_and_staff_scoping(user, staff_client):
    owner = client_for(user)
    other = client_for(UserFactory())
    product = ProductFactory(stock_quantity=10)
    owner.post('/api/cart/', {'product': product.id, 'size': 'M'}, format='json')
    owner.post('/api/checkout/', checkout_body(), format='json')

    assert owner.get('/api/orders/').json()['total_orders'] == 1
    assert other.get('/api/orders/').json()['total_orders'] == 0
    assert staff_client.get('/api/orders/').json()['total_orders'] == 1
    assert staff_client.get('/api/orders/').json()['orders'][0]['items'][0]['name'] == product.name
