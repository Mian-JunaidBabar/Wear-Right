"""Garment kinds: the word rules, the kids flag and the tagging the serializer fills in.

The pure engine lives in `catalog/engine/kinds.py`; the serializer applies it when tagging
products (kind when blank, then slot and gender, never overwriting what is already set).
"""
import pytest

from catalog.engine.kinds import KINDS, infer_kind, is_kids_name, slot_of_kind
from catalog.models import Category, Product
from core.tests.factories import ProductFactory

pytestmark = pytest.mark.django_db


# One representative name per kind; the "Shalwar Kameez" rule must see the kameez, not a bottom.
INFERENCE_TABLE = [
    ("Navy T-Shirt", "tshirt"),
    ("Classic White Shirt", "shirt"),
    ("Men Polo", "polo"),
    ("Men Shalwar Kameez", "kurta"),
    ("Embroidered Kurta", "kurta"),
    ("Red Summer Dress", "dress"),
    ("Women Lehenga", "dress"),
    ("Denim Jacket", "jacket"),
    ("Nehru Waistcoat", "waistcoat"),
    ("Wool Blazer", "blazer"),
    ("Grey Hoodie", "hoodie"),
    ("Navy Blue Jeans", "jeans"),
    ("Cargo Shorts", "shorts"),
    ("Cotton Shalwar", "shalwar"),
    ("Chino Trousers", "trousers"),
    ("Running Sneakers", "sneakers"),
    ("Formal Oxford", "formal_shoes"),
    ("Kolhapuri Sandals", "sandals"),
    ("Leather Boots", "boots"),
    ("Titan Watch", "watch"),
    ("Leather Belt", "belt"),
    ("Silk Tie", "tie"),
    ("Baseball Cap", "cap"),
    ("Ray Ban Shades", "sunglasses"),
    ("Canvas Backpack", "bag"),
    ("Chiffon Dupatta", "dupatta"),
]


@pytest.mark.parametrize(("name", "kind"), INFERENCE_TABLE)
def test_every_kind_is_guessed_from_the_name(name, kind):
    assert infer_kind(name) == kind


def test_the_rules_cover_every_choices_entry_and_every_kind_maps_to_a_slot():
    for kind in KINDS:
        assert slot_of_kind(kind), f"{kind} must carry an outfit slot"


def test_the_coarse_garment_type_is_the_last_resort_for_wordless_rows():
    assert infer_kind("Imported Item 123", category="", garment_type="Top") == "shirt"
    assert infer_kind("Imported Item 456", garment_type="Bottom") == "trousers"
    assert infer_kind("Imported Item 789", garment_type="Footwear") == "formal_shoes"
    # An unknown accessory must not be tagged as a watch.
    assert infer_kind("Imported Misc", garment_type="Accessory") == ""


def test_kids_names_are_recognised_with_the_apostrophe_and_the_compound():
    assert is_kids_name("Tantra Kid's Unisex Black Kidswear")
    assert is_kids_name("Palm Tree Kids Denim Jackets")
    assert is_kids_name("kidswear tee")
    assert is_kids_name("Heavy adult jacket") is False


@pytest.mark.parametrize("name", [
    "Palm Tree Girls Sp Jace Sko White Skirts",
    "Boys Cotton Hoodie",
    "Baby Blue Romper",
    "Infant Sandals",
])
def test_boys_girls_baby_and_infant_names_count_as_kids(name):
    assert is_kids_name(name)


@pytest.mark.parametrize("name", ["Boyfriend Jeans", "Girl power tee"])
def test_adult_names_that_merely_start_with_a_kids_word_are_not_kids(name):
    # The word boundary keeps "Boyfriend" (and singular "girl") in the adult catalog.
    assert is_kids_name(name) is False


def test_the_serializer_infers_kind_slot_and_gender_on_create(staff_client):
    Category.objects.get(name="Men Shirt")  # seeded table row: slot=top, gender=men
    response = staff_client.post(
        "/api/products/",
        {"name": "Windowpane Formal Shirt", "category": "Men Shirt", "cultural_tag": "Formal",
         "compatible_skin_tone": "All", "price": "1500", "stock_quantity": 3,
         "garment_type": "Top"},
        format="json",
    )
    assert response.status_code == 201
    row = Product.objects.get(id=response.json()["product"]["id"])
    assert row.kind == "shirt"
    assert row.slot == "top"
    assert row.gender == "men"


def test_a_mislabelled_import_row_is_rescued_by_the_words(staff_client):
    # The real bug: "Heavy Shirt" said Accessory. The category it sits in must win.
    # Factories bypass the serializer, so the rescue is checked through the API like a real import.
    response = staff_client.post(
        "/api/products/",
        {"name": "Heavy Shirt", "category": "Men Shirt", "cultural_tag": "Formal",
         "compatible_skin_tone": "All", "price": "1500", "stock_quantity": 3,
         "garment_type": "Accessory"},
        format="json",
    )
    assert response.status_code == 201, response.json()
    product = Product.objects.get(id=response.json()["product"]["id"])
    assert product.kind == "shirt" and product.slot == "top" and product.gender == "men"


def test_the_eye_toggle_does_not_clobber_the_tagging(staff_client):
    # The eye toggle goes through this same detail endpoint with just one field (the detail view
    # only implements PUT; the web app sends partial FormData there too).
    response = staff_client.post(
        "/api/products/",
        {"name": "Heavy Shirt", "category": "Men Shirt", "cultural_tag": "Formal",
         "compatible_skin_tone": "All", "price": "1500", "stock_quantity": 3,
         "garment_type": "Accessory"},
        format="json",
    )
    product = Product.objects.get(id=response.json()["product"]["id"])

    toggled = staff_client.put(f"/api/products/{product.id}/", {"is_active": False}, format="json")
    assert toggled.status_code == 200, toggled.json()
    product.refresh_from_db()
    assert product.is_active is False
    assert product.kind == "shirt" and product.slot == "top" and product.gender == "men"


def test_an_explicit_kind_is_kept_and_bad_kinds_are_rejected(staff_client):
    response = staff_client.post(
        "/api/products/",
        {"name": "Heavy Shirt", "category": "Men Shirt", "cultural_tag": "Formal",
         "compatible_skin_tone": "All", "price": "1500", "stock_quantity": 3,
         "garment_type": "Accessory"},
        format="json",
    )
    product = Product.objects.get(id=response.json()["product"]["id"])

    changed = staff_client.put(f"/api/products/{product.id}/", {"kind": "kurta"}, format="json")
    assert changed.status_code == 200
    product.refresh_from_db()
    assert product.kind == "kurta"

    bad = staff_client.put(f"/api/products/{product.id}/", {"kind": "rocket"}, format="json")
    assert bad.status_code == 400
