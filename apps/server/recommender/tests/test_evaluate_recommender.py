import io

import pytest
from django.core.management import call_command

from recommender.services import seed_default_rules
from recommender.tests.test_recommender_api import make

pytestmark = pytest.mark.django_db


def _run():
    out = io.StringIO()
    call_command("evaluate_recommender", stdout=out)
    return out.getvalue()


def test_an_empty_catalog_says_what_to_do():
    assert "No active, in-stock products" in _run()


def test_the_report_covers_picks_and_looks():
    seed_default_rules()
    make("White", name="anchor shirt")
    make("Navy Blue", "bottom")
    make("Brown", "footwear")

    text = _run()

    assert "Shoppable catalog: 3 products" in text
    assert "Fair   warm" in text and "Dark   cool" in text and "overlap warm vs cool" in text
    assert "casual" in text and "looks complete" in text
