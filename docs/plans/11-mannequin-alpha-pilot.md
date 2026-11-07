# Plan 11: Mannequin (alpha), men's pilot: 10 products, stacked layers + hero looks

Written 2026-11-06 by the lead. **Supersedes plan 10** (never implemented). It keeps plan 10's idea: curated products, one fixed base image, layers that line up by construction. It changes how the renders are made (the team uses Nano Banana Pro in the Gemini app by hand), adds an alignment step because Gemini regenerates the whole image on every edit, and adds full-look renders for the demo.

The outfit board (plan 08) stays the default everywhere. The mannequin is an extra tab that only appears for alpha products.

## Why this shape

| Option | Verdict |
| --- | --- |
| Live try-on on the shopper's photo (FASHN, CatVTON) | Needs 8 GB+ VRAM. Our laptops have a 4 GB T1000, and UOL's GPUs arrive after the degree ends. Future work. |
| One full-look render per combination | Looks best, but 3 shirts × 3 trousers × 2 shoes × 2 watches = 36 images for 10 products, and it grows multiplicatively. Kept for 3 hero looks only. |
| **One render per product on a fixed base, cut out and stacked** | 1 render per product, any combination works, instant in the browser. Risk: Gemini moves the body a few pixels between edits. Handled by aligning every render to the base before cutting, and by rejecting renders whose pose moved. |

## Inputs (made by the team, see the kit's `GUIDE.md`)

`/home/jb/Projects/Wear-Right/extras/mannequin-alpha-kit/` (`extras/` is gitignored, so a worktree does not have it; the path is passed to the commands, never hard-coded):

```
base/men.png        AI-generated base model, portrait 3:4, white tee, grey trousers, white sneakers
renders/<CODE>_<external_id>.png   one edit of the base per product, only that item swapped
looks/L1.png ...    full-look renders
manifest.csv        code,external_id,slot,product,ref_file,render_file,status,tries,notes
looks.csv           look_id,name,top,bottom,shoes,watch,tuck,render_file,status,tries,notes
```

`external_id` is `Product.external_id` (Kaggle id). Slots in the CSV: `top`, `bottom`, `shoes`, `watch`. Rows whose `status` is not `done` are skipped and reported.

Pilot products (men): T1 20024, T2 33065, T3 53775 (tops); B1 31562, B2 26838, B3 11311 (bottoms); S1 10149, S2 49434 (shoes); W1 31814, W2 37314 (watches). If any of these ids is missing from the database, or has the wrong `gender`/`slot`, the import reports it. Do not change the product rows yourself; list them in the report.

## Part A: engine and the pilot gate (do this first, then stop and report)

`apps/server/catalog/engine/alpha_layers.py`: pure Python (OpenCV, NumPy, Pillow), no Django imports.

Canonical canvas: **768 × 1024**. Every base, render and layer is converted to it (resize to fit, pad with the base's corner colour; a 3:4 input is a plain resize).

1. `normalise(image) -> np.ndarray`: RGB uint8, 768 × 1024.
2. `default_regions(base) -> dict`: coarse boxes as fractions of the person's bounding box, found with the existing rembg person cut-out (`catalog.engine.cutout.rembg_remover`):
   `top` (shoulders to below the hip, full width including arms), `bottom` (waist to ankles), `shoes` (ankles to floor), `wrist_left` / `wrist_right` (boxes around the bottom of each arm). Save as `base/men.regions.json` next to the base. The team can edit the numbers by hand. `alpha_regions --preview` draws them on the base so they can be checked.
3. `align(base, render, slot, regions) -> (aligned, AlignReport)`:
   - ORB (5000 features) on grayscale, with the slot's region (dilated 20 px) **masked out of both images**, so the matches come from parts that should not change (face, hair, hands, other clothes, floor edge).
   - Brute-force Hamming matching with cross-check, then `cv2.estimateAffinePartial2D` with RANSAC (3 px). Then refine with `cv2.findTransformECC` (`MOTION_AFFINE`, same mask). If ORB finds too few matches, use ECC alone from the identity.
   - Report: matches, inliers, scale, rotation (degrees), translation (px), method used.
   - **Reject** (starting thresholds, constants at the top of the module, documented as starting values): inliers < 40 (when ORB was used), |scale − 1| > 0.06, |rotation| > 3°.
4. `pose_check(base, aligned, slot, regions) -> PoseReport`: after alignment, the share of pixels **outside** the slot region (dilated 15 px) whose colour difference (ΔE in Lab) is > 12, reported for the whole keep area and separately for the face box (top of the person box). **Reject** if keep > 4 % or face > 6 % (starting values). This is the "did Gemini move the body" check.
5. `extract_layer(base, aligned, slot, regions, cloth_masks) -> (RGBA, LayerReport)`:
   - `diff` = ΔE(base, aligned) after a 3 px Gaussian blur, thresholded (start at 10).
   - Restricted to the slot region (`watch`: the two wrist boxes; keep the component that overlaps the left-wrist box, falling back to the larger one).
   - Use the cloth masks from rembg's `u2net_cloth_seg` on the **aligned render** (`catalog.engine.cutout.cloth_remover`; check how this rembg version returns the three masks (upper, lower, full) and write a small adapter with a unit test). For `top`, remove pixels the cloth model calls *lower body*. For `bottom`, remove *upper body* pixels. This stops a top layer from carrying bits of the base's grey trousers, and a bottom layer from carrying the tee.
   - Clean-up: morphological close (5 px), fill holes, keep the largest component (`shoes`: the two largest), 2 px feathered alpha.
   - The layer's pixels come from the aligned render. Output: transparent PNG on the 768 × 1024 canvas.
   - Report: layer area as a share of its region, number of components, mean ΔE inside.
6. `composite(base, layers) -> RGB`, for previews only. Z-order: base → shoes → bottom → top → watch.

Management commands (`catalog/management/commands/`):

- `alpha_regions --base PATH [--preview OUT.png]`: writes or previews `regions.json`.
- `alpha_check --base PATH --render PATH --slot top|bottom|shoes|watch --out DIR`: runs align + pose check + extract, prints the three reports and PASS/REJECT with the reason, and writes `aligned.png`, `layer.png`, `composite.png` and `diff_overlay.png` (the base with changed pixels tinted) to DIR. No database needed.

Tests (`catalog/tests/test_alpha_layers.py`, synthetic images only, no model weights):
- A synthetic "person" (shapes on a grey canvas) plus a render where the torso rectangle changes colour and the whole image is shifted (6, −4) px and scaled 1.02: `align` recovers the transform within 1 px / 0.005, `extract_layer` returns a mask inside the torso box covering ≥ 90 % of the changed rectangle, and `pose_check` passes.
- The same render but with the "head" moved 25 px: `pose_check` rejects with a face reason.
- Shoes: two changed foot boxes give two components.
- `composite` z-order: a pixel covered by both top and bottom layers takes the top's colour.
- Cloth-mask adapter: shape and dtype on a dummy input (mock the session).
- One `@pytest.mark.models` test runs the real `u2net_cloth_seg` weights on `ml_models/` test assets and checks that three masks come back (skips when the weights are missing). If the cloth model is not yet in `download_models.py`, add it there.

**Gate:** the team will have `base/men.png`, `renders/T1_20024.png` and `renders/B1_31562.png` ready. Run `alpha_regions --preview`, then `alpha_check` on both renders, and put the four output images per render in `docs/phases/phase-6-screens/alpha/gate/`. **Stop and report** the printed reports and your judgment: do the layers cover only the shirt / only the trousers, with clean edges? Do not start Part B until the lead says go. If a render is rejected, say so plainly. The team will re-render; do not loosen thresholds to make a render pass.

## Part B: data and import (after the lead's go)

Models in `catalog/models.py` (extend `TimeStampedModel`, one migration):

- `MannequinBase`: `gender` (men/women), `image`, `regions` (JSON), `label` (default "AI-generated model"), `is_active`. One active base per gender (service-enforced).
- `MannequinLayer`: `product` FK, `base` FK, `slot` (top/bottom/shoes/watch), `render` (the original Gemini image, kept for audit), `image` (layer PNG), `source` (default `gemini_app`), `report` (JSON: align/pose/layer reports), `status` (`pending` / `rejected` / `approved`), `note`. Unique on (product, base).
- `MannequinLook`: `base` FK, `name`, `image`, `top`/`bottom`/`shoes`/`watch` (nullable FKs to Product), `source`, `status` (`pending` / `approved`).

Files under `MEDIA_ROOT/mannequin_alpha/{base,renders,layers,looks}/`.

`catalog/services.py` (or a new `catalog/alpha_services.py` if services.py gets long):
- `import_alpha_kit(*, source_dir, gender, rebuild=False) -> ImportResult`: reads `base/`, `manifest.csv`, `looks.csv`, creates or updates the base, and runs `build_layer` for every `done` row. Idempotent: an unchanged render file (same SHA-256) is skipped unless `rebuild`. Rejected renders are stored as `rejected` with the reason. Unknown `external_id`, or a product whose gender/slot does not match, gives an error row; nothing is created for it.
- `build_layer(*, product, base, render_file, slot) -> MannequinLayer` (status `pending` or `rejected`).
- `set_layer_status(*, layer, status, note='')` and `set_look_status(...)`. Approving a rejected layer is refused.

Commands:
- `import_alpha_mannequin --source DIR --gender men [--rebuild]` prints one row per render: code, product, PASS/REJECT, reason, inliers, keep %. Then the looks.
- `alpha_preview --gender men --out DIR` writes a composite PNG for every top × bottom with S1 + W1, every shoe on T2 + B2, and every watch on T3 + B3, plus a side-by-side of each layer next to its product photo. Uses `pending` and `approved` layers and marks pending ones in the file name.
- Makefile: `alpha-import` (`SOURCE=` required) and `alpha-preview` (`OUT=` defaulting to `docs/phases/phase-6-screens/alpha/previews`).

## Part C: API

Shop (read-only, `AllowAny`), in `catalog/urls.py`:
- `GET /api/mannequin/alpha/?gender=men&products=<id>,<id>,...` (product primary keys; the look's anchor first). Selector `resolve_alpha_look` returns:
  ```json
  {
    "mode": "look" | "layers" | "partial" | "none",
    "base": {"image": "...", "width": 768, "height": 1024, "label": "AI-generated model"},
    "look": {"id": 1, "name": "Smart casual", "image": "..."} | null,
    "layers": [{"product_id": 7, "slot": "top", "image": "...", "z": 3}],
    "missing": [{"product_id": 9, "name": "...", "reason": "not in the alpha yet"}]
  }
  ```
  Rules: an **approved** look whose set of products equals the requested ones (ignoring slots that are not top/bottom/shoes/watch) → `look`. Otherwise, approved layers for the requested products → `layers` if every requested product in those four slots has one, `partial` if only some do, `none` if the anchor has none. Accessories other than watches go to `missing` with reason "not shown on the mannequin".
- `ProductSerializer` gains read-only `alpha_mannequin: bool` (approved layer exists). Use an `Exists` annotation in the product selectors so the list does not do N+1 queries.
- Products list filter `?mannequin=alpha`.

Admin, under `/api/admin/mannequin/` in `staff` (cookie auth and RBAC like the other admin endpoints): list layers (`products.view`), list looks (`products.view`), `PATCH` the status of a layer or look (`products.manage`), and `POST layers/<id>/rebuild/` with an optional new render upload (`products.manage`), which re-runs `build_layer`.

Every endpoint gets pytest tests for the status code and the response shape, plus the four `mode` cases, approved-only, the 403 without `products.manage`, and the product filter.

## Part D: web

- `lib/api.ts`: one function per endpoint above. `features/mannequin-alpha/useAlphaMannequin.ts` is the hook that takes the look's product ids and returns the resolve response.
- `components/AlphaMannequin.tsx`: a box at the base's aspect ratio. `look` mode: one `<img>`. `layers` / `partial` mode: the base `<img>` plus each layer as an absolutely positioned `<img>` at 100 % width/height, z from the API. Always shows a chip "Mannequin preview · alpha · AI-generated model", and lists `missing` under it ("Not on the mannequin yet: …"). All images go through `ProductImage` or the same placeholder fallback.
- `CompleteOutfitView` and `OutfitPreviewModal`: tabs "Outfit board | Mannequin (alpha)". The outfit board stays the default. The mannequin tab is enabled only when the anchor product has `alpha_mannequin`; otherwise it is hidden, not disabled with a scary message. Swapping a piece updates the mannequin (re-resolve). Prefetch the layer images so a swap does not flash.
- `ProductDetailView`: for alpha products, a "See it on the mannequin (alpha)" button opening the preview modal on the mannequin tab.
- `ShopView`: a small "Mannequin preview" badge on alpha product cards, and a filter toggle that uses `?mannequin=alpha`.
- Admin: a "Mannequin (alpha)" section (add it to `features/admin/sections.ts`, gated by `products.view`). It shows a grid of layers: product photo, layer on the base, report numbers, and status with Approve/Reject buttons (`products.manage`) and "Upload new render". It also lists the looks with Approve.
- vitest: z-order of the stacked `<img>`s, `look` mode renders one image, the tab is hidden when the anchor is not alpha, the `missing` list, the badge and the filter param.

## Part E: run it on the pilot and report

1. `make alpha-import SOURCE=/home/jb/Projects/Wear-Right/extras/mannequin-alpha-kit` and paste the real table.
2. `make alpha-preview` and look at every composite. Write `docs/phases/phase-6-screens/alpha/REVIEW.md` with one line per layer (good / visible seam / wrong item / rejected) and one per composite. Be blunt.
3. Approve in the admin only the layers and looks that look right. Then check by hand in the browser: open each alpha product, open its look on the mannequin tab, swap the shirt, trousers, shoes and watch, check that a non-alpha product has no mannequin tab, and check a phone-width viewport.
4. Docs: `docs/STATUS.md` (decision: alpha mannequin, how it works, thresholds as starting values, open issues), `docs/DEMO.md` (a demo step that uses a hero look first, then one live swap), `docs/phases/phase-6.md` (add the approaches-tried table above and the thesis wording below), and `docs/plans/README.md`.

Testing policy (from `docs/plans/README.md`): `make test` and `npm --prefix apps/web run build` before reporting. **No Playwright / make e2e.** If an e2e spec covers the outfit preview, update it to the tabs but do not run it.

Report: commits, real test/build output, the import table, REVIEW.md, screenshots, and what is still weak.

## Out of scope

Women's set, eastern wear, more than 10 products, skin-tone variants of the base model, any live generation or calling Gemini/HF from the app, and changes to the recommender or the skin tone engine.

## Thesis wording

"Mannequin preview (alpha): for a curated set of products, garment renders were produced offline with Google Gemini (Nano Banana Pro) from the shop's own product photos on one fixed AI-generated model image. Our pipeline aligns each render to the base image (ORB + RANSAC, ECC refinement), rejects renders whose pose changed, extracts the garment layer (colour difference restricted by body region and cloth segmentation) and composites the layers in the browser, so any combination of alpha products is shown instantly. Live try-on for arbitrary products on the shopper's own photo requires a GPU with at least 8 GB of VRAM and is future work."
