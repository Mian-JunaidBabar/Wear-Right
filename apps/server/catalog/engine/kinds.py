"""Garment kinds: what a product actually is (t-shirt, jeans, kurta, sandals...), guessed from words.

Pure Python — no Django imports — so the data migration, the serializer and the tests can all use
it. This replaces `garment_type` (Top/Bottom/Footwear/Accessory), which was too coarse to power
the look engine: only knowing that a product is a shirt lets the engine skip the "top" slot or
treat a kurta as an eastern one-piece instead of a single top.
"""
import re

# The kinds, grouped the way the admin panel lists them.
TOPS = ("tshirt", "shirt", "polo", "kurta", "kameez")
OUTERWEAR = ("jacket", "blazer", "waistcoat", "hoodie")
BOTTOMS = ("jeans", "trousers", "shorts", "shalwar")
FOOTWEAR = ("sneakers", "formal_shoes", "sandals", "boots")
ACCESSORIES = ("watch", "belt", "tie", "cap", "sunglasses", "bag")
WOMEN = ("dupatta", "dress")

KIND_GROUPS = (
    ("Top", TOPS),
    ("Outerwear", OUTERWEAR),
    ("Bottom", BOTTOMS),
    ("Footwear", FOOTWEAR),
    ("Accessory", ACCESSORIES),
    ("Women", WOMEN),
)

# Flattened, in admin order; serializers and the data migration validate against this tuple.
KINDS = tuple(kind for _, kinds in KIND_GROUPS for kind in kinds)

# kind -> outfit slot; mirrors the engine's slot names (Product.slot choices).
KIND_SLOT = {
    "tshirt": "top", "shirt": "top", "polo": "top",
    "kurta": "kurta", "kameez": "kurta", "dress": "kurta",
    "jacket": "outerwear", "blazer": "outerwear", "waistcoat": "outerwear", "hoodie": "outerwear",
    "jeans": "bottom", "trousers": "bottom", "shorts": "bottom", "shalwar": "bottom",
    "sneakers": "footwear", "formal_shoes": "footwear", "sandals": "footwear", "boots": "footwear",
    "watch": "accessory", "belt": "accessory", "tie": "accessory", "cap": "accessory",
    "sunglasses": "accessory", "bag": "accessory",
    "dupatta": "dupatta",
}

# Keyword rules in priority order (first hit wins). Kurta/kameez is checked before shalwar so
# "Shalwar Kameez" is a one-piece kameez, not a pair of shalwar bottoms; tshirts are matched
# before plain shirts so a "t-shirt" is a tshirt, not a shirt.
_KIND_PATTERNS = tuple(
    (kind, re.compile(pattern, re.IGNORECASE)) for kind, pattern in (
        ("tshirt", r"t-?shirts?\b|\btees?\b"),
        ("polo", r"polos?\b"),
        ("shirt", r"shirts?\b|tops?\b"),
        ("kurta", r"kurt[ai]\b|kameez|thobe"),
        ("dress", r"dresse?s?\b|gowns?\b|frocks?\b|anarkalis?\b|lehengas?\b|kaftans?\b"),
        ("jacket", r"jackets?\b"),
        ("waistcoat", r"waistcoats?\b"),
        ("blazer", r"blazers?\b|coats?\b|suits?\b"),
        ("hoodie", r"hoodies?\b|sweatshirts?\b|jumpers?\b|sweaters?\b"),
        ("jeans", r"jeans?\b|denims?\b|dungarees?\b"),
        ("shorts", r"shorts?\b"),
        ("shalwar", r"shalwar|salwar|churidar"),
        ("trousers", r"trousers?\b|pants?\b|pajamas?\b|leggings?\b|chinos?\b|jogg(?:er|ers)"),
        ("sneakers", r"sneakers?|trainers?\b|running\s+shoes|canvas\s+shoes|sports?\s+shoes?|slip-?ons?\b"),
        ("formal_shoes", r"formal\s+shoes?|oxford\b|derby\b|brogues?|loafers?|moccasins?"),
        ("sandals", r"sandals?|flip\s*-?flops?|chappals?|slippers?|kolhapuris?"),
        ("boots", r"boots?\b|booties?\b"),
        ("watch", r"watche?s?\b|wrist\s*watch"),
        ("belt", r"belts?\b"),
        ("tie", r"\bties?\b|bow\s*ties?\b|cravat"),
        ("cap", r"\bcaps?\b|\bhats?\b|\bbeanies?\b|headbands?\b"),
        ("sunglasses", r"sun\s*-?glasses?|sunglass|\bshades\b|spectacles?\b"),
        ("bag", r"\bbags?\b|backpacks?\b|totes?\b|handbags?|clutches?\b|wallets?|purses?"),
        ("dupatta", r"dupattas?\b|shawls?\b|scarves|scarfs?\b|stoles?\b|chunnis?\b|veils?\b"),
    )
)

# A kids product never complements an adult look, even though most sit in unisex categories.
# "Kid"/"Kids" with a boundary, "Kid's/Kids'" with an apostrophe, and the compound "kidswear".
KIDS_RE = re.compile(r"kids?\b|kidswear", re.IGNORECASE)


def infer_kind(name, category="", garment_type="", slot=""):
    """The garment kind for a product whose words are known; "" when nothing matches.

    The legacy coarse `garment_type` (Top/Bottom/Footwear/Accessory) is only the last resort for
    import rows whose words say nothing: Top -> shirt, Bottom -> trousers, Footwear -> formal shoes,
    Accessory -> "" (an unknown accessory must not inherit "watch").
    """
    haystack = f"{category} {name}".lower()
    for kind, pattern in _KIND_PATTERNS:
        if pattern.search(haystack):
            return kind
    fallback = {"Top": "shirt", "Bottom": "trousers", "Footwear": "formal_shoes"}.get(garment_type or "", "")
    return fallback or ""


def slot_of_kind(kind):
    """The outfit slot a kind occupies; "" for an unknown kind."""
    return KIND_SLOT.get(kind or "", "")


def is_kids_name(name):
    """True when the product name says it is for kids ("Levis Kids", "Kid's Unisex", "kidswear")."""
    return bool(KIDS_RE.search(name or ""))
