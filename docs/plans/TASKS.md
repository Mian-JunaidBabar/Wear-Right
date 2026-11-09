# Wear Right: live task list (Mannequin v2 + skin tone flow)

## Completed plans

Move every plan that docs/STATUS.md marks done into `docs/plans/completed/` (step 0 of the agent prompt).
Sections below marked "Code written" still need the agent run before they count as completed.

This file is the one place to check what is done and what is left. `PROMPTS.md` is history; do not run old
prompts from it. Tick a box only after its "Check" passes.

- **Code written** = the code is in the repo, written by the lead, not yet run on this machine.
- **Agent** = the implementing agent does it (see the prompt at the bottom).

---

## A. Demo catalog (only the mannequin products, not the 44k Kaggle rows)

| #   | What                                                                                                                                                                                   | State                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | `import_fashion_catalog --ids-from <manifest.csv>` imports exactly the manifest's Kaggle ids                                                                                           | Verified ✓ 2026-11-08 (real kit: 37 selected, 37 already imported, 0 created)                                                                                                        |
| A2  | `publish_mannequin_demo` makes every mannequin product Active, priced and in stock (only fills blanks)                                                                                 | Verified ✓ 2026-11-08 (real kit: "Published 39 mannequin products")                                                                                                                  |
| A3  | `SHOP_MANNEQUIN_ONLY=True` (env) makes the shop list only products on the mannequin; staff still see all                                                                               | Verified ✓ 2026-11-08 (selector: anon=39 all `on_mannequin`, staff=357; `catalog.tests.test_alpha_mannequin_v2.test_mannequin_only_mode_hides_everything_else_from_shoppers` passes) |
| A4  | Products API returns `on_mannequin`; `?mannequin=1` filters to them                                                                                                                    | Verified ✓ 2026-11-08 (code + `test_alpha_mannequin_v2` mannequin-filter tests pass)                                                                                                 |
| A5  | Create the 3 products the manifest names without a Kaggle id (MB4 "Black Formal Trouser", MO2 "Olive Green Tailored Blazer", MB5 "Olive Suit Trousers") in the admin, men, exact names | Verified ✓ 2026-11-08 (already present in shared DB: id 1/11/360, men, active, priced, stocked, with photos)                                                                         |

Check:

```
cd apps/server
venv/bin/python manage.py import_fashion_catalog --source "<kaggle folder>" --ids-from ../../extras/mannequin-alpha-kit/manifest.csv
venv/bin/python manage.py import_alpha_mannequin --source ../../extras/mannequin-alpha-kit        # both genders
venv/bin/python manage.py publish_mannequin_demo
```

Then set `SHOP_MANNEQUIN_ONLY=True` in `apps/server/.env`, restart, open /shop: only mannequin products show.

## B. Mannequin v2 (all of Hammad's renders)

| #   | What                                                                                                                                                                         | State                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Engine: slots top, kurta, outerwear, bottom, shoes, watch, eyewear, headwear; kurta cut from the cloth "full" mask (**fixes the kameez crop bug**)                           | Verified ✓ 2026-11-08 (`test_alpha_layers` 8 passed; real import 39 layers approved, 0 rejected)                                                              |
| B2  | Engine: fair / dark copies cut with the wheatish mask; a copy where the item changed is dropped (falls back to wheatish)                                                     | Verified ✓ 2026-11-08 (real kit: men S1 dark dropped "difference 134"; women WB3 fair "difference 60"; women WS1 dark "difference 56"; fall back to wheatish) |
| B3  | Import: finds Hammad's files by code whatever the name (`M01.Fairpng`, `T1_20024 Fair`, `MB6.PNG`, `M01` for `MO1`), both genders from one manifest, `product_name` fallback | Verified ✓ 2026-11-08 (`test_alpha_mannequin_v2` name/gender cases pass; real kit matched codes across both genders)                                          |
| B4  | Import: fair / dark base photo, hand-made `base/<gender>-fair.png` if present, else assembled from small items                                                               | Verified ✓ 2026-11-08 (real kit: men bases fair+dark kept; women bases fair+dark derived)                                                                     |
| B5  | Model fields `image_fair`, `image_dark`, new slot choices: migration `0010_mannequin_v2`                                                                                     | Verified ✓ 2026-11-08 (`make migrate` applied catalog.0010_mannequin_v2)                                                                                      |
| B6  | Wardrobe API: base `skins`, item `layers` per skin, sizes, stock, `in_stock`, `groups`, `exclusive`                                                                          | Verified ✓ 2026-11-08 (`test_alpha_mannequin`/`test_alpha_mannequin_v2` wardrobe tests pass)                                                                  |
| B7  | `cloth_masks_from_predict` returns 3 masks (upper, lower, full)                                                                                                              | Verified ✓ 2026-11-08 (`test_alpha_layers` cloth_masks coverage passes)                                                                                       |

Expected import result (from the lead's run on the real files): every layer approved; these skin copies are
dropped and fall back to wheatish, which is fine: men MS4 dark, men S1 dark, women WB3 fair, women WS1 dark.

**Real-kit note (2026-11-08):** 39 layers approved, 0 rejected. Men S1 dark, women WB3 fair, women WS1 dark dropped as expected. MS4 was **skipped** ("product is women, base is men") because manifest MS4 external_id 32849 maps to a women's product in the Kaggle catalog (Grendha Women Roamance Brown Flats, id 77) — kit data mismatch, importer guard correct, thresholds unchanged. Men MK3 fair/dark **missing** (kit has no MK3 Fair/Dark files).

## C. Dressing room page (/mannequin)

| #   | What                                                                                                                              | State                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| C1  | Men / Women switch (default: `?gender=`, then profile gender)                                                                     | Verified ✓ 2026-11-08 (code + dressingRoom.test.ts 18 tests pass; web build clean) |
| C2  | Fair / Wheatish / Dark switch (default from the scan: Fair→fair, Medium→wheatish, Dark→dark); disabled when that base is missing  | Verified ✓ 2026-11-08 (code + dressingRoom.test.ts; build/type/lint clean)         |
| C3  | Picker grouped: Clothes / Shoes / Accessories. A kurta replaces the shirt. **Watch, sunglasses and cap can all be worn together** | Verified ✓ 2026-11-08 (`dressingRoom.test.ts` 18 tests pass)                       |
| C4  | "Add to cart" per worn item (size picker when the item has sizes) and "Add outfit to cart" (one at a time)                        | Verified ✓ 2026-11-08 (code present; build/type/lint clean)                        |
| C5  | Product page "Try it on the mannequin" uses the product's `on_mannequin` and gender                                               | Verified ✓ 2026-11-08 (code present; build/type/lint clean)                        |

## D. Shop

| #   | What                                                                                                                | State                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| D1  | Banner on the category page: "Try N products on the mannequin", "Only mannequin items" toggle, "Open dressing room" | Verified ✓ 2026-11-08 (code present; build/type/lint clean; removed unused `refreshProducts` dead code in ShopView.tsx) |
| D2  | "On mannequin" filter button in a category's filter bar; `?mannequin=1` opens with it on                            | Verified ✓ 2026-11-08 (code + `test_alpha_mannequin_v2` filter tests pass)                                              |
| D3  | "Try on mannequin" badge-button on each mannequin product card                                                      | Verified ✓ 2026-11-08 (code present; build/type/lint clean)                                                             |

## E. Admin: Mannequin page (decision: keep it, small)

Recommendation: **keep a small admin page**, do not skip it. Hammad's renders still go in through the kit import
(fast, bulk). The admin page is for checking the result and fixing one product without the command line.

| #   | What                                                                                                                                                                                                                                   | State                                                                                                                                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E1  | API `GET /api/admin/mannequin/layers/?gender=` (layers + checks + base photos), `POST` (multipart: product_id, slot, render, render_fair, render_dark), `PATCH <id>/ {approved}`, `DELETE <id>/`; RBAC products.view / products.manage | Verified ✓ 2026-11-08 (`catalog/tests/test_alpha_admin.py` 7 passed incl. RBAC fixes)                                                                                                                                                                                    |
| E2  | Admin web page "Mannequin" (see spec below)                                                                                                                                                                                            | Verified ✓ 2026-11-08 (built: `admin/MannequinSection.tsx` + `MannequinSection.test.tsx` 3 passed; wired in `features/admin/api.ts`, `sections.ts`, `AdminView.tsx`; `/admin/mannequin` added to `e2e/06-all-routes.spec.ts` [spec only, not run]; tsc/lint/build clean) |

E2 spec: a new tab in the admin sidebar, visible with `products.view`.

- Men / Women tabs. A grid of layer cards: the layer image over the base photo (two stacked `<img>`), product
  name, slot label, a green "Live" or grey "Hidden" chip, the note when rejected, and small "Fair ✓ / Dark ✓"
  marks from `skins`.
- Each card: "Hide" / "Show" (PATCH approved) and "Delete" (with confirm), only with `products.manage`.
- "Add render" form: product picker (search existing products), slot select (from `slots`), three file inputs
  (main render required, fair and dark optional). Show the response: green "Added" or red with `reason`.
- Instruction box above the form, exactly this text:
  > 1. Open the base photo for this gender (Download base) in Gemini.
  > 2. Upload the base photo and the product photo. Use the prompt from the guide for this slot.
  > 3. Only the product may change. Same pose, same crop, same background, same size (960 x 1280 or 3:4).
  > 4. Optional: make the same render with fair and dark skin (Prompts K and L in the guide).
  > 5. Upload here. If it says "does not line up", generate again; do not crop or resize the image yourself.
- "Download base" links to `bases[gender].image`.

## F. Skin tone: scan → colours → "yes" → clothes in that colour theme

| #   | What                                                                                                                                                           | State                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| F1  | Photo quality gate (yellow / blue light, side light, head turn, blur warning), thresholds in `scanner/engine/quality.py`, overridable with `SKIN_SCAN_QUALITY` | Verified ✓ 2026-11-08 (`scanner/tests/test_quality.py` 11 passed)                                                    |
| F2  | Scan API returns `quality` (checks) on success and on 422; the scan page lists failed / warned checks with the fix                                             | Verified ✓ 2026-11-08 (`scanner/tests/test_quality_api.py` 5 passed; web build/type/lint clean)                      |
| F3  | Colour presets per skin tone are admin-managed (Tone colour rules, already in the admin)                                                                       | Done earlier                                                                                                         |
| F4  | "Yes, that's me: show clothes in my colours" opens /recommended with `theme=palette`                                                                           | Verified ✓ 2026-11-08 (FaceScanView.tsx has new text; no old-text e2e/spec references remain; build/type/lint clean) |
| F5  | Recommended page: "Only my colours" / "All good matches" switch; tapping a best-colour swatch shows only that colour                                           | Verified ✓ 2026-11-08 (code present; build/type/lint clean)                                                          |
| F6  | Top picks API: `theme=palette` (or `palette_only=1`) keeps only good/best colours; `colour=<name>` keeps one colour                                            | Verified ✓ 2026-11-08 (`recommender/tests/test_colour_theme.py` 5 passed)                                            |

Check (manual, 5 minutes): scan under a yellow bulb → rejected with "Your light looks yellow"; scan facing a
window → result + palette; press the yes button → only clothes in the palette colours; tap a swatch → only that
colour; switch to "All good matches" → more items.

## G. Tests to run

| Test file                                                            | Covers                                                                      |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `catalog/tests/test_alpha_layers.py`                                 | engine, 3 cloth masks                                                       |
| `catalog/tests/test_alpha_mannequin.py`                              | v1 import + wardrobe API (updated for v2 fields)                            |
| `catalog/tests/test_alpha_mannequin_v2.py`                           | file names, genders, product names, skins, bases, demo publish, shop filter |
| `catalog/tests/test_alpha_admin.py`                                  | admin API                                                                   |
| `scanner/tests/test_quality.py`, `scanner/tests/test_quality_api.py` | photo gate                                                                  |
| `recommender/tests/test_colour_theme.py`                             | palette-only and single colour                                              |
| `apps/web/src/features/mannequin/dressingRoom.test.ts`               | dressing room logic                                                         |

---

## Agent prompt (paste as the first message of a fresh session)

```
You are working on Wear Right (FYP). Read CLAUDE.md, then docs/plans/TASKS.md. Ignore PROMPTS.md.

The lead wrote the code for sections A–F of TASKS.md; it has not been run on this machine. Your job:
make it run, make every test pass, build the one missing page (E2), and report.

0. `mkdir -p docs/plans/completed` and `git mv` every plan file that docs/STATUS.md lists as done into it
   (plus the old superseded ones, 06 and 07). Update links in docs/plans/README.md.
1. Branch feat/mannequin-v2 from the current branch. `make migrate` (applies catalog 0010).
2. Run the backend tests in TASKS.md section G, then `make test`. Fix real defects. Keep the layered
   architecture (engine pure, services write, selectors read, thin views). If a test is wrong rather than the
   code, fix the test and say why. Do not weaken thresholds to make a test pass.
3. Run the web unit tests (vitest) and `npm --prefix apps/web run lint` and `npm --prefix apps/web run build`.
   Fix type and lint errors in DressingRoomView.tsx, ShopView.tsx, ProductDetailView.tsx,
   RecommendedProductsView.tsx and FaceScanView.tsx. Update any existing test or e2e spec that looks for the
   old button text "Yes, that's me: show my clothes" (now "... show clothes in my colours").
4. Build E2 (admin Mannequin page) exactly as specified in TASKS.md, with a small vitest test.
5. Run the A "Check" commands on the real kit (extras/mannequin-alpha-kit) and paste the import table.
   Expect all layers approved and the 4 known skin copies dropped. If a layer is rejected, report its note;
   do not change engine thresholds.
6. Do NOT run Playwright or make e2e. Do not touch the Makefile.
7. Tick the boxes in TASKS.md that you verified, and add a dated line to docs/STATUS.md.
   Commit: code commit, then docs commit.

Report: real test/build output, the import table, every fix with its cause, and anything still failing.
```
