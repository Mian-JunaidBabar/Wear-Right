"""Turns catalog Products into the engine's plain Items, filling gaps for products that were never tagged."""
from .engine.items import Item, Profile

SIZE_FIELDS = {'S': 'size_s_stock', 'M': 'size_m_stock', 'L': 'size_l_stock', 'XL': 'size_xl_stock', 'XXL': 'size_xxl_stock'}
GARMENT_TO_SLOT = {'Top': 'top', 'Bottom': 'bottom', 'Footwear': 'footwear', 'Accessory': 'accessory'}
SIZED_SLOTS = {'top', 'outerwear', 'kurta'}
STYLE_FORMALITY = {'Formal': 4, 'Eastern': 3, 'Western': 2, 'Casual': 2}


def infer_slot(product):
    if product.slot:
        return product.slot
    category = (product.category or '').lower()
    for word, slot in (('kurta', 'kurta'), ('kameez', 'kurta'), ('dupatta', 'dupatta'), ('outerwear', 'outerwear')):
        if word in category:
            return slot
    return GARMENT_TO_SLOT.get(product.garment_type or '', '')


def infer_gender(product):
    if product.gender:
        return product.gender
    category = (product.category or '').lower()
    return 'women' if category.startswith('women') else 'men' if category.startswith('men') else ''


def size_in_stock(product, slot, size):
    """In stock in the shopper's size. Without a size, or without per-size counts, any stock will do."""
    if product.stock_quantity <= 0:
        return False
    field = SIZE_FIELDS.get((size or '').upper())
    if slot not in SIZED_SLOTS or not field:
        return True
    per_size = [getattr(product, name) for name in SIZE_FIELDS.values()]
    return getattr(product, field) > 0 if any(per_size) else True


def product_to_item(product, size=''):
    slot = infer_slot(product)
    styles = tuple(product.style_tags or ([product.cultural_tag] if product.cultural_tag else []))
    return Item(
        id=product.id, name=product.name, slot=slot, gender=infer_gender(product),
        formality=product.formality or STYLE_FORMALITY.get(product.cultural_tag, 0),
        styles=styles, color_hex=product.color_hex or '', color_name=product.color_name or product.color or '',
        category=product.category or '', size_ok=size_in_stock(product, slot, size),
    )


def build_profile(user, params):
    """Shopper profile: request parameters win, then the signed-in user's saved profile."""
    saved = getattr(user, 'userprofile', None) if user is not None and user.is_authenticated else None
    gender = params.get('gender') or {'male': 'men', 'female': 'women'}.get(getattr(saved, 'gender', ''), '')
    if params.get('style'):
        styles = tuple(s.strip() for s in params['style'].split(',') if s.strip())
    elif saved is not None:
        styles = tuple(s for s in (
            saved.preferred_style if saved.preferred_style not in ('mixed', '') else '',
            'eastern' if saved.cultural_preference == 'Eastern' else '',
        ) if s)
    else:
        styles = ()
    return Profile(
        depth=(params.get('depth') or getattr(saved, 'skin_tone', '') or '').capitalize(),
        undertone=(params.get('undertone') or getattr(saved, 'undertone', '') or '').lower(),
        gender=gender, styles=styles,
        favourite_colours=tuple(getattr(saved, 'favorite_colors', None) or ()),
        avoided_colours=tuple(getattr(saved, 'avoided_colors', None) or ()),
    )
