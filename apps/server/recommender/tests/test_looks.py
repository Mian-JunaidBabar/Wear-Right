import pytest

from recommender.engine.items import accessory_kind
from recommender.engine.looks import complete_look, look_type
from recommender.tests.helpers import item, palette

NONE = palette()


def slots_by_name(look):
    return {(s["kind"] or s["slot"]): s for s in look["slots"]}


def test_a_casual_shirt_gets_bottoms_shoes_and_an_optional_accessory():
    anchor = item("top", "White")
    pool = [anchor, item("bottom", "Navy Blue"), item("footwear", "Brown"), item("accessory", "Black", name="Black Watch")]

    look = complete_look(anchor, pool, NONE)

    assert look["look_type"] == "casual" and look["complete"] and look["missing"] == []
    assert [s["slot"] for s in look["slots"]] == ["bottom", "footwear", "accessory"]
    assert all(s["pick"] for s in look["slots"])


def test_the_anchor_never_appears_in_its_own_look_and_its_slot_is_skipped():
    anchor = item("top", "White")
    look = complete_look(anchor, [anchor, item("top", "Black"), item("bottom", "Navy Blue"), item("footwear", "Brown")], NONE)
    assert "top" not in [s["slot"] for s in look["slots"]]
    assert all(s["pick"]["item"].id != anchor.id for s in look["slots"] if s["pick"])


def test_each_slot_has_a_best_pick_and_at_most_two_different_swaps_ranked_below_it():
    anchor = item("top", "White")
    pool = [anchor, item("footwear", "Brown"), item("footwear", "Black"), item("footwear", "Tan"), item("footwear", "Grey"),
            item("bottom", "Navy Blue")]
    shoes = slots_by_name(complete_look(anchor, pool, NONE))["footwear"]
    assert len(shoes["swaps"]) == 2
    ids = [shoes["pick"]["item"].id] + [w["item"].id for w in shoes["swaps"]]
    assert len(set(ids)) == 3
    assert all(w["score"] <= shoes["pick"]["score"] for w in shoes["swaps"])


def test_a_formal_look_around_a_blazer_asks_for_shirt_trousers_and_shoes_with_optional_tie_watch_belt():
    anchor = item("outerwear", "Charcoal Grey", formality=4, styles=("Formal",))
    pool = [anchor, item("top", "White", formality=4), item("bottom", "Black", formality=4), item("footwear", "Black", formality=4),
            item("accessory", "Navy Blue", formality=4, name="Silk Tie"), item("accessory", "Grey", formality=4, name="Chrono Watch"),
            item("accessory", "Black", formality=4, name="Leather Belt")]

    look = complete_look(anchor, pool, NONE)

    assert look["look_type"] == "formal" and look["complete"]
    kinds = slots_by_name(look)
    assert set(kinds) == {"top", "bottom", "footwear", "tie", "watch", "belt"}
    assert [kinds[k]["required"] for k in ("top", "bottom", "footwear")] == [True] * 3
    assert [kinds[k]["required"] for k in ("tie", "watch", "belt")] == [False] * 3
    assert kinds["tie"]["pick"]["item"].name == "Silk Tie"


def test_eastern_women_get_bottom_dupatta_and_footwear_around_a_kurta():
    anchor = item("kurta", "Maroon", gender="women", formality=3, styles=("Eastern",))
    pool = [anchor, item("bottom", "Beige", gender="women", formality=3), item("dupatta", "Cream", gender="women", formality=3),
            item("footwear", "Tan", gender="women", formality=3)]
    look = complete_look(anchor, pool, NONE)
    assert look["look_type"] == "eastern_women" and look["complete"]
    assert [s["slot"] for s in look["slots"]][:3] == ["bottom", "dupatta", "footwear"]


def test_eastern_men_get_footwear_and_an_optional_waistcoat_around_a_kurta():
    anchor = item("kurta", "Olive Green", formality=3, styles=("Eastern",))
    look = complete_look(anchor, [anchor, item("footwear", "Brown", formality=3)], NONE)
    assert look["look_type"] == "eastern_men" and look["complete"]
    assert [(s["slot"], s["required"]) for s in look["slots"]] == [("footwear", True), ("outerwear", False)]


def test_look_type_follows_the_anchor():
    assert look_type(item("kurta", gender="women"), "women") == "eastern_women"
    assert look_type(item("top", styles=("Eastern",)), "men") == "eastern_men"
    assert look_type(item("outerwear"), "men") == "formal"
    assert look_type(item("top", formality=4), "men") == "formal"
    assert look_type(item("top", formality=2), "men") == "casual"


def test_pieces_for_the_other_gender_are_never_picked_but_unisex_pieces_are():
    anchor = item("top", "White", gender="men")
    pool = [anchor, item("bottom", "Black", gender="women"), item("bottom", "Grey", gender="unisex"), item("footwear", "Brown")]
    bottoms = slots_by_name(complete_look(anchor, pool, NONE))["bottom"]
    assert bottoms["pick"]["item"].gender == "unisex" and bottoms["swaps"] == []


def test_a_unisex_anchor_uses_the_shoppers_gender():
    anchor = item("top", "White", gender="unisex")
    pool = [anchor, item("bottom", "Black", gender="women"), item("bottom", "Grey", gender="men")]
    pick = slots_by_name(complete_look(anchor, pool, NONE, gender="women"))["bottom"]["pick"]["item"]
    assert pick.gender == "women"


def test_pieces_more_than_one_formality_level_away_are_excluded():
    anchor = item("top", "White", formality=2)
    pool = [anchor, item("bottom", "Black", formality=4), item("bottom", "Navy Blue", formality=3), item("footwear", "Brown", formality=2)]
    bottoms = slots_by_name(complete_look(anchor, pool, NONE))["bottom"]
    assert bottoms["pick"]["item"].formality == 3 and bottoms["swaps"] == []


def test_colour_harmony_with_the_anchor_decides_between_otherwise_equal_pieces():
    anchor = item("top", "Hot Pink")
    pool = [anchor, item("bottom", "Yellow"), item("bottom", "Black"), item("footwear", "Brown")]
    assert slots_by_name(complete_look(anchor, pool, NONE))["bottom"]["pick"]["item"].color_name == "Black"


def test_the_shoppers_palette_breaks_ties_between_equally_harmonious_pieces():
    anchor = item("top", "White")
    pool = [anchor, item("bottom", "Black"), item("bottom", "Navy Blue"), item("footwear", "Brown")]
    liked = palette(Navy_Blue=2, Black=-2)
    assert slots_by_name(complete_look(anchor, pool, liked))["bottom"]["pick"]["item"].color_name == "Navy Blue"


def test_a_belt_is_matched_to_the_chosen_shoes_not_to_the_shirt():
    anchor = item("outerwear", "Charcoal Grey", formality=4)
    pool = [anchor, item("top", "White", formality=4), item("bottom", "Black", formality=4),
            item("footwear", "Brown", formality=4),
            item("accessory", "Black", formality=4, name="Black Leather Belt"),
            item("accessory", "Brown", formality=4, name="Brown Leather Belt")]
    belt = slots_by_name(complete_look(anchor, pool, NONE))["belt"]
    assert belt["pick"]["item"].name == "Brown Leather Belt" and "shoes" in belt["pick"]["why"]


def test_a_missing_required_slot_is_reported_not_hidden():
    anchor = item("top", "White")
    look = complete_look(anchor, [anchor, item("bottom", "Black")], NONE)
    assert look["complete"] is False and look["missing"] == ["footwear"]
    assert slots_by_name(look)["footwear"]["pick"] is None


def test_out_of_size_pieces_are_not_offered():
    anchor = item("top", "White")
    look = complete_look(anchor, [anchor, item("bottom", "Black", size_ok=False), item("footwear", "Brown")], NONE)
    assert slots_by_name(look)["bottom"]["pick"] is None


def test_accessory_kinds_are_read_from_the_product_name():
    assert accessory_kind(item("accessory", name="Fastrack Men Black Watch")) == "watch"
    assert accessory_kind(item("accessory", name="Classic Blue Silk Tie")) == "tie"
    assert accessory_kind(item("accessory", name="Leather Belt")) == "belt"
    assert accessory_kind(item("accessory", name="Wayfarer Sunglasses")) == "sunglasses"
    assert accessory_kind(item("accessory", name="Mystery Thing")) == ""


def test_the_same_inputs_always_give_the_same_look():
    anchor = item("top", "White")
    pool = [anchor] + [item("bottom", c) for c in ("Black", "Navy Blue", "Khaki")] + [item("footwear", c) for c in ("Brown", "Black")]
    first = [(s["slot"], s["pick"]["item"].id) for s in complete_look(anchor, pool, NONE)["slots"] if s["pick"]]
    second = [(s["slot"], s["pick"]["item"].id) for s in complete_look(anchor, list(reversed(pool)), NONE)["slots"] if s["pick"]]
    assert first == second


def test_a_piece_that_can_be_drawn_on_the_mannequin_beats_an_equal_one_that_cannot():
    anchor = item("top", "White")
    undrawable = item("bottom", "Black", ready=False)
    drawable = item("bottom", "Black", ready=True)
    pool = [anchor, undrawable, drawable, item("footwear", "Brown")]
    bottoms = slots_by_name(complete_look(anchor, pool, NONE))["bottom"]
    assert bottoms["pick"]["item"].id == drawable.id and bottoms["swaps"][0]["item"].id == undrawable.id


def test_a_better_colour_still_wins_over_the_ready_bonus():
    anchor = item("top", "Hot Pink")
    pool = [anchor, item("bottom", "Black", ready=False), item("bottom", "Yellow", ready=True), item("footwear", "Brown")]
    assert slots_by_name(complete_look(anchor, pool, NONE))["bottom"]["pick"]["item"].color_name == "Black"
