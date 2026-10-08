import csv
import io

import numpy as np
import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from PIL import Image

from catalog.models import Product

pytestmark = pytest.mark.django_db

HEADER = ["id", "gender", "masterCategory", "subCategory", "articleType", "baseColour", "season", "year", "usage", "productDisplayName"]

# id, gender, articleType, baseColour, usage, productDisplayName, image colour (None = no image file)
ITEMS = [
    ("100", "Men", "Shirts", "Navy Blue", "Formal", "Navy Oxford Shirt", "#000080"),
    ("101", "Women", "Kurtas", "Maroon", "Ethnic", "Maroon Printed Kurta", "#800000"),
    ("102", "Men", "Casual Shoes", "Brown", "Casual", "Brown Loafers", "#7b4a2d"),
    ("103", "Unisex", "Watches", "Silver", "Casual", "Silver Watch", "#c0c0c0"),
    ("104", "Boys", "Tshirts", "Red", "Casual", "Boys Tee", "#ff0000"),  # gender not mapped
    ("105", "Men", "Socks", "Black", "Casual", "Ankle Socks", "#000000"),  # article type not mapped
    ("106", "Men", "Tshirts", "Grey", "Casual", "Grey Tee Without Photo", None),  # no image file
    ("107", "Men", "Tshirts", "", "Casual", "Plain Navy Tee", "#000080"),  # no base colour: photo names it
]


def white_background_remover(image):
    """Stand-in for rembg: makes near-white pixels transparent. No model download."""
    rgb = np.asarray(image.convert("RGB"))
    alpha = np.where((rgb >= 245).all(axis=2), 0, 255).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb, alpha]), "RGBA")


def _within(hex_a, hex_b, tolerance=2):
    a = [int(hex_a[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(hex_b[i:i + 2], 16) for i in (1, 3, 5)]
    return max(abs(x - y) for x, y in zip(a, b)) <= tolerance


@pytest.fixture(autouse=True)
def fake_rembg(monkeypatch, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "media"
    monkeypatch.setattr(
        "catalog.management.commands.import_fashion_catalog.rembg_remover",
        lambda **kwargs: white_background_remover,
    )


def _make_dataset(root):
    (root / "images").mkdir(parents=True)
    with open(root / "styles.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(HEADER)
        for image_id, gender, article, colour, usage, name, _ in ITEMS:
            writer.writerow([image_id, gender, "Apparel", "Topwear", article, colour, "Summer", "2012", usage, name])
    for image_id, _, _, _, _, _, hex_value in ITEMS:
        if hex_value is None:
            continue
        image = Image.new("RGB", (60, 80), "white")
        image.paste(tuple(int(hex_value[i:i + 2], 16) for i in (1, 3, 5)), (10, 10, 50, 70))  # garment on white
        image.save(root / "images" / f"{image_id}.jpg")
    return root


@pytest.fixture
def dataset(tmp_path):
    return _make_dataset(tmp_path / "kaggle")


def _run(source, **options):
    out = io.StringIO()
    err = io.StringIO()
    call_command("import_fashion_catalog", source=str(source), stdout=out, stderr=err, **options)
    return out.getvalue(), err.getvalue()


def test_mapped_items_are_imported_as_drafts_with_their_tags(dataset):
    out, _ = _run(dataset, limit=10)

    assert Product.objects.count() == 5
    assert "Created 5 draft products." in out

    shirt = Product.objects.get(external_id="100")
    assert shirt.status == "Draft"
    assert shirt.price == 0
    assert shirt.name == "Navy Oxford Shirt"
    assert shirt.slot == "top" and shirt.gender == "men"
    assert shirt.category == "Men Shirt" and shirt.garment_type == "Top"
    assert shirt.formality == 4 and shirt.style_tags == ["Formal"] and shirt.cultural_tag == "Formal"
    assert shirt.color_name == "Navy Blue"  # the dataset's base colour
    assert _within(shirt.color_hex, "#000080")  # the photo's colour, not the label
    assert shirt.color_palette and shirt.color_palette[0]["hex"] == shirt.color_hex

    kurta = Product.objects.get(external_id="101")
    assert kurta.category == "Women Kurta"
    assert kurta.formality == 3 and kurta.style_tags == ["Eastern"]

    watch = Product.objects.get(external_id="103")
    assert watch.gender == "unisex" and watch.category == "Watches"


def test_each_cut_out_is_saved_as_a_transparent_png(dataset):
    _run(dataset, limit=10)

    product = Product.objects.get(external_id="100")
    assert product.image.name == "products/100.png"
    with Image.open(product.image.path) as saved:
        assert saved.mode == "RGBA"
        assert saved.getpixel((0, 0))[3] == 0  # the white border is gone
        assert saved.getpixel((30, 40))[3] == 255  # the garment stays


def test_a_photo_without_a_base_colour_gets_its_colour_name_from_the_photo(dataset):
    _run(dataset, limit=10)

    plain = Product.objects.get(external_id="107")
    assert plain.color_name == "Navy Blue"
    assert plain.color_hex is not None


def test_rerunning_the_import_leaves_existing_products_alone(dataset):
    _run(dataset, limit=10)
    before = dict(Product.objects.values_list("external_id", "pk"))
    Product.objects.filter(external_id="100").update(price=4200, status="Active")  # an admin priced it

    out, _ = _run(dataset, limit=10)

    assert Product.objects.count() == 5
    assert dict(Product.objects.values_list("external_id", "pk")) == before
    assert Product.objects.get(external_id="100").price == 4200
    assert "Created 0 draft products." in out
    assert "Already imported (left unchanged): 5." in out


def test_the_limit_caps_how_many_products_are_imported(dataset):
    _run(dataset, limit=2)

    assert Product.objects.count() == 2


def test_the_report_says_why_items_were_not_imported(dataset):
    out, _ = _run(dataset, limit=10)

    assert "Malformed CSV rows skipped: 0." in out
    assert "1 without an image file" in out
    assert "gender not mapped 1" in out
    assert "article type not mapped 1" in out


def test_one_unreadable_photo_is_reported_and_the_rest_still_import(dataset):
    (dataset / "images" / "102.jpg").write_bytes(b"not a jpeg")

    out, err = _run(dataset, limit=10)

    assert Product.objects.count() == 4
    assert not Product.objects.filter(external_id="102").exists()
    assert "Failed 1:" in err and "102:" in err
    assert "Created 4 draft products." in out


def test_list_article_types_shows_which_names_are_mapped(dataset):
    out, _ = _run(dataset, list_article_types=True)

    assert "Shirts (mapped)" in out
    assert "Socks (not mapped)" in out
    assert Product.objects.count() == 0  # the report imports nothing


def test_a_missing_styles_csv_is_a_clean_command_error(tmp_path):
    with pytest.raises(CommandError, match="styles.csv"):
        _run(tmp_path)
