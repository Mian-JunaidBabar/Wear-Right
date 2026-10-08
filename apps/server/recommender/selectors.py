from catalog.models import Product

def get_curated_recommendations(target_tone, target_culture):
    return Product.objects.filter(
        compatible_skin_tone=target_tone,
        cultural_tag=target_culture,
        status='Active'
    )[:15]

def get_matching_products(main_product):
    return Product.objects.filter(
        compatible_skin_tone=main_product.compatible_skin_tone,
        cultural_tag=main_product.cultural_tag,
        status='Active'
    ).exclude(id=main_product.id)


def get_palette_rules(depth, undertone):
    """{colour name: score} for a depth and undertone. An unknown undertone is treated as neutral."""
    from .models import ToneColorRule
    if not depth:
        return {}
    rows = ToneColorRule.objects.filter(depth=depth, undertone=undertone or 'neutral')
    return {row.color_name: row.score for row in rows}


def get_shoppable_products():
    """Products a shopper could buy now: active and in stock (drafts and out-of-stock items are left out)."""
    return Product.objects.filter(status='Active', stock_quantity__gt=0)
