# Phase 2: Catalogue and admin CRUD

Status: done with open items. Date: 2026-10-27. Branch: `agent/functional-m1`.

## Goal

Make the catalogue real and editable: categories/colours/products with validated images, server-side filtering and pagination, staff-only write access, an import path for the Kaggle catalogue, and admin screens that can create, edit, hide and delete products.

## What changed

- Backend models (`apps/server/catalog/models.py`): `Category.slug` + `slot`; new `Color` (name, hex, family); `Product.slug`, `description`, `category_ref` FK, `style`, `primary_color` FK, `sizes`, `is_active`. Legacy fields are retained and kept in sync.
- Migrations: `catalog/0005_phase2_catalog_crud.py`, `0006_phase2_populate_catalog.py`, `0007_phase2_slug_unique.py`.
- `catalog/serializers.py`: validation for image type/size (JPEG/PNG/WebP, 5 MB), price, sizes, category/style relations, colour sync and auto family from hex.
- `catalog/services.py` + `catalog/engine/color.py`: `suggest_colour(image)` using the existing Lab/k-means palette helper.
- `catalog/selectors.py`: public/staff visibility and filters for category, slot, gender, style, colour, price range, stock, search and ordering.
- `catalog/views.py` / `urls.py`: paginated products (12/page, max 500) with legacy keys preserved; staff CRUD for products/categories/styles/colours; `POST /api/products/color-suggestion/`; public read of colours.
- Frontend: shop pagination and filters; product size picker and buy-now into the cart; admin product form gained description, live image preview, colour suggestion, visible/hidden toggle, active-state column and eye action; API client supports pagination/colours/suggestions.
- Tests: `catalog/tests/test_phase2_api.py` (9 tests: pagination, filters, permissions, upload rejection, suggestion, taxonomy, tiny-CSV import fixture).

## Decisions and why

- **Compatibility relation instead of a destructive migration.** The recommender, mannequin and imported rows depend on legacy `category`/`cultural_tag`/stock columns. `category_ref` and `primary_color` were added and synchronised by serializers; this avoids breaking existing data and features while giving new code real relations.
- **Legacy response keys are still returned.** Old pages and tests expected `products` / `total_products`; new clients get `results` and pagination links. This is deliberate API compatibility, not a claim that pagination was always there.
- **Image validation is explicit.** Product writes are multipart; the serializer checks the actual content type and a 5 MB ceiling. Uploads are not silently resized.
- **Colour suggestion is advisory.** The dominant colour comes from visible pixels but is named by nearest reference colour; staff can override it. It is not a trained classifier.
- **Import is fixture-tested only.** The Kaggle archive is gitignored and absent, so the importer is exercised with a tiny CSV fixture. The real `make import-catalog SOURCE=...` path remains available and documented as pending verification.
- **Server pagination, client shop paging.** The backend supports all filters and pages; the current shop fetches the seeded catalogue with a large page size and pages client-side to preserve its existing filter UX. This is honest technical debt, not server-side filtering in the UI.

## Gates (real output)

Cumulative at the end of the functional work:

```
backend pytest     450 passed
web vitest          99 passed
tsc --noEmit        clean
eslint              clean (2 warnings)
next build          passed
manage.py check     no issues
makemigrations --check  no changes
```

Phase-specific backend tests: 9 passed in `catalog/tests/test_phase2_api.py`.

## Real-model checks

No model weights are needed for this phase. The colour helper uses OpenCV/Pillow locally. The importer fixture is synthetic; no full Kaggle import was performed in this checkout.

## Known limitations

- Demo/imported prices are placeholders unless an admin edits them.
- The small fixture does not prove the importer against the full Kaggle schema (article types, missing images, encoding quirks).
- The shop still performs client-side filtering; the server filters are tested but not yet the shop's single source of truth.
- Legacy category labels and the new taxonomy coexist; cleanup is a later refactor.

## How to run it

```bash
make demo-data
make import-catalog SOURCE=/path/to/kaggle-folder LIMIT=150   # optional
make process-images                                          # optional cut-outs/colours
```

## Open items for later phases

- Switch the shop to server filters and real page links.
- Run and review a full Kaggle import; reconcile unmapped article types.
- Retire legacy catalogue labels once mannequin/recommender no longer require them.
