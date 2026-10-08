import io

import pytest
from django.core.management import call_command

from catalog.engine.families import family_of_hex, family_of_label
from core.tests.factories import ProductFactory


@pytest.mark.parametrize(
    ("hex_value", "family"),
    [("#000000", "black"), ("#1a1a1a", "black"), ("#ffffff", "white"), ("#808080", "grey"), ("#c0c0c0", "grey"),
     ("#000080", "blue"), ("#1560bd", "blue"), ("#0b7a3b", "green"), ("#6b6b2a", "green"), ("#e31e24", "red"),
     ("#800000", "red"), ("#7b4a2d", "brown"), ("#c3b091", "brown"), ("#ff69b4", "pink/purple"),
     ("#4b0082", "pink/purple"), ("#ffdb58", "yellow/orange"), ("#ffa500", "yellow/orange")],
)
def test_hex_colours_fall_into_the_expected_family(hex_value, family):
    assert family_of_hex(hex_value) == family


def test_every_reference_colour_has_a_family():
    from catalog.engine.color import REFERENCE_COLORS
    from catalog.engine.families import REFERENCE_FAMILY
    assert {name for name, _ in REFERENCE_COLORS} == set(REFERENCE_FAMILY)


def test_dark_photographed_black_is_still_black():
    """A black garment photographs around #3d3d3d; it must not be called grey."""
    assert family_of_hex("#3d3b3d") == "black" and family_of_hex("#2a2a2a") == "black"


def test_dataset_labels_map_to_families_and_unknown_labels_do_not():
    assert family_of_label("Navy Blue") == "blue" and family_of_label("Grey Melange") == "grey"
    assert family_of_label("Multi") is None and family_of_label("") is None and family_of_label(None) is None


@pytest.mark.django_db
def test_the_command_reports_agreement_per_slot():
    ProductFactory(external_id="1", slot="top", color_name="Navy Blue", color_hex="#000080")      # agrees
    ProductFactory(external_id="2", slot="top", color_name="Navy Blue", color_hex="#e31e24")      # blue label, red photo
    ProductFactory(external_id="3", slot="bottom", color_name="Black", color_hex="#101010")       # agrees
    ProductFactory(external_id="4", slot="bottom", color_name="Multi", color_hex="#101010")       # label has no family
    ProductFactory(external_id=None, color_name="Black", color_hex="#101010")                     # not imported: ignored
    out = io.StringIO()

    call_command("evaluate_catalog_colors", stdout=out)

    text = out.getvalue()
    assert "Family agreement: 2/3 = 66.7% (1 products skipped" in text
    assert "top        1/2 = 50.0%" in text and "bottom     1/1 = 100.0%" in text
    assert "blue->red 1" in text


@pytest.mark.django_db
def test_the_command_copes_with_nothing_to_compare():
    out = io.StringIO()
    call_command("evaluate_catalog_colors", stdout=out)
    assert "No imported products" in out.getvalue()
