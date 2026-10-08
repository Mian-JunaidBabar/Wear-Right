"""The starting categories and styles. They are database rows (Category, Style) that staff can add to, rename
or switch off; this module only provides the first set, for the migration and `seed_taxonomy`."""

# (name, gender, group, tile image or "")  gender: men | women | unisex.  group "Regional" marks eastern and regional wear.
DEFAULT_CATEGORIES = [
    # Men
    ("Men Shirt", "men", "", "/category-images/men-shirt.jpg"),
    ("Men Pant", "men", "", "/category-images/men-pant.jpg"),
    ("Men Shoes", "men", "", "/category-images/men-shoes.jpg"),
    ("Men Cap", "men", "", "/category-images/men-cap.jpg"),
    ("Men Shalwar Kameez", "men", "Regional", "/category-images/men-shalwar-kameez.jpg"),
    ("Men Sandals", "men", "Regional", "/category-images/men-sandals.jpg"),
    ("Men Waistcoat", "men", "Regional", ""),
    ("Men Outerwear", "men", "", ""),
    ("Men Accessory", "men", "", ""),
    # Women
    ("Women Shirt", "women", "", "/category-images/women-shirt.jpg"),
    ("Women Pant", "women", "", "/category-images/women-pant.jpg"),
    ("Women Skirt", "women", "", ""),
    ("Women Footwear", "women", "", "/category-images/women-footwear.jpg"),
    ("Women Kurta", "women", "Regional", "/category-images/women-kurta.jpg"),
    ("Women Shalwar Kameez", "women", "Regional", "/category-images/women-shalwar-kameez.jpg"),
    ("Women Shalwar", "women", "Regional", ""),
    ("Women Dupatta", "women", "Regional", ""),
    ("Women Outerwear", "women", "", ""),
    ("Women Accessory", "women", "", ""),
    # Both
    ("Unisex Shirt", "unisex", "", ""),
    ("Unisex Pant", "unisex", "", ""),
    ("Unisex Shoes", "unisex", "", ""),
    ("Unisex Outerwear", "unisex", "", ""),
    ("Unisex Accessory", "unisex", "", ""),
    ("Watches", "unisex", "", ""),
    ("Sunglasses", "unisex", "", ""),
    ("Belts", "unisex", "", ""),
    ("Ties", "unisex", "", ""),
    ("Caps", "unisex", "", ""),
]

# (name, slug)
DEFAULT_STYLES = [("Eastern", "eastern"), ("Western", "western"), ("Casual", "casual"), ("Formal", "formal"), ("Regional", "regional")]


def seed_taxonomy(category_model, style_model):
    """Create the default rows that do not exist yet. Existing rows (maybe edited by staff) are left alone."""
    created = 0
    for order, (name, gender, group, image) in enumerate(DEFAULT_CATEGORIES, start=1):
        _, made = category_model.objects.get_or_create(
            name=name, defaults={"gender": gender, "group": group, "image": image, "sort_order": order * 10},
        )
        created += made
    for order, (name, slug) in enumerate(DEFAULT_STYLES, start=1):
        _, made = style_model.objects.get_or_create(name=name, defaults={"slug": slug, "sort_order": order * 10})
        created += made
    return created
