import pytest

from catalog.engine.kaggle import (
    ARTICLE_SLOT,
    CATEGORY_FOR,
    GARMENT_TYPE,
    REASON_ARTICLE,
    REASON_CATEGORY,
    REASON_GENDER,
    REASON_USAGE,
    USAGE,
    StyleRecord,
    classify,
    classify_all,
    product_fields,
    read_styles,
    select_records,
)
from catalog.models import Product

HEADER = "id,gender,masterCategory,subCategory,articleType,baseColour,season,year,usage,productDisplayName"


def _row(**overrides):
    row = {
        "id": "1", "gender": "Men", "articleType": "Shirts", "usage": "Formal",
        "baseColour": "Navy Blue", "productDisplayName": "Navy Oxford Shirt",
    }
    row.update(overrides)
    return row


def _record(image_id, gender, slot):
    return StyleRecord(image_id=image_id, name=f"item {image_id}", gender=gender, slot=slot, usage="Casual", base_colour="")


def test_a_mapped_row_becomes_a_record():
    record, reason = classify(_row(productDisplayName="  Slim Shirt "))

    assert reason is None
    assert record == StyleRecord(image_id="1", name="Slim Shirt", gender="men", slot="top", usage="Formal", base_colour="Navy Blue", article="Shirts")


@pytest.mark.parametrize(
    ("overrides", "reason"),
    [
        ({"articleType": "Socks"}, REASON_ARTICLE),
        ({"gender": "Boys"}, REASON_GENDER),
        ({"usage": "Wedding"}, REASON_USAGE),
        ({"gender": "Men", "articleType": "Dupatta"}, REASON_CATEGORY),  # no men's dupatta category
        ({"gender": "Unisex", "articleType": "Kurtas"}, REASON_CATEGORY),  # no unisex kurta category
    ],
)
def test_an_unmapped_row_is_skipped_with_its_reason(overrides, reason):
    record, found = classify(_row(**overrides))

    assert record is None
    assert found == reason


def test_classify_all_counts_skips_by_reason():
    rows = [_row(id="1"), _row(id="2", articleType="Socks"), _row(id="3", articleType="Socks"), _row(id="4", gender="Boys")]

    records, skipped = classify_all(rows)

    assert [record.image_id for record in records] == ["1"]
    assert skipped == {REASON_ARTICLE: 2, REASON_GENDER: 1}


def test_read_styles_skips_malformed_rows_and_counts_them(tmp_path):
    path = tmp_path / "styles.csv"
    path.write_text(
        HEADER + "\n"
        "1,Men,Apparel,Topwear,Shirts,Navy Blue,Summer,2012,Formal,Good shirt\n"
        "2,Men,Apparel,Topwear,Shirts,Navy Blue,Summer,2012,Formal,Shirt, with a comma\n"  # one column too many
        "3,Women,Apparel\n",  # too few columns
        encoding="utf-8",
    )

    rows, malformed = read_styles(path)

    assert [row["id"] for row in rows] == ["1"]
    assert malformed == 2


def test_read_styles_needs_the_columns_it_uses(tmp_path):
    path = tmp_path / "styles.csv"
    path.write_text("id,gender\n1,Men\n", encoding="utf-8")

    with pytest.raises(ValueError, match="articleType"):
        read_styles(path)


def test_selection_is_repeatable_and_spreads_across_groups():
    records = [_record(str(i), "men", "top") for i in range(40)]
    records += [_record(str(100 + i), "women", "footwear") for i in range(40)]
    records += [_record(str(200 + i), "men", "accessory") for i in range(5)]

    first = select_records(records, limit=30, seed=7)
    second = select_records(records, limit=30, seed=7)

    assert [record.image_id for record in first] == [record.image_id for record in second]
    assert len(first) == 30
    accessories = [record for record in first if record.slot == "accessory"]
    assert len(accessories) == 5  # the small group is used up, not crowded out
    tops = sum(1 for record in first if record.slot == "top")
    footwear = sum(1 for record in first if record.slot == "footwear")
    assert abs(tops - footwear) <= 1


def test_a_larger_limit_extends_a_smaller_selection():
    records = [_record(str(i), "men", "top") for i in range(10)] + [_record(str(100 + i), "women", "footwear") for i in range(10)]

    small = select_records(records, limit=6, seed=3)
    large = select_records(records, limit=12, seed=3)

    assert [record.image_id for record in large[:6]] == [record.image_id for record in small]


def test_selection_returns_everything_when_the_limit_is_larger_than_the_pool():
    records = [_record("1", "men", "top"), _record("2", "women", "footwear")]

    assert len(select_records(records, limit=150, seed=0)) == 2


def test_product_fields_make_a_draft_with_no_price():
    record = StyleRecord(image_id="42", name="Blue Shirt", gender="men", slot="top", usage="Formal", base_colour="")
    palette = [{"hex": "#000080", "name": "Navy Blue", "share": 0.8}, {"hex": "#ffffff", "name": "White", "share": 0.2}]

    fields = product_fields(record, palette)

    assert fields["external_id"] == "42"
    assert fields["status"] == "Draft"
    assert fields["price"] == 0
    assert fields["category"] == "Men Shirt"
    assert fields["garment_type"] == "Top"
    assert fields["slot"] == "top"
    assert fields["gender"] == "men"
    assert fields["formality"] == 4
    assert fields["cultural_tag"] == "Formal"
    assert fields["style_tags"] == ["Formal"]
    assert fields["compatible_skin_tone"] == "All"
    assert fields["color_name"] == "Navy Blue"  # no base colour from the dataset, so the photo decides
    assert fields["color_hex"] == "#000080"
    assert fields["color_palette"] == palette


def test_the_dataset_base_colour_wins_over_the_photo_name():
    record = StyleRecord(image_id="43", name="Olive Kurta", gender="women", slot="kurta", usage="Ethnic", base_colour="Olive")

    fields = product_fields(record, [{"hex": "#808000", "name": "Olive Green", "share": 1.0}])

    assert fields["color_name"] == "Olive"
    assert fields["cultural_tag"] == "Eastern"
    assert fields["category"] == "Women Kurta"


def test_a_photo_without_colour_leaves_colour_fields_empty():
    record = StyleRecord(image_id="44", name="Blank", gender="unisex", slot="accessory", usage="Casual", base_colour="")

    fields = product_fields(record, [])

    assert fields["color_name"] is None
    assert fields["color_hex"] is None
    assert fields["color_palette"] == []


def test_every_mapped_category_is_a_valid_product_category():
    from catalog.engine.kaggle import ARTICLE_CATEGORY
    from catalog.taxonomy import DEFAULT_CATEGORIES
    known = {name for name, *_ in DEFAULT_CATEGORIES}
    assert set(CATEGORY_FOR.values()) | set(ARTICLE_CATEGORY.values()) <= known


def test_every_mapped_slot_style_and_formality_is_valid():
    slots = {value for value, _ in Product.SLOT_CHOICES}
    from catalog.taxonomy import DEFAULT_STYLES
    styles = {name for name, _ in DEFAULT_STYLES}

    assert set(ARTICLE_SLOT.values()) <= slots
    assert {slot for _, slot in CATEGORY_FOR} <= slots
    assert set(GARMENT_TYPE) == slots
    assert {value for value, _ in Product.GARMENT_TYPE_CHOICES} >= set(GARMENT_TYPE.values())
    assert {style for _, style in USAGE.values()} <= styles
    assert all(1 <= formality <= 5 for formality, _ in USAGE.values())


def test_regional_and_accessory_articles_get_their_own_category():
    from catalog.engine.kaggle import category_for
    assert category_for("women", "bottom", "Salwar") == "Women Shalwar"
    assert category_for("women", "bottom", "Patiala") == "Women Shalwar"
    assert category_for("men", "outerwear", "Nehru Jackets") == "Men Waistcoat"
    assert category_for("unisex", "accessory", "Watches") == "Watches"
    assert category_for("men", "accessory", "Belts") == "Belts"
    assert category_for("men", "bottom", "Salwar") == "Men Pant"              # a women's category does not apply to men
    assert category_for("women", "bottom", "Jeans") == "Women Pant"           # no article category: gender and slot decide


def test_women_and_regional_article_types_are_importable():
    for article, gender, slot in [("Kurtis", "Women", "kurta"), ("Stoles", "Women", "dupatta"), ("Nehru Jackets", "Men", "outerwear"),
                                  ("Patiala", "Women", "bottom"), ("Skirts", "Women", "bottom"), ("Tunics", "Women", "top")]:
        record, reason = classify(_row(articleType=article, gender=gender, usage="Ethnic"))
        assert reason is None and record.slot == slot, (article, reason)
    assert classify(_row(articleType="Stoles", gender="Men"))[1] == REASON_CATEGORY  # no men's dupatta category
