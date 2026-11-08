"""After a scan the shopper says "yes, that's me" and sees only clothes in their colour theme (palette_only),
or taps one swatch to see only that colour."""
import pytest

from recommender.engine.items import Profile
from recommender.engine.ranker import rank
from recommender.tests.helpers import HEX, item, palette

WARM = Profile(depth="Medium", undertone="warm", gender="men", styles=("casual",))


def test_palette_only_keeps_best_and_good_colours():
    p = palette(Olive_Green=2, Teal=1)
    ranked = rank([item("top", "Teal"), item("top", "Olive Green"), item("top", "Black")], WARM, p, palette_only=True)
    assert [r["colour"] for r in ranked] == ["Olive Green", "Teal"]


def test_palette_only_does_nothing_without_a_palette():
    ranked = rank([item("top", "Teal"), item("top", "Black")], WARM, palette(), palette_only=True)
    assert len(ranked) == 2


def test_a_tapped_colour_keeps_only_that_colour():
    p = palette(Olive_Green=2, Teal=1)
    ranked = rank([item("top", "Teal"), item("bottom", "Olive Green"), item("top", "Olive Green")], WARM, p, colour="olive green")
    assert {r["colour"] for r in ranked} == {"Olive Green"} and len(ranked) == 2


@pytest.mark.django_db
def test_the_top_picks_api_accepts_the_theme(api_client):
    from core.tests.factories import ProductFactory
    from recommender.models import ToneColorRule

    ToneColorRule.objects.create(depth="Medium", undertone="warm", color_name="Olive Green", score=2)
    ToneColorRule.objects.create(depth="Medium", undertone="warm", color_name="Black", score=-2)
    olive = ProductFactory(name="Olive shirt", color_name="Olive Green", color_hex=HEX["Olive Green"], gender="men")
    ProductFactory(name="Grey shirt", color_name="Grey", color_hex=HEX["Grey"], gender="men")

    body = api_client.get("/api/recommendations/top/", {"depth": "Medium", "undertone": "warm", "theme": "palette"}).json()

    assert [row["id"] for row in body["items"]] == [olive.id]
