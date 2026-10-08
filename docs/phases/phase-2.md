# Phase 2: Catalog schema, Kaggle import, rembg cut-outs, colour extraction

Status: done with open items. Real import run on 150 Kaggle products with the real rembg model.

## Goal
Product fields the look rules need, a repeatable import of a sample of the Kaggle "Fashion Product Images" dataset, transparent cut-outs, and colour extracted from the cut-out pixels.

## What changed
- Backend schema: [catalog/models.py](../../apps/server/catalog/models.py) gains `external_id`, `slot`, `gender`, `formality`, `style_tags`, `color_name`, `color_hex`, `color_palette` and a `Draft` status (migration `catalog 0002`).
- Engine (no Django): [color.py](../../apps/server/catalog/engine/color.py) (k-means k=3 in CIELAB D65, CIEDE2000 naming), [cutout.py](../../apps/server/catalog/engine/cutout.py) (rembg wrapper), [kaggle.py](../../apps/server/catalog/engine/kaggle.py) (mapping, CSV reading, seeded selection), [families.py](../../apps/server/catalog/engine/families.py) (colour families for evaluation).
- Commands: `import_fashion_catalog`, `process_product_images`, `evaluate_catalog_colors`, `download_models` (Makefile: `make import-catalog`, `make process-images`, `make models`).
- Draft products are hidden from shoppers (list and detail) and cannot be ordered; staff see them.
- API: the new fields are returned by `/api/products/`; a blank `external_id` is stored as NULL.

## Decisions and why
- Imported items are `Draft`, price 0, stock 0: the dataset has no prices, so nothing is invented. An admin prices and activates them.
- Mapping rules (article type to slot, usage to formality and style) are initial rules, not measurements. Unmapped rows are counted in the import report, never guessed.
- Round-robin selection across (gender, slot) with seed 42, so the same 150 are picked every run.
- Only the transparent PNG is stored (`products/<kaggle id>.png`); the Kaggle id links back to the original.
- Colour is clustered in CIELAB D65 and named by CIEDE2000 distance. A first version mixed OpenCV's D65 Lab with coloraide's default D50 Lab and returned `#28007a` for navy; both now use `lab-d65` and round-trip exactly.

## Gates (real output, end of phase 3 run)
```
make test:     297 passed (backend, 7 of them real-model)   Tests 58 passed (web)   tsc + eslint clean
make build:    passed
make e2e:      23 passed (1.5m)
make test-models: 7 passed
```

## Real-model checks
- rembg `isnet-general-use` (178,648,008 bytes) downloaded to `apps/server/ml_models/rembg/` by `make models` and used for the real import.
- Real import: **150 draft products created, 0 failed**, by slot: accessory 27, footwear 27, top 26, bottom 24, outerwear 19, kurta 18, dupatta 9. Data came from `styles.csv` (44,446 rows, 22 malformed rows skipped) plus the 150 full-resolution images.
- All 150 have a colour and a 3-colour palette. Opaque share of the cut-outs: min 0.048, median 0.322, max 0.617; no cut-out was nearly empty or nearly full.
- Looked at a 30-item contact sheet: flat products (shoes, caps, sunglasses, bags) cut out cleanly.
- `make process-images` also ran on the 11 seeded demo products.
- **Colour family agreement with the dataset's own labels: 86/150 = 57.3%** (`evaluate_catalog_colors`). Worst slots: dupatta 1/9, kurta 7/18, accessory 12/27. Best: outerwear 15/19, top 20/26.

## Known limitations
- **Many Kaggle apparel photos are on-model** (a person wearing the item). rembg removes the background, not the person, so those cut-outs include face, arms and legs and the colour can pick up skin or hair. This is the PRD's "mixed lifestyle photos" risk. It will matter for the phase 5 mannequin.
- **Colour naming is coarse.** The reference palette uses saturated web colours (navy `#000080`), but real garments photograph darker, so dark blues are named black (13 of the misses) and shaded whites are named grey (13). The hex value is more reliable than the name.
- Unmapped article types: Kurtis, Sarees, Suits, Dresses, Sweatshirts, Kurta Sets and others (14,506 rows were unmappable).
- Admin upload does not run the cut-out or tagging yet (FR-13); `apply_image_pipeline` and `make process-images` are the building blocks.

## How to run it
```
make models
make import-catalog SOURCE=/path/to/kaggle-folder LIMIT=150
apps/server/venv/bin/python apps/server/manage.py evaluate_catalog_colors
```
The Kaggle folder needs `styles.csv` and `images/<id>.jpg`. Single files can be fetched with the Kaggle CLI (`kaggle datasets download -d paramaggarwal/fashion-product-images-dataset -f fashion-dataset/fashion-dataset/images/<id>.jpg`), so the 25 GB zip is not needed.

## Open items for later phases
- Cloth segmentation (`u2net_cloth_seg`) or flat-lay-only selection for on-model photos (before phase 5).
- Data-driven colour anchors, scored on held-out items, to fix dark-blue and white naming.
- Wire cut-out and colour into admin upload; categories and colours as tables (FR-14, phase 4).
