from .selectors import get_matching_products

def generate_outfit_for_product(main_product):
    matching_products = get_matching_products(main_product)

    shirt = matching_products.filter(category__icontains='shirt').first()
    pant = matching_products.filter(category__icontains='pant').first()
    shoes = matching_products.filter(category__icontains='shoe').first() \
        or matching_products.filter(category__icontains='sandal').first() \
        or matching_products.filter(category__icontains='chappal').first()

    accessory = matching_products.filter(category__icontains='accessory').first() \
        or matching_products.filter(category__icontains='watch').first() \
        or matching_products.filter(category__icontains='cap').first() \
        or matching_products.filter(category__icontains='tie').first()

    coat_or_jacket = matching_products.filter(category__icontains='coat').first() \
        or matching_products.filter(category__icontains='jacket').first() \
        or matching_products.filter(category__icontains='waistcoat').first()

    return {
        "shirt": shirt,
        "pant": pant,
        "shoes": shoes,
        "accessory": accessory,
        "coat_or_jacket": coat_or_jacket
    }


# ---- phase 4: tone rules, top picks, complete the look -------------------------------------------------

from catalog.engine.color import REFERENCE_COLORS

from .adapter import build_profile, product_to_item
from .engine.default_rules import build_default_rules
from .engine.looks import complete_look
from .engine.palette import Palette
from .engine.ranker import DEFAULT_LIMIT, rank
from .models import ToneColorRule
from .selectors import get_palette_rules, get_shoppable_products


def seed_default_rules():
    """Create the starting tone rules that do not exist yet. Existing rules (maybe edited by staff) are kept."""
    created = 0
    for depth, undertone, colour, score in build_default_rules([name for name, _ in REFERENCE_COLORS]):
        _, was_created = ToneColorRule.objects.get_or_create(
            depth=depth, undertone=undertone, color_name=colour, defaults={'score': score},
        )
        created += was_created
    return created


def palette_for(profile):
    return Palette(get_palette_rules(profile.depth, profile.undertone))


def top_picks(user, params, limit=DEFAULT_LIMIT):
    """(profile, palette, ranked results) for the shopper described by the request and their saved profile."""
    profile = build_profile(user, params)
    palette = palette_for(profile)
    products = {p.id: p for p in get_shoppable_products()}
    size = params.get('size') or getattr(getattr(user, 'userprofile', None), 'top_size', '') or ''
    items = [product_to_item(p, size) for p in products.values()]
    results = rank(items, profile, palette, limit=limit)
    for row in results:
        row['product'] = products[row['item'].id]
    return profile, palette, results


def build_look(user, params, product):
    """(profile, palette, look) around one product. Slot picks and swaps carry their Product."""
    profile = build_profile(user, params)
    palette = palette_for(profile)
    products = {p.id: p for p in get_shoppable_products()}
    products[product.id] = product
    size = params.get('size') or getattr(getattr(user, 'userprofile', None), 'top_size', '') or ''
    items = [product_to_item(p, size) for p in products.values()]
    look = complete_look(product_to_item(product, size), items, palette, gender=profile.gender)
    for slot in look['slots']:
        for entry in ([slot['pick']] if slot['pick'] else []) + slot['swaps']:
            entry['product'] = products[entry['item'].id]
    return profile, palette, look
