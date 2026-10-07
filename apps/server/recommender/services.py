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
