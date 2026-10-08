import io

from django.core.files.base import ContentFile
from django.db import transaction

from .engine.color import palette_from_image
from .engine.cutout import cut_out
from .engine.kaggle import product_fields
from .models import Product


def create_product(serializer):
    return serializer.save()
def update_product(serializer):
    return serializer.save()
def delete_product(product):
    product.delete()


def _png_bytes(image):
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def import_style_record(*, record, source_image, remover):
    """Create one Draft product from a Kaggle record: background removed, colours extracted."""
    cutout = cut_out(source_image, remover)
    palette = palette_from_image(cutout)
    with transaction.atomic():
        product = Product(**product_fields(record, palette))
        product.image.save(f"{record.image_id}.png", ContentFile(_png_bytes(cutout)), save=False)
        product.save()
    return product


def apply_image_pipeline(product, *, source_image, remover):
    """Replace a product's photo with its cut-out and fill in the colour fields from it.

    An existing colour_name is kept, since an admin may have set it. The original photo file stays on disk.
    """
    cutout = cut_out(source_image, remover)
    palette = palette_from_image(cutout)
    product.image.save(f"{product.pk}-cutout.png", ContentFile(_png_bytes(cutout)), save=False)
    product.color_palette = palette
    product.color_hex = palette[0]["hex"] if palette else None
    if palette and not product.color_name:
        product.color_name = palette[0]["name"]
    product.save(update_fields=["image", "color_palette", "color_hex", "color_name", "updated_at"])
    return product


def prepare_mannequin_asset(product, *, source_image, detector=None, cloth=None):
    """Save the garment-only crop for the mannequin and record whether the photo can be placed on it.

    Clean flat-lay photos keep their cut-out. When a person is in the photo (face, skin, or clothing in the
    other body layer) and a cloth model is given, the garment is cut out of the person instead.
    """
    from .engine.mannequin import (
        MIN_GARMENT_SHARE, GARMENT_LAYERS, LEAK_SHARE, NOTE_EXTRACTED, REASON_NO_SPLIT,
        assess, clean_cutout, content_share, extract_garment, flatten_on_white, split_layers, trim_to_content,
    )

    slot = product.slot or ""
    ready, note = assess(source_image, detector, slot)
    garment = clean_cutout(source_image)
    if cloth is not None and slot in GARMENT_LAYERS:
        extracted, leak = extract_garment(slot, split_layers(cloth(flatten_on_white(source_image))))
        if not ready or leak >= LEAK_SHARE:
            if content_share(extracted) >= MIN_GARMENT_SHARE:
                garment, ready, note = extracted, True, NOTE_EXTRACTED
            else:
                ready, note = False, REASON_NO_SPLIT
    product.mannequin_image.save(f"{product.pk}.png", ContentFile(_png_bytes(trim_to_content(garment))), save=False)
    product.mannequin_ready = ready
    product.mannequin_note = note
    product.save(update_fields=["mannequin_image", "mannequin_ready", "mannequin_note", "updated_at"])
    return product
