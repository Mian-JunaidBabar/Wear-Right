"""Mapping for the Kaggle "Fashion Product Images" dataset (styles.csv). Pure Python.

The dataset has no prices or stock, so imported items are created as Draft products.
The mappings below are rules, not measurements. Check the article type report
(`import_fashion_catalog --list-article-types`) against the real CSV before a real import.
"""
import csv
import random
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

ARTICLE_SLOT = {
    "Tshirts": "top", "Shirts": "top", "Tops": "top",
    "Jeans": "bottom", "Trousers": "bottom", "Track Pants": "bottom", "Churidar": "bottom", "Salwar": "bottom",
    "Kurtas": "kurta",
    "Blazers": "outerwear", "Jackets": "outerwear", "Waistcoat": "outerwear",
    "Casual Shoes": "footwear", "Formal Shoes": "footwear", "Sports Shoes": "footwear",
    "Sandals": "footwear", "Flip Flops": "footwear", "Heels": "footwear", "Flats": "footwear",
    "Ties": "accessory", "Watches": "accessory", "Belts": "accessory", "Caps": "accessory", "Sunglasses": "accessory",
    "Dupatta": "dupatta",
}
GENDER = {"Men": "men", "Women": "women", "Unisex": "unisex"}

# usage -> (formality on 1 to 5, primary style). Initial rule; phase 4 tunes it.
USAGE = {
    "Sports": (1, "Casual"), "Casual": (2, "Casual"), "Travel": (2, "Casual"),
    "Smart Casual": (3, "Casual"), "Ethnic": (3, "Eastern"),
    "Formal": (4, "Formal"), "Party": (4, "Formal"),
}

# (gender, slot) -> the legacy `category` label the rest of the app reads.
CATEGORY_FOR = {
    ("men", "top"): "Men Shirt", ("women", "top"): "Women Shirt", ("unisex", "top"): "Unisex Shirt",
    ("men", "bottom"): "Men Pant", ("women", "bottom"): "Women Pant", ("unisex", "bottom"): "Unisex Pant",
    ("men", "kurta"): "Men Shalwar Kameez", ("women", "kurta"): "Women Kurta",
    ("men", "outerwear"): "Men Outerwear", ("women", "outerwear"): "Women Outerwear",
    ("unisex", "outerwear"): "Unisex Outerwear",
    ("men", "footwear"): "Men Shoes", ("women", "footwear"): "Women Footwear", ("unisex", "footwear"): "Unisex Shoes",
    ("men", "accessory"): "Men Accessory", ("women", "accessory"): "Women Accessory",
    ("unisex", "accessory"): "Unisex Accessory",
    ("women", "dupatta"): "Women Dupatta",
}

GARMENT_TYPE = {
    "top": "Top", "kurta": "Top", "outerwear": "Top", "bottom": "Bottom",
    "footwear": "Footwear", "accessory": "Accessory", "dupatta": "Accessory",
}

IMAGE_SUFFIXES = (".jpg", ".jpeg", ".png", ".webp")

REASON_ARTICLE = "article type not mapped"
REASON_GENDER = "gender not mapped"
REASON_USAGE = "usage not mapped"
REASON_CATEGORY = "no category for this gender and slot"


@dataclass(frozen=True)
class StyleRecord:
    image_id: str
    name: str
    gender: str
    slot: str
    usage: str
    base_colour: str


REQUIRED_COLUMNS = ("id", "gender", "articleType", "baseColour", "usage", "productDisplayName")


def read_styles(path):
    """Read styles.csv. Returns (rows, malformed_count); rows with missing or extra columns are skipped.

    Some lines in the Kaggle file have unquoted commas in productDisplayName, which shifts the columns.
    """
    rows, malformed = [], 0
    with open(path, newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        missing = [column for column in REQUIRED_COLUMNS if column not in (reader.fieldnames or [])]
        if missing:
            raise ValueError(f"{path} has no column(s): {', '.join(missing)}")
        for row in reader:
            if None in row or any(value is None for value in row.values()):
                malformed += 1
                continue
            rows.append(row)
    return rows, malformed


def classify(row):
    """Map one styles.csv row to a StyleRecord, or to (None, reason) when it cannot become a product."""
    slot = ARTICLE_SLOT.get(row["articleType"])
    if slot is None:
        return None, REASON_ARTICLE
    gender = GENDER.get(row["gender"])
    if gender is None:
        return None, REASON_GENDER
    if row["usage"] not in USAGE:
        return None, REASON_USAGE
    if (gender, slot) not in CATEGORY_FOR:
        return None, REASON_CATEGORY
    record = StyleRecord(
        image_id=row["id"].strip(),
        name=row["productDisplayName"].strip(),
        gender=gender,
        slot=slot,
        usage=row["usage"],
        base_colour=row["baseColour"].strip(),
    )
    return record, None


def classify_all(rows):
    """Return (records, skipped Counter by reason) for a list of styles.csv rows."""
    records, skipped = [], Counter()
    for row in rows:
        record, reason = classify(row)
        if record is None:
            skipped[reason] += 1
        else:
            records.append(record)
    return records, skipped


def select_records(records, *, limit, seed):
    """Pick up to `limit` records, spreading them across (gender, slot) groups.

    The same seed and input always give the same list, and a larger limit extends a smaller one.
    """
    rng = random.Random(seed)
    groups = {}
    for record in sorted(records, key=lambda item: item.image_id):
        groups.setdefault((record.gender, record.slot), []).append(record)
    for group in groups.values():
        rng.shuffle(group)

    keys = sorted(groups)
    selected = []
    while len(selected) < limit and any(groups.values()):
        for key in keys:
            if groups[key] and len(selected) < limit:
                selected.append(groups[key].pop())
    return selected


def find_image(source_dir, image_id):
    """Path of the full-resolution image for an id under source_dir/images, or None."""
    for suffix in IMAGE_SUFFIXES:
        candidate = Path(source_dir) / "images" / f"{image_id}{suffix}"
        if candidate.is_file():
            return candidate
    return None


def product_fields(record, palette):
    """Field values for a draft Product built from one record and its colour palette."""
    formality, style = USAGE[record.usage]
    dominant = palette[0] if palette else None
    return {
        "external_id": record.image_id,
        "name": record.name[:255] or f"Kaggle item {record.image_id}",
        "category": CATEGORY_FOR[(record.gender, record.slot)],
        "garment_type": GARMENT_TYPE[record.slot],
        "slot": record.slot,
        "gender": record.gender,
        "formality": formality,
        "cultural_tag": style,
        "style_tags": [style],
        # Placeholder until the tone rules (phase 4) decide which skin tones suit the item.
        "compatible_skin_tone": "All",
        "color_name": record.base_colour or (dominant["name"] if dominant else None),
        "color_hex": dominant["hex"] if dominant else None,
        "color_palette": palette,
        "price": 0,
        "cost_price": 0,
        "stock_quantity": 0,
        "status": "Draft",
    }
