from .models import Product
def get_products():
    return Product.objects.all().order_by('-id')
def get_product(product_id):
    try:
        return Product.objects.get(id=product_id)
    except Product.DoesNotExist:
        return None
