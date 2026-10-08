import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from accounts.models import UserProfile
from core.tests.factories import ProductFactory
from recommender.adapter import build_profile, infer_gender, infer_slot, product_to_item, size_in_stock
from recommender.models import ToneColorRule
from recommender.services import seed_default_rules

pytestmark = pytest.mark.django_db

HEX = {"Olive Green": "#808000", "Teal": "#008080", "Navy Blue": "#000080", "Black": "#000000", "White": "#ffffff",
       "Hot Pink": "#ff69b4", "Brown": "#7b4a2d", "Beige": "#f5f5dc"}


def make(colour, slot="top", *, name=None, category=None, gender="men", **extra):
    return ProductFactory(
        name=name or f"{colour} {slot}", slot=slot, gender=gender, formality=2, style_tags=["Casual"],
        color_name=colour, color_hex=HEX[colour], category=category or f"cat {slot} {colour}", stock_quantity=10,
        status="Active", **extra,
    )


@pytest.fixture
def rules():
    seed_default_rules()


# ---- the rules table ------------------------------------------------------------------------------------

def test_seeding_creates_rules_for_every_depth_and_undertone_and_is_idempotent():
    first = seed_default_rules()
    assert first > 100
    assert {(r.depth, r.undertone) for r in ToneColorRule.objects.all()} == {
        (d, u) for d in ("Fair", "Medium", "Dark") for u in ("warm", "cool", "neutral")}
    assert seed_default_rules() == 0


def test_a_rule_edited_by_staff_survives_reseeding():
    seed_default_rules()
    rule = ToneColorRule.objects.get(depth="Medium", undertone="warm", color_name="Olive Green")
    rule.score = -2
    rule.save()
    seed_default_rules()
    rule.refresh_from_db()
    assert rule.score == -2


def test_make_seed_loads_the_rules_and_tags_the_demo_products(settings, tmp_path):
    settings.MEDIA_ROOT, settings.DEBUG = tmp_path, True
    call_command("seed_products")
    assert ToneColorRule.objects.count() > 100
    from catalog.models import Product
    tie = Product.objects.get(name="Classic Blue Silk Tie")
    assert (tie.slot, tie.gender, tie.formality) == ("accessory", "men", 4)


def test_everyone_can_read_the_rules_but_only_staff_can_change_them(api_client, user, staff_client, rules):
    assert api_client.get("/api/tone-rules/?depth=Fair&undertone=warm").status_code == 200
    from catalog.engine.color import REFERENCE_COLORS
    unruled = next(n for n, _ in REFERENCE_COLORS if not ToneColorRule.objects.filter(depth="Fair", undertone="warm", color_name=n).exists())
    body = {"depth": "Fair", "undertone": "warm", "color_name": unruled, "score": 1}
    assert api_client.post("/api/tone-rules/", body, format="json").status_code == 401
    customer = APIClient()
    customer.force_authenticate(user=user)
    assert customer.post("/api/tone-rules/", body, format="json").status_code == 403
    assert staff_client.post("/api/tone-rules/", body, format="json").status_code == 201


def test_rules_are_filterable_and_validated(staff_client, api_client, rules):
    listed = api_client.get("/api/tone-rules/?depth=Dark&undertone=cool").json()
    assert listed["total_rules"] > 5 and {r["depth"] for r in listed["rules"]} == {"Dark"}
    bad = staff_client.post("/api/tone-rules/", {"depth": "Fair", "undertone": "warm", "color_name": "Plaid", "score": 2}, format="json")
    assert bad.status_code == 400
    bad_score = staff_client.post("/api/tone-rules/", {"depth": "Fair", "undertone": "warm", "color_name": "Black", "score": 5}, format="json")
    assert bad_score.status_code == 400
    duplicate = staff_client.post("/api/tone-rules/", {"depth": "Fair", "undertone": "cool", "color_name": "Navy Blue", "score": 1}, format="json")
    assert duplicate.status_code == 400


def test_staff_can_edit_and_delete_a_rule_and_missing_rules_are_404(staff_client, api_client, rules):
    rule = ToneColorRule.objects.first()
    url = f"/api/tone-rules/{rule.id}/"
    assert api_client.get(url).status_code == 200
    assert staff_client.put(url, {"score": -2}, format="json").json()["rule"]["score"] == -2
    assert api_client.delete(url).status_code == 401
    assert staff_client.delete(url).status_code == 200
    assert staff_client.get(url).status_code == 404
    assert staff_client.put(url, {"score": 1}, format="json").status_code == 404


def test_editing_a_rule_changes_the_palette_the_shopper_sees(staff_client, api_client, rules):
    before = api_client.get("/api/tone-rules/palette/?depth=Medium&undertone=warm").json()
    assert "Olive Green" in [c["name"] for c in before["best"]]
    rule = ToneColorRule.objects.get(depth="Medium", undertone="warm", color_name="Olive Green")
    staff_client.put(f"/api/tone-rules/{rule.id}/", {"score": -2}, format="json")
    after = api_client.get("/api/tone-rules/palette/?depth=Medium&undertone=warm").json()
    assert "Olive Green" not in [c["name"] for c in after["best"]]  # the avoid list shows only three, so check the rule itself too
    assert api_client.get("/api/tone-rules/?depth=Medium&undertone=warm").json()["rules"].__len__() > 0
    assert ToneColorRule.objects.get(id=rule.id).score == -2


def test_the_palette_endpoint_returns_best_and_avoid_colours_with_hex_codes(api_client, rules):
    body = api_client.get("/api/tone-rules/palette/?depth=Dark&undertone=cool").json()
    assert body["status"] == "success" and 1 <= len(body["best"]) <= 8 and 1 <= len(body["avoid"]) <= 3
    assert all(c["hex"].startswith("#") for c in body["best"] + body["avoid"])
    assert api_client.get("/api/tone-rules/palette/").json()["best"] == []  # nothing known about the shopper


# ---- top picks ------------------------------------------------------------------------------------------

def test_top_picks_are_ranked_by_the_shoppers_palette_and_explain_themselves(api_client, rules):
    make("Olive Green")
    make("Black", "bottom")
    make("Hot Pink", "footwear")  # an avoid colour for this shopper

    body = api_client.get("/api/recommendations/top/?depth=Medium&undertone=warm&gender=men").json()

    names = [i["name"] for i in body["items"]]
    assert names[0] == "Olive Green top" and "Hot Pink footwear" not in names
    first = body["items"][0]
    assert first["match"] > body["items"][1]["match"] and "Olive Green" in first["reason"]
    assert body["context"] == {"depth": "Medium", "undertone": "warm", "gender": "men", "styles": []}
    assert "Olive Green" in [c["name"] for c in body["palette"]["best"]]


def test_top_picks_leave_out_drafts_inactive_and_out_of_stock_products(api_client, rules):
    make("Olive Green", name="ok")
    make("Olive Green", name="draft").__class__.objects.filter(name="draft").update(status="Draft")
    make("Olive Green", name="inactive").__class__.objects.filter(name="inactive").update(status="Inactive")
    make("Olive Green", name="empty").__class__.objects.filter(name="empty").update(stock_quantity=0)
    names = [i["name"] for i in api_client.get("/api/recommendations/top/?depth=Medium&undertone=warm").json()["items"]]
    assert names == ["ok"]


def test_top_picks_return_at_most_fifteen_and_three_per_category(api_client, rules):
    for n in range(20):
        make("Teal", "bottom", category=f"Pants {n}", name=f"pant {n}")
    for n in range(8):  # newest, so they win score ties and the cap is what limits them
        make("Olive Green", category="Shirts", name=f"shirt {n}")
    items = api_client.get("/api/recommendations/top/?depth=Medium&undertone=warm").json()["items"]
    assert len(items) == 15
    assert sum(1 for i in items if i["category"] == "Shirts") == 3


def test_the_limit_parameter_is_honoured_and_capped(api_client, rules):
    for n in range(6):
        make("Teal", category=f"c{n}", name=f"t{n}")
    assert len(api_client.get("/api/recommendations/top/?depth=Medium&undertone=warm&limit=2").json()["items"]) == 2
    assert api_client.get("/api/recommendations/top/?depth=Medium&undertone=warm&limit=500").status_code == 200


def test_gender_and_size_filters(api_client, rules):
    make("Olive Green", name="men top")
    make("Olive Green", name="women top", gender="women")
    small_only = make("Olive Green", name="only small", size_s_stock=3)
    make("Olive Green", name="has medium", size_m_stock=4)
    names = {i["name"] for i in api_client.get("/api/recommendations/top/?depth=Medium&undertone=warm&gender=men&size=M").json()["items"]}
    assert names == {"men top", "has medium"}  # "women top" is the wrong gender, "only small" has no size M
    assert small_only.size_s_stock == 3


def test_a_signed_in_shoppers_saved_profile_is_used(user, rules):
    UserProfile.objects.create(user=user, skin_tone="Dark", undertone="cool", gender="female", preferred_style="formal")
    make("Hot Pink", name="pink", gender="women")
    client = APIClient()
    client.force_authenticate(user=user)

    body = client.get("/api/recommendations/top/").json()

    assert body["context"] == {"depth": "Dark", "undertone": "cool", "gender": "women", "styles": ["formal"]}
    assert [i["name"] for i in body["items"]] == ["pink"]


def test_query_parameters_override_the_saved_profile(user, rules):
    UserProfile.objects.create(user=user, skin_tone="Dark", undertone="cool")
    client = APIClient()
    client.force_authenticate(user=user)
    context = client.get("/api/recommendations/top/?depth=fair&undertone=WARM").json()["context"]
    assert (context["depth"], context["undertone"]) == ("Fair", "warm")


def test_favourite_and_avoided_colours_from_the_profile_change_the_order(user, rules):
    UserProfile.objects.create(user=user, skin_tone="Medium", undertone="neutral", favorite_colors=["Teal"], avoided_colors=["Navy Blue"])
    make("Navy Blue", name="navy", category="a")
    make("Olive Green", name="olive", category="b")
    make("Teal", name="teal", category="c")
    client = APIClient()
    client.force_authenticate(user=user)
    names = [i["name"] for i in client.get("/api/recommendations/top/").json()["items"]]
    assert names.index("teal") < names.index("olive") < names.index("navy")


def test_a_guest_with_no_scan_still_gets_a_catalog_just_not_a_personal_one(api_client, rules):
    make("Teal")
    body = api_client.get("/api/recommendations/top/").json()
    assert body["status"] == "success" and len(body["items"]) == 1 and body["palette"]["best"] == []


def test_the_profile_api_saves_favourite_colours(user):
    UserProfile.objects.create(user=user)
    client = APIClient()
    client.force_authenticate(user=user)
    response = client.patch("/api/auth/me/", {"favorite_colors": ["Teal", "Olive Green"], "avoided_colors": ["Yellow"]}, format="json")
    assert response.status_code == 200
    profile = UserProfile.objects.get(user=user)
    assert profile.favorite_colors == ["Teal", "Olive Green"] and profile.avoided_colors == ["Yellow"]


# ---- complete the look ----------------------------------------------------------------------------------

def test_complete_look_returns_a_pick_and_swaps_per_slot(api_client, rules):
    anchor = make("White", name="anchor shirt")
    for colour in ("Navy Blue", "Black", "Beige"):
        make(colour, "bottom", name=f"{colour} trousers")
    for colour in ("Brown", "Black"):
        make(colour, "footwear", name=f"{colour} shoes")

    body = api_client.get(f"/api/looks/complete/?product_id={anchor.id}&depth=Medium&undertone=warm").json()

    assert body["status"] == "success" and body["look_type"] == "casual" and body["complete"] is True
    assert body["anchor"]["id"] == anchor.id
    slots = {s["slot"]: s for s in body["slots"]}
    assert set(slots) == {"bottom", "footwear", "accessory"}
    assert slots["bottom"]["pick"]["why"] and len(slots["bottom"]["swaps"]) == 2
    assert slots["accessory"]["pick"] is None and slots["accessory"]["required"] is False


def test_complete_look_reports_what_is_missing(api_client):
    anchor = make("White")
    body = api_client.get(f"/api/looks/complete/?product_id={anchor.id}").json()
    assert body["complete"] is False and set(body["missing"]) == {"bottom", "footwear"}


def test_complete_look_rejects_a_missing_unknown_or_draft_product(api_client):
    assert api_client.get("/api/looks/complete/").status_code == 400
    assert api_client.get("/api/looks/complete/?product_id=abc").status_code == 400
    assert api_client.get("/api/looks/complete/?product_id=999999").status_code == 404
    draft = make("White")
    draft.__class__.objects.filter(id=draft.id).update(status="Draft")
    assert api_client.get(f"/api/looks/complete/?product_id={draft.id}").status_code == 404


def test_the_old_outfit_endpoint_still_works_for_existing_callers(api_client):
    main = make("White")
    make("Black", "bottom", category="Men Pant", garment_type="Bottom")
    assert api_client.get(f"/api/outfit/generate/?product_id={main.id}").status_code == 200


# ---- the adapter ----------------------------------------------------------------------------------------

def test_untagged_products_get_a_slot_gender_and_formality_from_their_legacy_fields():
    legacy = ProductFactory(category="Women Kurta", garment_type="Top", cultural_tag="Eastern", slot=None, gender=None, formality=None)
    assert (infer_slot(legacy), infer_gender(legacy)) == ("kurta", "women")
    assert product_to_item(legacy).formality == 3
    shoes = ProductFactory(category="Men Shoes", garment_type="Footwear", cultural_tag="Formal", slot=None, gender=None, formality=None)
    assert (infer_slot(shoes), infer_gender(shoes), product_to_item(shoes).formality) == ("footwear", "men", 4)


def test_tagged_values_win_over_inference():
    tagged = ProductFactory(category="Men Shirt", garment_type="Top", slot="outerwear", gender="unisex", formality=5)
    item = product_to_item(tagged)
    assert (item.slot, item.gender, item.formality) == ("outerwear", "unisex", 5)


def test_size_stock_rules():
    top = ProductFactory(slot="top", stock_quantity=10, size_m_stock=4)
    assert size_in_stock(top, "top", "M") and not size_in_stock(top, "top", "L")
    assert size_in_stock(top, "top", "") and size_in_stock(top, "top", "42")      # no usable size: any stock will do
    assert size_in_stock(ProductFactory(slot="top", stock_quantity=10), "top", "M")  # no per-size counts at all
    assert size_in_stock(top, "footwear", "L")                                     # sizes only apply to garments
    assert not size_in_stock(ProductFactory(slot="top", stock_quantity=0), "top", "M")


def test_the_profile_builder_maps_saved_values(user):
    UserProfile.objects.create(user=user, skin_tone="Fair", undertone="warm", gender="male", cultural_preference="Eastern", preferred_style="mixed")
    profile = build_profile(user, {})
    assert (profile.depth, profile.undertone, profile.gender, profile.styles) == ("Fair", "warm", "men", ("eastern",))
