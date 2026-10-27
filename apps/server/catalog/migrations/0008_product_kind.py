"""Adds Product.kind (what the garment actually is) and fills it from the product words.

The complete-look engine needs to know that a shirt covers the "top" slot and that a kurta is a
one-piece, so inference previously fell through to the coarse legacy `garment_type` (the "Heavy
Shirt" mislabelled as an Accessory filled a look's top slot with a kids' tee). Words are the only
source the imports give us, so the backfill guesses from name + category through the same pure
`catalog.engine.kinds` rules the serializer uses on writes.
"""
from django.db import migrations, models

from catalog.engine.kinds import KINDS, infer_kind, slot_of_kind


def fill_kind_and_slot(apps, schema_editor):
    Product = apps.get_model('catalog', 'Product')
    for product in Product.objects.all().iterator():
        changed = []
        kind = infer_kind(product.name, product.category, product.garment_type or '', product.slot or '')
        if kind and product.kind != kind:
            product.kind = kind
            changed.append('kind')
        if not product.slot:
            slot = slot_of_kind(kind)
            if not slot and product.category_ref_id:
                category_slot = product.category_ref.slot
                slot = 'kurta' if category_slot == 'fullbody' else category_slot
            if slot:
                product.slot = slot
                changed.append('slot')
        if not product.gender:
            category_row = product.category_ref
            gender = getattr(category_row, 'gender', '') if category_row else ''
            if gender:
                product.gender = gender
                changed.append('gender')
        if changed:
            product.save(update_fields=changed)


def drop_kind(apps, schema_editor):
    Product = apps.get_model('catalog', 'Product')
    Product.objects.update(kind=None)


class Migration(migrations.Migration):
    dependencies = [('catalog', '0007_phase2_slug_unique')]

    operations = [
        migrations.AddField(
            model_name='product',
            name='kind',
            field=models.CharField(
                blank=True, choices=[(kind, kind) for kind in KINDS],
                max_length=40, null=True,
            ),
        ),
        migrations.RunPython(fill_kind_and_slot, drop_kind),
    ]
