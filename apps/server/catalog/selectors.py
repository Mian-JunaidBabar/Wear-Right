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


def get_categories(*, include_inactive=False):
    """Categories with how many shoppable products each holds, and a cover photo from one of them."""
    from django.db.models import Count
    from .models import Category

    counts = dict(
        Product.objects.filter(status='Active', stock_quantity__gt=0).values_list('category').annotate(n=Count('id'))
    )
    covers = {}
    for product in Product.objects.filter(status='Active', stock_quantity__gt=0).order_by('-mannequin_ready', '-id'):
        if product.category not in covers:
            photo = product.mannequin_image or product.image
            covers[product.category] = photo.url if photo else None
    categories = Category.objects.all() if include_inactive else Category.objects.filter(is_active=True)
    rows = list(categories)
    for row in rows:
        row.product_count = counts.get(row.name, 0)
        row.cover = covers.get(row.name)
    return rows


def get_styles(*, include_inactive=False):
    from .models import Style
    return Style.objects.all() if include_inactive else Style.objects.filter(is_active=True)
