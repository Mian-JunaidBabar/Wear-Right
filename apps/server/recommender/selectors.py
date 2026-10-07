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
