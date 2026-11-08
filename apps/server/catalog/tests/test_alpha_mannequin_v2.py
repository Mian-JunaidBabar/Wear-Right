"""Mannequin v2: messy render names, both genders in one manifest, product names, fair / dark skin copies,
the assembled skin bases, the richer wardrobe API, and the mannequin-only demo shop."""
import csv

import pytest

from catalog.alpha_services import find_render_files, import_alpha_kit, publish_demo_products
from catalog.models import MannequinBase, MannequinLayer
from core.tests.factories import ProductFactory

from .alpha_fixtures import DARK, FAIR, fake_segment, person, save_png

pytestmark = pytest.mark.django_db
URL = "/api/mannequin/alpha/"
HEADER = ["code", "gender", "external_id", "product_name", "slot", "product", "ref_file", "render_file", "status", "tries", "notes"]


@pytest.fixture(autouse=True)
def media_root(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "media"
    return settings.MEDIA_ROOT


def write_manifest(root, rows):
    root.mkdir(parents=True, exist_ok=True)
    with (root / "manifest.csv").open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(HEADER)
        for code, gender, external_id, product_name, slot in rows:
            writer.writerow([code, gender, external_id, product_name, slot, "", "", "", "done", "", ""])


def touch(folder, *names):
    folder.mkdir(parents=True, exist_ok=True)
    for name in names:
        (folder / name).write_bytes(b"x")


def test_render_files_are_found_by_code_whatever_the_team_named_them(tmp_path):
    folder = tmp_path / "renders"
    touch(folder, "T1_20024.png", "T1_20024 Fair", "T2_33065 dark.png", "T2_33065.png", "MB6.PNG",
          "M01.png", "M01.Fairpng", "M01 Dark.png", "MS3 Fair.Png", "notes.txt", ".DS_Store")

    found, warnings = find_render_files(folder, ["T1", "T2", "MB6", "MO1", "MS3"])

    assert set(found["T1"]) == {"wheatish", "fair"}
    assert found["T2"]["dark"].name == "T2_33065 dark.png"
    assert found["MB6"]["wheatish"].name == "MB6.PNG"
    assert {skin: path.name for skin, path in found["MO1"].items()} == {
        "wheatish": "M01.png", "fair": "M01.Fairpng", "dark": "M01 Dark.png",
    }  # a zero typed for the letter O still matches MO1
    assert set(found["MS3"]) == {"fair"}
    assert any("notes.txt" in warning for warning in warnings)


def test_a_duplicate_render_keeps_the_one_with_an_image_extension(tmp_path):
    folder = tmp_path / "renders"
    touch(folder, "W1 Fair", "W1 Fair.png")
    found, warnings = find_render_files(folder, ["W1"])
    assert found["W1"]["fair"].name == "W1 Fair.png" and warnings


def make_skin_kit(root, *, fair_top_changed=False):
    """Men: a shirt, shoes and a watch, each with fair and dark copies (only the skin differs).
    Women: one shirt, so the manifest has both genders."""
    save_png(person(), root / "base" / "men.png")
    save_png(person(), root / "base" / "women.png")
    items = {"T1": dict(top=(200, 40, 40)), "S1": dict(shoes=(90, 50, 30)), "W1": dict(watch=(20, 20, 20))}
    for code, colours in items.items():
        save_png(person(**colours), root / "renders" / f"{code}_x.png")
        fair = dict(colours, top=(40, 160, 40)) if (code == "T1" and fair_top_changed) else colours
        save_png(person(skin=FAIR, **fair), root / "renders" / f"{code} Fair.png")
        save_png(person(skin=DARK, **colours), root / "renders" / f"{code} Dark.png")
    save_png(person(top=(30, 30, 160)), root / "renders" / "WT1.png")
    write_manifest(root, [
        ("T1", "men", "9001", "", "top"), ("S1", "men", "9003", "", "shoes"), ("W1", "men", "", "Steel watch", "watch"),
        ("WT1", "women", "9101", "", "top"),
    ])
    return root


def skin_products():
    return {
        "T1": ProductFactory(external_id="9001", gender="men"),
        "S1": ProductFactory(external_id="9003", gender="men"),
        "W1": ProductFactory(name="Steel Watch", gender="men"),  # matched by name, case-insensitive
        "WT1": ProductFactory(external_id="9101", gender="women"),
    }


def test_skin_copies_become_layers_and_a_fair_and_dark_base_is_assembled(tmp_path, media_root):
    made = skin_products()
    result = import_alpha_kit(source_dir=make_skin_kit(tmp_path / "kit"), gender="men", segment=fake_segment())

    rows = {row.code: row for row in result.rows}
    assert set(rows) == {"T1", "S1", "W1"}  # the women's row is not imported onto the men's base
    assert all(row.outcome == "approved" for row in rows.values()), [row.reason for row in rows.values()]
    assert rows["W1"].product_id == made["W1"].id
    assert all(row.skins == {"fair": "ok", "dark": "ok"} for row in rows.values()), [row.skins for row in rows.values()]
    for layer in MannequinLayer.objects.all():
        assert layer.image_fair and layer.image_dark
        assert (media_root / layer.image_fair.name).exists()
    base = MannequinBase.objects.get(gender="men")
    assert result.base_skins == {"fair": "derived", "dark": "derived"}
    assert base.image_fair and base.image_dark


def test_a_skin_copy_where_the_item_changed_is_dropped_and_falls_back(tmp_path, api_client):
    skin_products()
    result = import_alpha_kit(source_dir=make_skin_kit(tmp_path / "kit", fair_top_changed=True), gender="men", segment=fake_segment())

    top = next(row for row in result.rows if row.code == "T1")
    assert top.outcome == "approved"
    assert "item changed" in top.skins["fair"] and top.skins["dark"] == "ok"
    body = api_client.get(URL, {"gender": "men"}).json()
    item = next(slot for slot in body["slots"] if slot["slot"] == "top")["items"][0]
    assert item["layers"]["fair"] == item["layer"]  # falls back to the wheatish cut
    assert item["layers"]["dark"] != item["layer"]


def test_a_hand_made_skin_base_is_used_when_it_lines_up(tmp_path):
    skin_products()
    kit = make_skin_kit(tmp_path / "kit")
    save_png(person(skin=FAIR), kit / "base" / "men-fair.png")
    result = import_alpha_kit(source_dir=kit, gender="men", segment=fake_segment())
    assert result.base_skins["fair"] == "hand-made" and result.base_skins["dark"] == "derived"


def test_product_names_must_be_unique_and_exist(tmp_path):
    ProductFactory(name="Black Trouser", gender="men")
    ProductFactory(name="black trouser", gender="men")
    root = tmp_path / "kit"
    save_png(person(), root / "base" / "men.png")
    save_png(person(bottom=(10, 10, 10)), root / "renders" / "MB4.png")
    save_png(person(bottom=(10, 10, 10)), root / "renders" / "MB5.png")
    write_manifest(root, [("MB4", "men", "", "Black Trouser", "bottom"), ("MB5", "men", "", "Olive Trouser", "bottom")])

    rows = {row.code: row for row in import_alpha_kit(source_dir=root, gender="men", segment=fake_segment()).rows}

    assert rows["MB4"].outcome == "skipped" and "more than one" in rows["MB4"].reason
    assert rows["MB5"].outcome == "skipped" and "add it in the admin" in rows["MB5"].reason


def test_the_wardrobe_api_returns_skins_groups_and_the_top_kurta_rule(tmp_path, api_client):
    skin_products()
    import_alpha_kit(source_dir=make_skin_kit(tmp_path / "kit"), gender="men", segment=fake_segment())

    body = api_client.get(URL, {"gender": "men"}).json()

    assert set(body["base"]["skins"]) == {"wheatish", "fair", "dark"}
    assert body["base"]["skins"]["fair"].startswith("/media/mannequin_alpha/base/")
    assert [group["key"] for group in body["groups"]] == ["clothes", "shoes", "accessories"]
    assert next(group for group in body["groups"] if group["key"] == "accessories")["slots"] == ["watch"]
    assert body["exclusive"] == [["top", "kurta"]]
    watch = next(slot for slot in body["slots"] if slot["slot"] == "watch")
    assert watch["accessory"] is True and watch["label"] == "Watches"


def test_publish_demo_products_makes_mannequin_products_buyable(tmp_path):
    made = skin_products()
    for product in made.values():
        product.status, product.price, product.stock_quantity = "Draft", 0, 0
        product.save()
    import_alpha_kit(source_dir=make_skin_kit(tmp_path / "kit"), gender="men", segment=fake_segment())

    published = {product.id for product in publish_demo_products()}

    assert published == {made["T1"].id, made["S1"].id, made["W1"].id}
    shirt, watch = (type(made["T1"]).objects.get(pk=made[code].pk) for code in ("T1", "W1"))
    assert shirt.status == "Active" and shirt.price > 0 and shirt.sizes == ["S", "M", "L", "XL", "XXL"]
    assert watch.stock_quantity == 10 and watch.sizes == []  # the cart treats it as one size


def test_the_shop_can_show_only_mannequin_products(tmp_path, api_client, settings):
    made = skin_products()
    other = ProductFactory(name="Not on the mannequin")
    import_alpha_kit(source_dir=make_skin_kit(tmp_path / "kit"), gender="men", segment=fake_segment())

    everything = api_client.get("/api/products/").json()
    ids = {row["id"]: row for row in everything["results"]}
    assert other.id in ids and ids[other.id]["on_mannequin"] is False
    assert ids[made["T1"].id]["on_mannequin"] is True

    filtered = {row["id"] for row in api_client.get("/api/products/", {"mannequin": "1"}).json()["results"]}
    assert other.id not in filtered and made["T1"].id in filtered

    settings.SHOP_MANNEQUIN_ONLY = True
    demo = {row["id"] for row in api_client.get("/api/products/").json()["results"]}
    assert other.id not in demo and made["T1"].id in demo
