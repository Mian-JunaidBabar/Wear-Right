"""Mannequin (alpha) reads: the wardrobe the dressing room shows (base photos + approved layers by slot)."""
from .engine.alpha_layers import ACCESSORY_SLOTS, SLOT_LABELS, SLOTS, Z_ORDER
from .models import MannequinBase, MannequinLayer, Product

SKINS = ("wheatish", "fair", "dark")
GROUPS = (
    ("clothes", "Clothes", ("top", "kurta", "outerwear", "bottom")),
    ("shoes", "Shoes", ("shoes",)),
    ("accessories", "Accessories", ACCESSORY_SLOTS),
)


def _url(field):
    return field.url if field else None


def _thumbnail(product):
    if getattr(product, "mannequin_ready", False) and getattr(product, "mannequin_image", None):
        return product.mannequin_image.url
    return _url(product.image)


def _is_available(product):
    return bool(product.is_active and product.status not in ('Draft', 'Inactive'))


def _item(layer):
    product = layer.product
    wheatish = layer.image.url
    return {
        "product_id": product.id,
        "name": product.name,
        "price": float(product.price or 0),
        "image": _thumbnail(product),
        "layer": wheatish,
        # Fair / dark copies fall back to the wheatish cut when the team had none or it failed the checks.
        "layers": {"wheatish": wheatish, "fair": _url(layer.image_fair) or wheatish, "dark": _url(layer.image_dark) or wheatish},
        "category": product.category,
        "color": product.color or "",
        "sizes": list(product.sizes or []),
        "stock_quantity": product.stock_quantity,
        "status": product.status,
        "available": _is_available(product),
        "in_stock": _is_available(product) and product.status != 'Out of Stock' and product.stock_quantity > 0,
    }


def get_alpha_wardrobe(*, gender='men'):
    """The active base for a gender and its approved layers grouped by slot. Empty when nothing is imported.

    Products hidden from shoppers (Draft or inactive) are still listed so the dressing room works on the
    demo data, with `available: false` so the page does not link them or offer them for the cart.
    """
    base = MannequinBase.objects.filter(gender=gender, is_active=True).first()
    if base is None:
        return {"gender": gender, "base": None, "z_order": Z_ORDER, "slots": [], "groups": [], "exclusive": []}
    layers = (
        MannequinLayer.objects.filter(base=base, approved=True)
        .select_related('product')
        .order_by('slot', 'product__name', 'id')
    )
    by_slot = {slot: [] for slot in SLOTS}
    for layer in layers:
        by_slot[layer.slot].append(_item(layer))
    present = [slot for slot in SLOTS if by_slot[slot]]
    image = base.image.url
    return {
        "gender": gender,
        "base": {
            "image": image,
            "skins": {"wheatish": image, "fair": _url(base.image_fair), "dark": _url(base.image_dark)},
            "base_top": _url(base.base_top),
            "base_bottom": _url(base.base_bottom),
            "width": base.width,
            "height": base.height,
            "label": base.label,
        },
        "z_order": Z_ORDER,
        "slots": [
            {"slot": slot, "label": SLOT_LABELS[slot], "accessory": slot in ACCESSORY_SLOTS, "items": by_slot[slot]}
            for slot in present
        ],
        "groups": [
            {"key": key, "label": label, "slots": [slot for slot in slots if slot in present]}
            for key, label, slots in GROUPS if any(slot in present for slot in slots)
        ],
        # Only one of these can be worn at a time: a kurta replaces the shirt and the other way round.
        "exclusive": [["top", "kurta"]],
    }


def mannequin_product_ids(*, gender=None):
    """Ids of products with an approved mannequin layer (optionally only on one gender's base)."""
    layers = MannequinLayer.objects.filter(approved=True, base__is_active=True)
    if gender:
        layers = layers.filter(base__gender=gender)
    return set(layers.values_list('product_id', flat=True))


def products_on_mannequin():
    return Product.objects.filter(mannequin_layers__approved=True, mannequin_layers__base__is_active=True).distinct()


def get_staff_layers(*, gender=None):
    """Every layer (approved or not) with its checks, for the admin Mannequin page."""
    layers = MannequinLayer.objects.select_related('product', 'base').order_by('base__gender', 'slot', 'product__name')
    if gender:
        layers = layers.filter(base__gender=gender)
    rows = []
    for layer in layers:
        report = layer.report or {}
        rows.append({
            "id": layer.id,
            "gender": layer.base.gender,
            "slot": layer.slot,
            "slot_label": SLOT_LABELS.get(layer.slot, layer.slot),
            "product_id": layer.product_id,
            "product_name": layer.product.name,
            "approved": layer.approved,
            "note": layer.note,
            "layer": layer.image.url,
            "layer_fair": _url(layer.image_fair),
            "layer_dark": _url(layer.image_dark),
            "skins": report.get("skins", {}),
            "ecc": report.get("ecc"),
            "updated_at": layer.updated_at,
        })
    bases = {
        base.gender: {"image": base.image.url, "fair": _url(base.image_fair), "dark": _url(base.image_dark)}
        for base in MannequinBase.objects.filter(is_active=True)
    }
    return {"bases": bases, "layers": rows, "slots": [{"value": slot, "label": SLOT_LABELS[slot]} for slot in SLOTS]}
