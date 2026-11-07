"""Mannequin (alpha) reads: the wardrobe the dressing room shows (base photo + approved layers by slot)."""
from .engine.alpha_layers import SLOT_LABELS, SLOTS, Z_ORDER
from .models import MannequinBase, MannequinLayer


def _url(field):
    return field.url if field else None


def _thumbnail(product):
    if product.mannequin_ready and product.mannequin_image:
        return product.mannequin_image.url
    return _url(product.image)


def get_alpha_wardrobe(*, gender='men'):
    """The active base for a gender and its approved layers grouped by slot. Empty when nothing is imported.

    Products hidden from shoppers (Draft or inactive) are still listed so the dressing room works on the
    demo data, with `available: false` so the page does not link them to a product page that would 404.
    """
    base = MannequinBase.objects.filter(gender=gender, is_active=True).first()
    if base is None:
        return {"gender": gender, "base": None, "z_order": Z_ORDER, "slots": []}
    layers = (
        MannequinLayer.objects.filter(base=base, approved=True)
        .select_related('product')
        .order_by('slot', 'product__name', 'id')
    )
    by_slot = {slot: [] for slot in SLOTS}
    for layer in layers:
        product = layer.product
        by_slot[layer.slot].append({
            "product_id": product.id,
            "name": product.name,
            "price": float(product.price or 0),
            "image": _thumbnail(product),
            "layer": layer.image.url,
            "available": bool(product.is_active and product.status not in ('Draft', 'Inactive')),
        })
    return {
        "gender": gender,
        "base": {
            "image": base.image.url,
            "base_top": _url(base.base_top),
            "base_bottom": _url(base.base_bottom),
            "width": base.width,
            "height": base.height,
            "label": base.label,
        },
        "z_order": Z_ORDER,
        "slots": [
            {"slot": slot, "label": SLOT_LABELS[slot], "items": by_slot[slot]}
            for slot in SLOTS if by_slot[slot]
        ],
    }
