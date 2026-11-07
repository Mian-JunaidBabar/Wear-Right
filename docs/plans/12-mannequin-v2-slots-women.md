# Plan 12: Mannequin (alpha) v2: women's base, suits, waistcoats, kurtas, shalwar, sunglasses, caps

Written 2026-11-07 by the lead. Builds on the working men's pilot (plan 11, code in `catalog/engine/alpha_layers.py`,
`catalog/alpha_*.py`, `/mannequin`). Read STATUS.md "Mannequin (alpha)" first.

## What changes for the user

- A **Men | Women** switch on `/mannequin`. Women get their own base photo.
- New rows on the dressing room: **Kurtas**, **Waistcoats & blazers** (worn over a shirt or kurta), **Sunglasses**, **Caps**.
- Suits are two products worn together: a blazer (outerwear) + matching trousers (bottom).
- A kurta replaces the shirt (you cannot wear both); picking one takes the other off.

## Inputs (made by Hammad, see `extras/mannequin-alpha-kit/GUIDE-ROMAN-URDU.md`)

`extras/mannequin-alpha-kit/` now holds `base/men.png`, `base/women.png`, `renders/*.png` and one `manifest.csv` with
40 rows and a new **`gender`** column and a new **`product_name`** column. New slot values: `kurta`, `outerwear`,
`eyewear`, `headwear`.

Two pilot products are seed products with **no `external_id`**: "Black Formal Trouser" and "Olive Green Tailored Blazer".
One product does not exist yet: **"Olive Suit Trousers"**. Before importing, the lead creates it in the admin
(men, Bottom / trousers, olive green, the photo is `apps/server/seed_media/products/olive_green_trousers.png`, a demo price).

## Part A: engine (`catalog/engine/alpha_layers.py`), with a gate

Keep every existing behaviour and test. Add:

1. `SLOTS = ("top", "kurta", "outerwear", "bottom", "shoes", "watch", "eyewear", "headwear")`, labels: Shirts, Kurtas,
   Waistcoats & blazers, Trousers & shalwar, Shoes, Watches, Sunglasses, Caps.
2. `Z_ORDER = {shoes: 1, bottom: 2, base_bottom: 2, top: 3, kurta: 3, base_top: 3, outerwear: 4, watch: 5, eyewear: 6, headwear: 7}`.
3. The segmenter returns `(upper, lower, full)`. `cloth_masks_from_predict` already reads the masks; make it return the third
   (full-body / dress) mask too, and update the callers and fakes. Keep a 2-tuple working in tests by padding with an empty mask.
4. `build_layer` for the new slots:
   - **kurta**: `mask = largest((changed & torso_to_knee) | upper | full)` where `torso_to_knee` is the rows from the top of
     the base top (`base_upper`) to 0.80 of the height, limited to `dilate(base_upper | base_lower, 61)`. Fill holes.
     No `& ~lower` (a kurta covers the top of the trousers on purpose). Women's kurta with dupatta is the same slot.
   - **outerwear** (blazer, waistcoat): `mask = changed & dilate(base_upper, 41)` (no cloth mask: the tee inside an open
     blazer did not change, so it stays transparent and the chosen shirt shows through). Close (7 px), keep the 2 largest
     parts (an open blazer can be two panels), **do not fill holes**.
   - **bottom**: widen the reach for wide garments. Use `dilate(base_lower, 81)` instead of 31, so a patiala shalwar or a
     skirt is not cut at the sides. Check that the men's 3 bottoms from plan 11 still pass.
   - **eyewear**: band (0.0, 0.25), like watch (open 3, close 7, largest 1, fill holes).
   - **headwear**: band (0.0, 0.20), largest 1, fill holes.
5. `problems()`: outerwear expects at least 1 part (not exactly 1).
6. Tests (synthetic, like `test_alpha_layers.py`): kurta reaches below the tee hem and keeps the trousers below it untouched;
   an open blazer leaves the tee in the middle transparent; a wide bottom wider than the base trousers is not clipped;
   sunglasses and cap stay inside their bands; z-order puts outerwear over kurta and eyewear over everything below it.

**Gate:** Hammad first sends `base/women.png` + WT1, WK1, WB2, MO3 (see the guide). Add a command
`alpha_preview --source DIR --gender women --codes WT1,WK1,WB2 --out docs/phases/phase-6-screens/alpha/v2-gate/` that cuts
those layers **without saving to the database** and writes each layer on the base, plus composites (WT1 + WB2,
WK1 + WB2, and for men MO3 over T2 and MO3 over a kurta when it exists). Stop and report with the images. Do not loosen
thresholds to make a render pass; a rejected render goes back to Hammad.

## Part B: import

1. `manifest.csv` `gender` column: `import_alpha_kit` only processes rows whose gender matches `--gender`
   (rows with no gender column or an empty value count as `men`, so the old manifest still works).
2. Product lookup: `external_id` if set, otherwise `product_name` (exact, case-insensitive; if more than one product has
   that name, skip the row with "ambiguous product_name"). Report which one matched.
3. Accept the new slots. A product's own `slot`/`kind` is not changed by the import.
4. Tests: gender filtering, the name fallback, the ambiguous name, and the new slots accepted.

## Part C: API and web

1. `GET /api/mannequin/alpha/?gender=women` already works per gender; nothing to change except the new slots in the response.
2. `features/mannequin/api.ts`: extend `AlphaSlot`.
3. `features/mannequin/dressingRoom.ts`:
   - `Outfit` gets the new keys.
   - Exclusive pairs: picking a `kurta` clears `top`, picking a `top` clears `kurta` (`toggleItem` handles it).
   - `defaultOutfit`: first item of every slot **except** `kurta`, `outerwear`, `eyewear`, `headwear` (start with a plain
     shirt + trousers + shoes + watch; the extras are opt-in). The focus product still goes in its slot (and clears the
     exclusive one).
   - `layerStack`: "wears a top" means `top` **or** `kurta`. base_bottom when a top/kurta is worn without a bottom;
     base_top when a bottom is worn without a top/kurta.
   - `shuffleOutfit`: never picks both top and kurta; picks outerwear/eyewear/headwear with 50 % chance each.
   - vitest for each rule above.
4. `DressingRoomView.tsx`: Men | Women segmented switch at the top (`?gender=women` in the URL, default men). Refetch per
   gender. The `?product=` focus decides the gender when given (fetch both, pick the one that has the product).
5. `ProductDetailView.tsx`: check the product's own gender wardrobe (`product.gender`, fallback men) for the
   "Try it on the mannequin" button, and link with `?gender=...&product=...`.

## Part D: run it and report

1. Lead creates "Olive Suit Trousers" (see Inputs). `make migrate` (no new migration expected).
2. `make alpha-import SOURCE=extras/mannequin-alpha-kit GENDER=men` then `... GENDER=women`; paste both tables.
3. `make test`, `npm --prefix apps/web run build`. No Playwright.
4. By hand on `/mannequin`: both genders; a suit (blazer + its trousers + formal shoes); kurta + shalwar + chappal +
   waistcoat; women kurta with dupatta + patiala; skirt + heels; sunglasses and cap on and off; kurta and shirt exclusive;
   phone width. Screenshots to `docs/phases/phase-6-screens/alpha/v2/`.
5. Docs: STATUS.md decision updated (slots, women), phase-6.md section, plans README.

## Out of scope

Ties (the base wears a tee; a tie needs a collared shirt), bags and jewellery, women's base in other skin tones,
generating anything live.
