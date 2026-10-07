def create_order(serializer):
    product = serializer.validated_data.get('product')
    quantity = serializer.validated_data.get('quantity', 1)

    if quantity <= 0:
        return None, "Quantity must be greater than 0"
    if product.status != 'Active':
        return None, "This product is not available for order"
    if product.stock_quantity < quantity:
        return None, f"Only {product.stock_quantity} item(s) available in stock"

    order = serializer.save()
    product.stock_quantity -= quantity
    if product.stock_quantity == 0:
        product.status = 'Out of Stock'
    product.save()

    return order, None

def update_order(serializer):
    return serializer.save()

def delete_order(order):
    order.delete()

def create_booking(serializer):
    return serializer.save()

def update_booking(serializer):
    return serializer.save()

def delete_booking(booking):
    booking.delete()
