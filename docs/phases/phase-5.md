# Phase 5: Layered 2D mannequin (plus fixes from the first hands-on review)

Status: done with open items. The mannequin works in the shop's preview and on the Complete Outfit page, on the real 356-product catalog. The bodies are procedural placeholders, not MPFB renders.

## Goal
Show a complete look on a body: three sizes (FR-11), front and back (FR-12), garments placed in layers (FR-10).

## What changed
- **Bodies and anchors:** [tools/generate_mannequin_bodies.py](../../tools/generate_mannequin_bodies.py) draws 12 neutral bodies (men and women, slim, regular, plus, front and back, 800 x 1600 transparent PNG) into `apps/web/public/mannequin/` and writes `anchors.json`: the box where each slot's garment goes, derived from the same geometry as the drawing (`make mannequin`).
- **Layout engine** ([layout.ts](../../apps/web/src/features/mannequin/layout.ts), 19 unit tests): garment to slot box as percentages of the canvas, layer order bottom, top, outerwear, shoes, accessories, `object-fit: contain` so a garment keeps its proportions, a back view that uses a back photo or falls back to the front with a note, ties and sunglasses hidden from the back, a reason for every garment that cannot be placed, and waist-to-size mapping (slim 30-32, regular 34-38, plus 40+).
- **Components:** `Mannequin` (body, layers, front/back and size buttons, notes), a side panel on the Complete Outfit page that updates live when a piece is swapped, and `OutfitPreviewModal`, which replaces the old grey-pill "Virtual Mannequin Preview" in the shop.
- **Garment preparation** ([catalog/engine/mannequin.py](../../apps/server/catalog/engine/mannequin.py)): `prepare_mannequin_assets` (`make mannequin-assets`) assesses every product photo and saves a trimmed, garment-only image. Face (MediaPipe) and skin checks flag photos of people. For apparel it then cuts the garment out of the model photo with rembg's `u2net_cloth_seg` model (upper layer for tops and outerwear, lower for trousers, upper plus full for kurtas).
- **Profile and API:** `body_preset` on `UserProfile` (remembered for signed-in shoppers); products carry `mannequin_image`, `back_image`, `mannequin_ready`, `mannequin_note`; the look response names the body gender. The look builder prefers pieces that can be drawn.
- **Models:** `u2net_cloth_seg` (176 MB) added to `make models`.

## Fixes from the first hands-on review (the screenshots)
- **Signup:** the password rule is now a 6-character minimum only (no similarity, common-password or numeric checks). The form has a confirm-password field, checked in the browser and on the server (`password_confirm`). A server crash now returns a JSON message ("Something went wrong on our side") instead of an HTML page that showed as "Request failed (500)".
- **Alerts to toasts:** all 34 `alert()` calls now go through `notify()`, which draws short toasts (bottom of the screen, auto-dismiss, success or error colour). The Roman Urdu admin text is now English.
- **Dynamic categories and styles (FR-14):** `Category` and `Style` tables with API, Django admin and a "Categories & Styles" screen in the admin. The shop, the admin product form, the profile and product validation all read them. 29 categories and 5 styles are seeded, including women's, regional (Shalwar Kameez, Waistcoat, Kurta, Dupatta, Shalwar) and unisex ones (Watches, Belts, Ties, Caps, Sunglasses). Products must use an active category and style.
- **More products:** the importer now also takes Kurtis, Tunics, Skirts, Patiala, Nehru jackets, Stoles, sweatshirts and sweaters, and spreads across article types. The demo catalog went from 161 to 356 products.
- **"Same shirt everywhere", face scan 503 and register 500:** the browser was running the main checkout, where the gitignored `media/` and `ml_models/` folders were missing and the database had newer migrations than the code. Copied the folders and merged the code. The scan error now says what really happened (for example the model is missing) instead of "Make sure Django backend is running".

## Decisions and why
- **Procedural bodies instead of MPFB:** Blender and its assets are a multi-gigabyte install and a headless render pipeline, on a laptop with 15 GB free. The anchor map is data, so MPFB renders can replace the PNGs later.
- **Cloth segmentation on a white background.** The cloth model reads a black background as dark clothing (black wedges between trouser legs, holes in dark tops); on white those cases came out clean.
- **A photo of a person is detected three ways:** a face, visible skin (apparel only, because brown shoes and sunglasses are skin-coloured), or clothing in the other body layer (a shirt hem above trousers). Outerwear is not judged by the other layer: the model labels part of a flat blazer as "lower body".
- **Dynamic taxonomy stays soft-linked:** `Product.category` is text checked against the table when saved, so renaming a category does not rewrite products.
- **Password rule:** the project is a student prototype; the stricter validators are one settings line to bring back.

## Gates (real output)
```
make test:        427 passed (backend)   Tests 99 passed (web)   tsc + eslint clean
make build:       passed
make test-models: 10 passed (real MediaPipe, rembg isnet and cloth models)
make e2e:         41 scenarios (see STATUS.md for the final line)
```
The end-to-end suite runs on ports 3100 and 8100 when `E2E_WEB_PORT` and `E2E_API_PORT` are set, so it never reuses someone's dev servers from another checkout.

## Real-catalog results
- Mannequin preparation, first 161 products: 150 ready (93%): 85 clean photos kept, 65 garments cut out of model photos; 11 not ready (5 person, 3 could not separate, 3 skin).
- After adding women's and regional products (356 in total): **331 ready (93%)**. Of the 195 new products, 99 were clean photos and 82 were extracted from model photos; 14 were not usable (9 could not be separated, 4 person, 1 skin).
- Looked at sheets of flagged and extracted garments: tops, kurtas, jackets and trousers extract cleanly; flaws seen are a hair strand above a collar, a black tank top that vanished on white (now reported as "could not be separated") and stray fragments on a few dark garments.
- Seen in the browser: a red polo cut out of a model photo, khaki chinos and sunglasses on the regular men's body.

## Known limitations
- Bodies are simple grey shapes. Garments are placed by box, so a loose kurta or a wide jacket can overhang, and pieces do not drape.
- No product has a back photo, so the back view shows the front of each garment with a note.
- Placement on the mannequin was checked by eye and by browser tests that count layers and sizes; there is no measure of how realistic it looks.
- Extraction quality varies; about 7% of products still cannot be placed.
- Demo prices on the imported products are placeholders from `make demo-catalog`.
- Favourite colours still have no screen; the admin cannot upload a back photo yet.

## How to run it
```
make models                    # includes the cloth model
make mannequin-assets          # after importing or adding products
make mannequin                 # only to redraw the bodies
```

## Open items for later phases
- Phase 6: server-side cart (the whole look still goes to the browser cart), multi-item orders, FashionCLIP tagging.
- Real MPFB renders and a back photo field in admin upload.
- Wire the cut-out and mannequin preparation into admin product upload (FR-13).
