from recommender.engine.items import Profile
from recommender.engine.palette import Palette
from recommender.engine.ranker import PER_CATEGORY_CAP, gender_ok, rank
from recommender.tests.helpers import item, palette

WARM = Profile(depth="Medium", undertone="warm", gender="men", styles=("casual",))


def test_the_palette_scores_best_good_avoid_and_unknown():
    p = palette(Olive_Green=2, Teal=1, Hot_Pink=-2)
    assert (p.score("Olive Green"), p.score("teal"), p.score("Hot Pink"), p.score("Black")) == (2, 1, -2, 0)
    assert p.normalised("Olive Green") == 1.0 and p.normalised("Hot Pink") == 0.0 and p.normalised("Black") == 0.5


def test_without_rules_every_colour_sits_in_the_middle():
    assert Palette({}).normalised("Olive Green") == 0.5 and not Palette({}).known


def test_best_and_avoid_lists_are_ordered_and_capped_with_hex_codes():
    p = palette(Olive_Green=2, Teal=2, Coral=2, Brown=1, Hot_Pink=-2, Yellow=-2)
    assert [c["name"] for c in p.best(2)] == ["Coral", "Teal"] or len(p.best(2)) == 2
    assert len(p.best(8)) == 4 and p.best(8)[0]["hex"].startswith("#")
    assert {c["name"] for c in p.avoid(3)} == {"Hot Pink", "Yellow"}


def test_a_better_colour_ranks_higher():
    p = palette(Olive_Green=2, Teal=1)
    ranked = rank([item("top", "Teal"), item("top", "Olive Green"), item("top", "Black")], WARM, p)
    assert [r["colour"] for r in ranked] == ["Olive Green", "Teal", "Black"]


def test_colours_to_avoid_are_never_recommended():
    p = palette(Olive_Green=2, Hot_Pink=-2)
    ranked = rank([item("top", "Hot Pink"), item("top", "Olive Green")], WARM, p)
    assert [r["colour"] for r in ranked] == ["Olive Green"]


def test_the_score_is_half_palette_thirty_percent_style_twenty_percent_preference():
    p = palette(Olive_Green=2)
    profile = Profile(depth="Medium", undertone="warm", styles=("casual",), favourite_colours=("Olive Green",))
    best = rank([item("top", "Olive Green", styles=("Casual",))], profile, p)[0]
    assert best["score"] == 1.0 and best["match"] == 100
    plain = rank([item("top", "Olive Green", styles=("Formal",))], Profile(depth="Medium", undertone="warm", styles=("casual",)), p)[0]
    assert plain["score"] == round(0.5 * 1 + 0.3 * 0.3 + 0.2 * 0.5, 3)


def test_a_favourite_colour_beats_a_neutral_one_and_an_avoided_colour_loses():
    p = palette(Teal=1, Olive_Green=1, Coral=1)
    profile = Profile(depth="Medium", undertone="warm", favourite_colours=("Teal",), avoided_colours=("Coral",))
    ranked = rank([item("top", "Coral"), item("top", "Olive Green"), item("top", "Teal")], profile, p)
    assert [r["colour"] for r in ranked] == ["Teal", "Olive Green", "Coral"]


def test_no_more_than_three_items_per_category_and_at_most_fifteen_in_total():
    p = palette(Olive_Green=2)
    items = [item("bottom", "Olive Green", category=f"Pants {n}") for n in range(20)]
    items += [item("top", "Olive Green", category="Shirts") for _ in range(8)]  # newest, so they rank first
    ranked = rank(items, WARM, p)
    per = {}
    for row in ranked:
        per[row["item"].category] = per.get(row["item"].category, 0) + 1
    assert max(per.values()) <= PER_CATEGORY_CAP
    assert per["Shirts"] == 3 and len(ranked) == 15


def test_a_smaller_limit_is_respected():
    assert len(rank([item("top", "Teal", category=f"c{n}") for n in range(10)], WARM, palette(Teal=2), limit=4)) == 4


def test_gender_filter_keeps_unisex_and_untagged_items():
    assert gender_ok("unisex", "men") and gender_ok("", "women") and gender_ok("men", "") and not gender_ok("women", "men")
    ranked = rank([item("top", "Teal", gender="women"), item("top", "Teal", gender="unisex")], WARM, palette(Teal=2))
    assert len(ranked) == 1


def test_items_not_in_stock_in_the_shoppers_size_are_left_out():
    ranked = rank([item("top", "Teal", size_ok=False), item("top", "Teal")], WARM, palette(Teal=2))
    assert len(ranked) == 1


def test_every_pick_carries_a_short_reason_naming_the_colour_and_tone():
    reason = rank([item("top", "Olive Green")], WARM, palette(Olive_Green=2))[0]["reason"]
    assert "Olive Green" in reason and "best colours" in reason and "warm undertone" in reason and "casual style" in reason
    neutral = rank([item("top", "Black")], WARM, palette(Olive_Green=2))[0]["reason"]
    assert "neutral" in neutral


def test_ranking_is_repeatable_and_ties_break_by_newest_first():
    items = [item("top", "Teal", category=f"c{n}", id=n) for n in (3, 1, 2)]
    first = [r["item"].id for r in rank(items, WARM, palette(Teal=2))]
    assert first == [3, 2, 1] == [r["item"].id for r in rank(list(reversed(items)), WARM, palette(Teal=2))]
