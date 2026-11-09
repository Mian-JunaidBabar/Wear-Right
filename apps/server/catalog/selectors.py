from django.conf import settings
from django.db.models import Exists, OuterRef, Q

from .models import MannequinLayer, Product


def _on_mannequin():
    """True for a product with an approved layer on an active mannequin base."""
    return Exists(MannequinLayer.objects.filter(product=OuterRef('pk'), approved=True, base__is_active=True))


# Draft products (imported, not yet priced) and switched-off products are only visible to staff.
# With SHOP_MANNEQUIN_ONLY on (the demo), shoppers only see products that are on the mannequin.
def get_products(*, include_drafts=False):
    products = Product.objects.annotate(on_mannequin=_on_mannequin())
    if not include_drafts:
        products = products.filter(is_active=True).exclude(status='Draft')
        if getattr(settings, 'SHOP_MANNEQUIN_ONLY', False):
            products = products.filter(on_mannequin=True)
    return products.order_by('-id')

def get_product(product_id, *, include_drafts=False):
    products = Product.objects.all()
    if not include_drafts:
        products = products.filter(is_active=True).exclude(status='Draft')
    try:
        return products.get(id=product_id)
    except Product.DoesNotExist:
        return None


def filter_products(products, params):
    """Apply the public shop filters. Unknown values are ignored rather than raising, so a stale URL still works."""
    category = (params.get('category') or '').strip()
    if category:
        products = products.filter(Q(category__iexact=category) | Q(category_ref__slug__iexact=category))
    slot = (params.get('slot') or '').strip().lower()
    if slot:
        products = products.filter(slot=slot)
    gender = (params.get('gender') or '').strip().lower()
    if gender:
        products = products.filter(gender=gender)
    style = (params.get('style') or '').strip().lower()
    if style:
        products = products.filter(Q(style=style) | Q(cultural_tag__iexact=style))
    colour = (params.get('color') or '').strip()
    if colour:
        products = products.filter(
            Q(primary_color__name__iexact=colour) | Q(color_name__iexact=colour) | Q(color__iexact=colour)
        )
    for key, lookup in (('min_price', 'price__gte'), ('max_price', 'price__lte')):
        try:
            products = products.filter(**{lookup: params[key]})
        except (KeyError, TypeError, ValueError):
            pass
    if (params.get('mannequin') or '').strip().lower() in ('1', 'true', 'yes'):
        products = products.filter(on_mannequin=True) if 'on_mannequin' in products.query.annotations \
            else products.annotate(on_mannequin=_on_mannequin()).filter(on_mannequin=True)
    in_stock = (params.get('in_stock') or '').strip().lower()
    if in_stock in ('1', 'true', 'yes'):
        products = products.filter(stock_quantity__gt=0)
    search = (params.get('search') or params.get('q') or '').strip()
    if search:
        products = products.filter(
            Q(name__icontains=search) | Q(description__icontains=search) | Q(category__icontains=search)
            | Q(color_name__icontains=search) | Q(primary_color__name__icontains=search)
        )
    ordering = (params.get('ordering') or '-id').strip()
    allowed = {
        'price': 'price', '-price': '-price', 'name': 'name', '-name': '-name',
        'newest': '-created_at', '-created_at': '-created_at', 'oldest': 'created_at',
        '-id': '-id', 'id': 'id',
    }
    return products.order_by(allowed.get(ordering, '-id'))


def get_categories(*, include_inactive=False):
    """Categories with how many shoppable products each holds, and a cover photo from one of them."""
    from django.db.models import Count
    from .models import Category

    shoppable = Product.objects.filter(status='Active', stock_quantity__gt=0, is_active=True)
    if getattr(settings, 'SHOP_MANNEQUIN_ONLY', False):
        shoppable = shoppable.annotate(on_mannequin=_on_mannequin()).filter(on_mannequin=True)
    counts = dict(shoppable.values_list('category').annotate(n=Count('id')))
    covers = {}
    for product in shoppable.order_by('-mannequin_ready', '-id'):
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


def get_colors():
    from .models import Color
    return Color.objects.all()
