import uuid
from decimal import Decimal

from django.conf import settings
from django.db import transaction

from catalog.models import Product
from core.emails import send_email

from .models import Cart, CartItem, Order, OrderItem

# Customers cannot mark their own order paid or shipped; staff can set anything.
CUSTOMER_PAYMENT_STATUSES = ('Unpaid', 'Cash on Delivery')
CART_SIZES = ('S', 'M', 'L', 'XL', 'XXL')
PAYMENT_METHODS = ('cod', 'card_demo')
ALLOWED_TRANSITIONS = {
    'Pending': {'Confirmed', 'Cancelled'},
    'Confirmed': {'Shipped', 'Cancelled'},
    'Shipped': {'Delivered'},
    'Delivered': set(),
    'Cancelled': set(),
}


def size_stock(product, size):
    """Units available for a size. Products without per-size stock (accessories) use the total."""
    size = (size or 'M').upper()
    field = f'size_{size.lower()}_stock'
    sizes = [str(item).upper() for item in (product.sizes or [])]
    if size in sizes:
        return getattr(product, field, 0)
    if sizes:
        return 0
    return product.stock_quantity


def _size_allowed(product, size):
    available = [str(item).upper() for item in (product.sizes or [])]
    return (size or 'M').upper() in available or not available or size not in CART_SIZES


@transaction.atomic
def create_order(serializer, user):
    """Legacy single-product order endpoint, kept for the existing admin/API contract."""
    product_id = serializer.validated_data.get('product')
    quantity = serializer.validated_data.get('quantity', 1)
    if product_id is None:
        return None, 'A product is required'
    product = Product.objects.select_for_update().filter(id=getattr(product_id, 'id', product_id)).first()
    if product is None:
        return None, 'Product not found'
    if quantity <= 0:
        return None, 'Quantity must be greater than 0'
    if product.status != 'Active' or not product.is_active:
        return None, 'This product is not available for order'
    if product.stock_quantity < quantity:
        return None, f'Only {product.stock_quantity} item(s) available in stock'

    extra = {'user': user}
    if not user.is_staff:
        extra['order_status'] = 'Pending'
        if serializer.validated_data.get('payment_status') not in CUSTOMER_PAYMENT_STATUSES:
            extra['payment_status'] = 'Cash on Delivery'

    serializer.validated_data['product'] = product
    order = serializer.save(**extra)
    product.stock_quantity -= quantity
    if product.stock_quantity == 0:
        product.status = 'Out of Stock'
    product.save(update_fields=['stock_quantity', 'status', 'updated_at'])

    return order, None


def _order_reference(order):
    return order.order_code or f'#{order.id}'


def _order_email_context(order):
    return {
        'customer_name': order.customer_name,
        'order_code': _order_reference(order),
        'items': [
            {'name': item.name, 'size': item.size, 'quantity': item.quantity, 'line_total': item.line_total}
            for item in order.items.all()
        ],
        'total': f'{order.total_amount:.2f}',
        'address': order.customer_address or '',
        'city': order.city or '',
        'payment_method': order.get_payment_method_display(),
        'status': order.order_status,
        'order_url': f'{settings.FRONTEND_URL}/orders/{order.id}',
    }


def send_order_placed_email(order):
    """Tell the customer their checkout went through. Failures are swallowed by send_email."""
    return send_email(
        to=order.customer_email,
        subject=f'Your Wear Right order {_order_reference(order)} is placed',
        template='order_placed',
        context=_order_email_context(order),
    )


def send_order_status_email(order):
    """Tell the customer an order changed status (admin update or their cancellation)."""
    return send_email(
        to=order.customer_email,
        subject=f'Your Wear Right order {_order_reference(order)} is now {order.order_status.lower()}',
        template='order_status',
        context=_order_email_context(order),
    )


def update_order(serializer):
    return serializer.save()


def delete_order(order):
    order.delete()


# ---- cart ------------------------------------------------------------------------------------------------
def get_cart(user):
    cart, _ = Cart.objects.get_or_create(user=user)
    return cart


def cart_summary(cart):
    items = list(cart.items.select_related('product', 'product__primary_color'))
    subtotal = sum((item.product.price * item.quantity for item in items), Decimal('0'))
    return {'items': items, 'subtotal': subtotal, 'count': sum(item.quantity for item in items)}


@transaction.atomic
def add_cart_item(user, *, product_id, size='M', quantity=1):
    try:
        quantity = int(quantity)
    except (TypeError, ValueError):
        return None, 'Quantity must be a whole number.'
    if quantity < 1:
        return None, 'Quantity must be at least 1.'
    product = Product.objects.filter(id=product_id).first()
    if product is None:
        return None, 'Product not found.'
    if product.status != 'Active' or not product.is_active:
        return None, 'This product is not available.'
    size = (size or 'M').upper()
    if not _size_allowed(product, size):
        return None, f'Size {size} is not available for this product.'
    cart = get_cart(user)
    item = CartItem.objects.filter(cart=cart, product=product, size=size).first()
    new_quantity = (item.quantity if item else 0) + quantity
    if new_quantity > size_stock(product, size):
        return None, f'Only {size_stock(product, size)} item(s) available in size {size}.'
    if item:
        item.quantity = new_quantity
        item.save(update_fields=['quantity', 'updated_at'])
    else:
        item = CartItem.objects.create(cart=cart, product=product, size=size, quantity=quantity)
    return item, None


@transaction.atomic
def update_cart_item(user, item_id, *, quantity=None, size=None):
    item = CartItem.objects.select_related('product').filter(id=item_id, cart__user=user).first()
    if item is None:
        return None, 'Cart item not found.'
    if quantity is not None:
        try:
            quantity = int(quantity)
        except (TypeError, ValueError):
            return None, 'Quantity must be a whole number.'
        if quantity < 1:
            return None, 'Quantity must be at least 1.'
        if quantity > size_stock(item.product, item.size):
            return None, f'Only {size_stock(item.product, item.size)} item(s) available.'
        item.quantity = quantity
    if size is not None:
        size = size.upper()
        if not _size_allowed(item.product, size):
            return None, f'Size {size} is not available for this product.'
        item.size = size
    item.save()
    return item, None


def remove_cart_item(user, item_id):
    item = CartItem.objects.filter(id=item_id, cart__user=user).first()
    if item is None:
        return False
    item.delete()
    return True


@transaction.atomic
def merge_cart(user, rows):
    """Merge a guest's localStorage cart after login. Invalid rows are skipped and reported, not fatal."""
    merged, skipped = 0, []
    for row in rows or []:
        product_id = row.get('product') or row.get('product_id')
        item, error = add_cart_item(
            user, product_id=product_id, size=row.get('size') or 'M', quantity=row.get('quantity') or 1,
        )
        if error:
            skipped.append({'product': product_id, 'reason': error})
        else:
            merged += 1
    return merged, skipped


# ---- checkout ---------------------------------------------------------------------------------------------
@transaction.atomic
def checkout(user, data):
    cart = Cart.objects.select_for_update().filter(user=user).first()
    items = list(CartItem.objects.select_for_update().filter(cart=cart).select_related('product')) if cart else []
    if not items:
        return None, 'Your cart is empty.'

    product_ids = [item.product_id for item in items]
    locked = {p.id: p for p in Product.objects.select_for_update().filter(id__in=product_ids)}
    for item in items:
        product = locked.get(item.product_id)
        if product is None or product.status != 'Active' or not product.is_active:
            return None, f'{item.product.name} is no longer available.'
        if item.quantity > size_stock(product, item.size):
            return None, f'Only {size_stock(product, item.size)} item(s) of {product.name} in size {item.size} remain.'

    payment_method = data.get('payment_method') or 'cod'
    if payment_method not in PAYMENT_METHODS:
        return None, 'Choose cash on delivery or the demo card option.'
    for field in ('customer_name', 'customer_phone', 'customer_address'):
        if not str(data.get(field) or '').strip():
            return None, f'{field.replace("customer_", "").replace("_", " ").title()} is required.'

    total = sum((locked[item.product_id].price * item.quantity for item in items), Decimal('0'))
    order = Order.objects.create(
        user=user,
        order_code=f'WR-{uuid.uuid4().hex[:8].upper()}',
        customer_name=data['customer_name'],
        customer_email=data.get('customer_email') or user.email,
        customer_phone=data['customer_phone'],
        customer_address=data['customer_address'],
        city=data.get('city') or '',
        payment_method=payment_method,
        payment_status='Cash on Delivery' if payment_method == 'cod' else 'Unpaid',
        total_amount=total,
        profit_amount=sum(
            ((locked[item.product_id].price - locked[item.product_id].cost_price) * item.quantity for item in items),
            Decimal('0'),
        ),
        order_status='Pending',
    )
    for item in items:
        product = locked[item.product_id]
        OrderItem.objects.create(
            order=order, product=product, name=product.name, price=product.price,
            size=item.size, quantity=item.quantity, line_total=product.price * item.quantity,
        )
        product.stock_quantity = max(0, product.stock_quantity - item.quantity)
        if size_stock(product, item.size) >= 0 and item.size in CART_SIZES:
            field = f'size_{item.size.lower()}_stock'
            if hasattr(product, field):
                setattr(product, field, max(0, getattr(product, field) - item.quantity))
        if product.stock_quantity == 0:
            product.status = 'Out of Stock'
        product.save()
    cart.items.all().delete()
    transaction.on_commit(lambda: send_order_placed_email(order))
    return order, None


def cancel_order(order, user):
    """Cancel a pending/confirmed order and put its stock back. Owners and staff may cancel."""
    with transaction.atomic():
        order = Order.objects.select_for_update().get(id=order.id)
        if order.user_id != user.id and not user.is_staff:
            return None, 'Order not found.'
        if order.order_status not in ('Pending', 'Confirmed'):
            return None, f'A {order.order_status.lower()} order cannot be cancelled.'
        restored = []
        for item in order.items.select_related('product'):
            if item.product_id:
                product = Product.objects.select_for_update().get(id=item.product_id)
                product.stock_quantity += item.quantity
                if item.size in CART_SIZES:
                    field = f'size_{item.size.lower()}_stock'
                    if hasattr(product, field):
                        setattr(product, field, getattr(product, field) + item.quantity)
                if product.status == 'Out of Stock':
                    product.status = 'Active'
                product.save()
                restored.append(product.id)
        if order.product_id and order.product_id not in restored:
            product = Product.objects.select_for_update().get(id=order.product_id)
            product.stock_quantity += order.quantity
            product.save(update_fields=['stock_quantity', 'updated_at'])
        order.order_status = 'Cancelled'
        order.save(update_fields=['order_status', 'updated_at'])
        transaction.on_commit(lambda: send_order_status_email(order))
    return order, None


def change_order_status(order, new_status):
    if new_status not in ALLOWED_TRANSITIONS:
        return None, 'Unknown order status.'
    if new_status not in ALLOWED_TRANSITIONS.get(order.order_status, set()):
        return None, f'Cannot move an order from {order.order_status} to {new_status}.'
    order.order_status = new_status
    order.save(update_fields=['order_status', 'updated_at'])
    transaction.on_commit(lambda: send_order_status_email(order))
    return order, None


# ---- bookings ---------------------------------------------------------------------------------------------
def create_booking(serializer, user):
    # A customer asks for a booking; only staff decide whether it is confirmed.
    extra = {'user': user}
    if not user.is_staff:
        extra['status'] = 'Pending'
    return serializer.save(**extra)


def update_booking(serializer):
    return serializer.save()


def delete_booking(booking):
    booking.delete()
