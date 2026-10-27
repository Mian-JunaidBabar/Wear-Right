from django.db import migrations
from django.utils.text import slugify


def _unique_slug(model, name, pk, taken):
    base = slugify(name)[:100] or 'item'
    slug, suffix = base, 2
    while slug in taken:
        slug, suffix = f'{base}-{suffix}', suffix + 1
    taken.add(slug)
    return slug


def forwards(apps, schema_editor):
    Category = apps.get_model('catalog', 'Category')
    Product = apps.get_model('catalog', 'Product')
    Color = apps.get_model('catalog', 'Color')
    from catalog.taxonomy import SLOT_BY_CATEGORY
    from catalog.engine.families import family_of_hex

    taken = set()
    for row in Category.objects.all().order_by('id'):
        row.slug = _unique_slug(Category, row.name, row.pk, taken)
        if hasattr(row, 'slot') and not row.slot:
            row.slot = SLOT_BY_CATEGORY.get(row.name, '')
        row.save(update_fields=[f.name for f in row._meta.fields if f.name in ('slug', 'slot')])

    by_name = {row.name: row for row in Category.objects.all()}

    # Create the colours already used by products, then attach them.
    taken_colour = set()
    taken_products = set()
    for product in Product.objects.all().order_by('id'):
        name = (product.color_name or product.color or '').strip()
        if not name:
            continue
        hex_value = product.color_hex
        if not hex_value and product.color_palette:
            hex_value = product.color_palette[0].get('hex')
        hex_value = hex_value or '#000000'
        if name not in taken_colour:
            family = ''
            try:
                family = family_of_hex(hex_value)
            except Exception:
                pass
            Color.objects.get_or_create(name=name, defaults={'hex': hex_value, 'family': family})
            taken_colour.add(name)
        product.primary_color = Color.objects.filter(name=name).first()
        product.category_ref = by_name.get(product.category)
        product.slug = _unique_slug(Product, product.name, product.pk, taken_products)
        if not product.style:
            tag = (product.cultural_tag or '').lower()
            product.style = {'eastern': 'eastern', 'regional': 'eastern', 'formal': 'formal'}.get(tag, 'casual')
        if not product.sizes:
            pairs = [('S', product.size_s_stock), ('M', product.size_m_stock), ('L', product.size_l_stock),
                     ('XL', product.size_xl_stock), ('XXL', product.size_xxl_stock)]
            product.sizes = [size for size, quantity in pairs if quantity]
        product.save()


def backwards(apps, schema_editor):
    # The legacy columns are still present; clearing the new relations is enough.
    apps.get_model('catalog', 'Product').objects.update(category_ref=None, primary_color=None)


class Migration(migrations.Migration):
    dependencies = [('catalog', '0005_phase2_catalog_crud')]
    operations = [migrations.RunPython(forwards, backwards)]
