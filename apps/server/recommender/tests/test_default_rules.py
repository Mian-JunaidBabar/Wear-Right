import pytest

from catalog.engine.color import REFERENCE_COLORS
from recommender.engine.default_rules import (
    AVOID, BEST, DEPTH_COLOURS, DEPTHS, GOOD, UNDERTONE_COLOURS, UNDERTONES, build_default_rules, combined_score,
)

NAMES = [name for name, _ in REFERENCE_COLORS]


def test_every_colour_in_the_rule_lists_is_a_known_reference_colour():
    for table in (DEPTH_COLOURS, UNDERTONE_COLOURS):
        for lists in table.values():
            for names in lists.values():
                assert set(names) <= set(NAMES), set(names) - set(NAMES)


def test_no_colour_is_both_best_and_avoid_in_the_same_list():
    for table in (DEPTH_COLOURS, UNDERTONE_COLOURS):
        for lists in table.values():
            assert not set(lists[BEST]) & set(lists[AVOID])
            assert not set(lists[BEST]) & set(lists[GOOD])


def test_scores_are_only_best_good_or_avoid():
    assert {score for _, _, _, score in build_default_rules(NAMES)} <= {BEST, GOOD, AVOID}


def test_every_depth_and_undertone_has_best_colours_and_something_to_avoid():
    rules = build_default_rules(NAMES)
    for depth in DEPTHS:
        for undertone in UNDERTONES:
            scores = [s for d, u, _, s in rules if (d, u) == (depth, undertone)]
            assert scores.count(BEST) >= 4 and scores.count(AVOID) >= 1, (depth, undertone, scores)


def test_warm_and_cool_undertones_get_different_advice():
    assert combined_score("Medium", "warm", "Mustard Yellow") > combined_score("Medium", "cool", "Mustard Yellow")
    assert combined_score("Medium", "cool", "Royal Blue") >= combined_score("Medium", "warm", "Royal Blue")
    assert combined_score("Fair", "cool", "Mustard Yellow") == AVOID


def test_depth_changes_the_advice_too():
    assert combined_score("Dark", "neutral", "White") > combined_score("Fair", "neutral", "Off-White")
    assert combined_score("Dark", "warm", "Dark Brown") <= 0


def test_the_rule_set_is_complete_and_has_no_duplicates():
    rules = build_default_rules(NAMES)
    keys = [(d, u, c) for d, u, c, _ in rules]
    assert len(keys) == len(set(keys))
    assert {(d, u) for d, u, *_ in rules} == {(d, u) for d in DEPTHS for u in UNDERTONES}
