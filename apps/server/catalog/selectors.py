from .models import Product

# Draft products (imported, not yet priced) are only visible to staff.
def get_products(*, include_drafts=False):
    products = Product.objects.all()
    if not include_drafts:
        products = products.exclude(status='Draft')
    return products.order_by('-id')

def get_product(product_id, *, include_drafts=False):
    products = Product.objects.all()
    if not include_drafts:
        products = products.exclude(status='Draft')
    try:
        return products.get(id=product_id)
    except Product.DoesNotExist:
        return None
