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
