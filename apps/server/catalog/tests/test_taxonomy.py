import io

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from rest_framework.test import APIClient

from accounts.models import UserProfile
from catalog.models import Category, Style
from catalog.taxonomy import seed_taxonomy
from core.tests.factories import ProductFactory

pytestmark = pytest.mark.django_db

PRODUCT = {"name": "New Shirt", "category": "Men Shirt", "cultural_tag": "Casual", "compatible_skin_tone": "All", "price": "1500"}


def test_the_migration_seeds_men_women_and_regional_categories_and_the_styles():
    names = set(Category.objects.values_list("name", flat=True))
    assert {"Men Shirt", "Women Kurta", "Women Dupatta", "Women Shalwar", "Men Waistcoat", "Watches", "Women Outerwear"} <= names
    assert {c.gender for c in Category.objects.all()} == {"men", "women", "unisex"}
    assert Category.objects.get(name="Women Kurta").group == "Regional"
    assert set(Style.objects.values_list("slug", flat=True)) >= {"casual", "formal", "eastern", "western", "regional"}


def test_seeding_again_creates_nothing_and_keeps_staff_edits():
    Category.objects.filter(name="Men Shirt").update(name="Men Shirts", is_active=False)
    assert seed_taxonomy(Category, Style) == 1                      # only the renamed one is missing again
    assert Category.objects.get(name="Men Shirts").is_active is False
    assert seed_taxonomy(Category, Style) == 0


def test_the_public_list_has_active_categories_with_counts_and_a_cover_photo(api_client):
    ProductFactory(category="Women Kurta", status="Active", stock_quantity=3, image="products/k.png")
    ProductFactory(category="Women Kurta", status="Draft", stock_quantity=3)        # drafts are not counted
    ProductFactory(category="Women Kurta", status="Active", stock_quantity=0)       # neither is sold-out stock
    Category.objects.filter(name="Men Cap").update(is_active=False)

    body = api_client.get("/api/categories/").json()

    rows = {c["name"]: c for c in body["categories"]}
    assert rows["Women Kurta"]["product_count"] == 1 and rows["Women Kurta"]["cover"] == "/media/products/k.png"
    assert rows["Men Shirt"]["product_count"] == 0 and rows["Men Shirt"]["cover"] is None
    assert "Men Cap" not in rows
    assert body["total_categories"] == len(body["categories"])


def test_staff_can_add_rename_hide_and_delete_categories_and_others_cannot(api_client, user, staff_client):
    new = {"name": "Women Lehenga", "gender": "women", "group": "Regional", "sort_order": 5}
    assert api_client.post("/api/categories/", new, format="json").status_code == 401
    customer = APIClient()
    customer.force_authenticate(user=user)
    assert customer.post("/api/categories/", new, format="json").status_code == 403

    created = staff_client.post("/api/categories/", new, format="json")
    assert created.status_code == 201
    row = Category.objects.get(name="Women Lehenga")
    assert staff_client.post("/api/categories/", new, format="json").status_code == 400   # names are unique

    assert staff_client.put(f"/api/categories/{row.id}/", {"name": "Women Bridal Lehenga"}, format="json").status_code == 200
    staff_client.put(f"/api/categories/{row.id}/", {"is_active": False}, format="json")
    assert "Women Bridal Lehenga" not in [c["name"] for c in api_client.get("/api/categories/").json()["categories"]]
    assert "Women Bridal Lehenga" in [c["name"] for c in staff_client.get("/api/categories/?all=1").json()["categories"]]
    assert "Women Bridal Lehenga" not in [c["name"] for c in staff_client.get("/api/categories/").json()["categories"]]

    assert api_client.delete(f"/api/categories/{row.id}/").status_code == 401
    assert staff_client.delete(f"/api/categories/{row.id}/").status_code == 200
    assert staff_client.delete(f"/api/categories/{row.id}/").status_code == 404
    assert staff_client.put(f"/api/categories/{row.id}/", {"name": "x"}, format="json").status_code == 404


def test_products_can_only_use_categories_that_exist_and_are_active(staff_client):
    unknown = staff_client.post("/api/products/", {**PRODUCT, "category": "Space Suits"}, format="json")
    assert unknown.status_code == 400 and "Unknown category" in str(unknown.json())

    staff_client.post("/api/categories/", {"name": "Space Suits", "gender": "unisex"}, format="json")
    assert staff_client.post("/api/products/", {**PRODUCT, "category": "Space Suits"}, format="json").status_code == 201

    Category.objects.filter(name="Space Suits").update(is_active=False)
    assert staff_client.post("/api/products/", {**PRODUCT, "category": "Space Suits"}, format="json").status_code == 400


def test_the_style_of_a_product_is_checked_against_the_styles_table_and_case_is_fixed(staff_client):
    ok = staff_client.post("/api/products/", {**PRODUCT, "cultural_tag": "formal"}, format="json")
    assert ok.status_code == 201 and ok.json()["product"]["cultural_tag"] == "Formal"
    bad = staff_client.post("/api/products/", {**PRODUCT, "cultural_tag": "Steampunk"}, format="json")
    assert bad.status_code == 400 and "Unknown style" in str(bad.json())


def test_a_new_style_becomes_usable_everywhere(staff_client, user):
    assert staff_client.post("/api/styles/", {"name": "Bridal", "slug": "bridal"}, format="json").status_code == 201
    assert staff_client.post("/api/products/", {**PRODUCT, "cultural_tag": "Bridal"}, format="json").status_code == 201
    assert "Bridal" in [s["name"] for s in APIClient().get("/api/styles/").json()["styles"]]

    UserProfile.objects.create(user=user)
    client = APIClient()
    client.force_authenticate(user=user)
    assert client.patch("/api/auth/me/", {"preferred_style": "bridal", "cultural_preference": "Bridal"}, format="json").status_code == 200
    profile = UserProfile.objects.get(user=user)
    assert (profile.preferred_style, profile.cultural_preference) == ("bridal", "Bridal")


def test_profile_styles_must_exist_but_mixed_is_always_allowed(user):
    UserProfile.objects.create(user=user)
    client = APIClient()
    client.force_authenticate(user=user)
    assert client.patch("/api/auth/me/", {"preferred_style": "mixed"}, format="json").status_code == 200
    assert client.patch("/api/auth/me/", {"preferred_style": "goth"}, format="json").status_code == 400
    assert client.patch("/api/auth/me/", {"cultural_preference": "Goth"}, format="json").status_code == 400
    assert client.patch("/api/auth/me/", {"cultural_preference": "eastern"}, format="json").status_code == 200
    assert UserProfile.objects.get(user=user).cultural_preference == "Eastern"


def test_a_switched_off_style_is_hidden_and_no_longer_accepted(staff_client, api_client):
    style = Style.objects.get(slug="regional")
    staff_client.put(f"/api/styles/{style.id}/", {"is_active": False}, format="json")
    assert "Regional" not in [s["name"] for s in api_client.get("/api/styles/").json()["styles"]]
    assert staff_client.post("/api/products/", {**PRODUCT, "cultural_tag": "Regional"}, format="json").status_code == 400


def test_style_and_category_writes_need_staff(api_client):
    assert api_client.post("/api/styles/", {"name": "X", "slug": "x"}, format="json").status_code == 401
    assert api_client.put("/api/styles/1/", {"name": "X"}, format="json").status_code == 401


def test_recategorize_moves_imported_products_by_article_type(tmp_path):
    (tmp_path / "styles.csv").write_text(
        "id,gender,masterCategory,subCategory,articleType,baseColour,season,year,usage,productDisplayName\n"
        "1,Unisex,Accessories,Watches,Watches,Black,Fall,2011,Casual,A Watch\n"
        "2,Women,Apparel,Bottomwear,Salwar,Red,Fall,2011,Ethnic,A Salwar\n"
        "3,Men,Apparel,Topwear,Shirts,Blue,Fall,2011,Casual,A Shirt\n", encoding="utf-8")
    watch = ProductFactory(external_id="1", slot="accessory", gender="unisex", category="Unisex Accessory")
    salwar = ProductFactory(external_id="2", slot="bottom", gender="women", category="Women Pant")
    shirt = ProductFactory(external_id="3", slot="top", gender="men", category="Men Shirt")
    by_hand = ProductFactory(external_id=None, slot="accessory", gender="unisex", category="Unisex Accessory")
    out = io.StringIO()

    call_command("recategorize_catalog", source=str(tmp_path), stdout=out)

    for product in (watch, salwar, shirt, by_hand):
        product.refresh_from_db()
    assert (watch.category, salwar.category, shirt.category) == ("Watches", "Women Shalwar", "Men Shirt")
    assert by_hand.category == "Unisex Accessory"          # hand-made products are never touched
    assert "Recategorised 2 products." in out.getvalue()


def test_recategorize_needs_the_csv(tmp_path):
    with pytest.raises(CommandError, match="styles.csv"):
        call_command("recategorize_catalog", source=str(tmp_path), stdout=io.StringIO())
