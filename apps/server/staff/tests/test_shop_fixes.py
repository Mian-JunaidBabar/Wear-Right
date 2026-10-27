"""Shop workflow fixes that came out of the admin review."""
import pytest
from rest_framework.test import APIClient

from core.tests.factories import BookingFactory, OrderFactory, ProductFactory, UserFactory
from orders.models import Order
from orders.services import add_cart_item, checkout

pytestmark = pytest.mark.django_db


def test_editing_size_stock_updates_offered_sizes_and_total(staff_client):
    product = ProductFactory(size_s_stock=0, size_m_stock=3, sizes=['M'], stock_quantity=3)
    r = staff_client.put(f'/api/products/{product.id}/', {'size_s_stock': 4, 'size_m_stock': 0}, format='json')
    assert r.status_code == 200
    body = r.json()['product']
    assert body['sizes'] == ['S']
    assert body['stock_quantity'] == 4


def test_products_without_size_stock_keep_their_total(staff_client):
    product = ProductFactory(stock_quantity=9)
    r = staff_client.put(f'/api/products/{product.id}/', {'size_s_stock': 0, 'name': 'Watch'}, format='json')
    assert r.json()['product']['stock_quantity'] == 9


def test_cancelled_orders_are_not_revenue(staff_client):
    OrderFactory(product=ProductFactory(price=1000, cost_price=400), quantity=1)
    cancelled = OrderFactory(product=ProductFactory(price=5000, cost_price=1000), quantity=1)
    Order.objects.filter(id=cancelled.id).update(order_status='Cancelled')
    stats = staff_client.get('/api/admin/dashboard/').json()['dashboard']
    assert float(stats['monthly_revenue']) == 1000
    assert float(stats['monthly_profit']) == 600
    assert 'All' in stats['skin_tone_counts']


def test_customer_cannot_create_a_confirmed_booking():
    user = UserFactory()
    client = APIClient()
    client.force_authenticate(user)
    r = client.post('/api/bookings/', {
        'customer_name': 'A', 'booking_type': 'Styling Consultation',
        'booking_date': '2030-01-01T10:00:00Z', 'status': 'Confirmed',
    }, format='json')
    assert r.status_code == 201
    assert r.json()['booking']['status'] == 'Pending'


def test_orders_expose_product_name():
    order = OrderFactory()
    client = APIClient()
    client.force_authenticate(UserFactory(is_staff=True))
    r = client.get(f'/api/orders/{order.id}/')
    assert r.json()['order']['product_name'] == order.product.name


def test_admin_deleting_an_open_order_puts_stock_back(staff_client):
    user = UserFactory()
    product = ProductFactory(size_m_stock=5, sizes=['M'], stock_quantity=5)
    add_cart_item(user, product_id=product.id, size='M', quantity=2)
    order, error = checkout(user, {'customer_name': 'A', 'customer_phone': '1', 'customer_address': 'x'})
    assert error is None
    product.refresh_from_db()
    assert product.size_m_stock == 3
    assert staff_client.delete(f'/api/admin/orders/{order.id}/').status_code == 200
    product.refresh_from_db()
    assert product.size_m_stock == 5 and product.stock_quantity == 5
