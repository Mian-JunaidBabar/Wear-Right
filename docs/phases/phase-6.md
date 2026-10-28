# Phase 6: Basic flat 2D SVG mannequin

Status: done with open items. Date: 2026-10-28. Branch: `feat/password-reset` (plan 02 commit `5766a69`, childrenswear/gender follow-up `cf8fe97`).

## Goal

Replace the grey statue and pasted product photos with a basic 2D mannequin that can draw every product in the catalogue, in the colours the recommender chose, on a body in the shopper's size.

## What changed

- `apps/web/src/features/mannequin/geometry.ts`: one set of body key points per gender, plus `slim | regular | plus` horizontal scaling. Pure data and functions.
- `apps/web/src/features/mannequin/garments.ts`: one vector shape per garment kind (tops, bottoms, outerwear, footwear, accessories), generated from the body points. Shoes return a left and a right path; the watch is drawn at the wrist point.
- `apps/web/src/features/mannequin/layout.ts`: rewritten to layer the anchor and look picks by slot and z-order, drop a second item for an occupied slot, and list undrawable items (bags) separately.
- `apps/web/src/components/Mannequin.tsx`: renders one `<svg viewBox="0 0 400 800">` with exposed `data-part`, `data-testid="mannequin-layer"`, `data-kind`, `data-product-id`, `data-anchor` and `data-foot` hooks. Slim/Regular/Plus remain; the photo Front/Back toggle is gone.
- `CompleteOutfitView.tsx` and `OutfitPreviewModal.tsx` use the new layout and pass the shopper's gender to the look API. The opened product is always a layer, badged "Your pick".
- `catalog/engine/color.py` and `catalog/serializers.py`: `Product.display_hex` gives one colour fallback chain (`color_hex` → `primary_color.hex` → named colour table → grey) for the mannequin and the recommender.
- `public/mannequin/*.png` and `public/mannequin/anchors.json` were deleted. The unused Django mannequin-image pipeline and its tests remain.
- Tests: rewritten `mannequin/layout.test.ts`, new `garments.test.ts` (every kind, both genders, all presets, two shoes, watch overlaps the left wrist, nothing outside the canvas), rewritten `e2e/10-mannequin.spec.ts`, and backend `display_hex` coverage. `catalog/engine/kinds.py` and its tests were tightened so Boys/Girls/Baby/Infant names are childrenswear.

## Decisions and why

- **Draw garments, do not paste photos.** Most admin products have no processed `mannequin_image`, and the pipeline refuses photos of people, so the old mannequin silently skipped the product the shopper opened. A vector shape exists for every product and cannot fail that way.
- **Two shoes and a wrist watch are geometry, not anchor boxes.** The feet and wrists are known points on our own body, so the pair and the watch placement are guaranteed by construction instead of by a hand-tuned box per photo.
- **One front view.** There are no back photos to compose with; a flat back would add work without adding information. The Front/Back control was removed.
- **The anchor owns its slot.** If the look engine or the layout sees a second top, the shopper's opened product wins.
- **The backend photo pipeline stays.** It is unused by the web app but harmless, tested, and may support future work; removing it would be unrelated churn.

## Gates (real output)

Run in this branch on 2026-10-28 after plans 00–03:

```
backend pytest     531 passed, 9 skipped (27.73s)
web vitest         117 passed (13 files, 3.79s)
tsc --noEmit       clean
eslint             0 errors, 2 warnings (unused-disable in AdminView, unused refreshProducts in ShopView)
next build         passed (after the Next.js 16.4.0 security advisory retry)
Playwright         not run here; the lead runs `make e2e` after the branch is reviewed
```

## Real-model checks

None. The mannequin is deterministic geometry; no ML model or weights are involved in this phase.

## Known limitations

- Flat front view only: no back view, draping, fabric, poses or body diversity beyond the three width presets.
- The body is a neutral tone, not the shopper's detected skin tone.
- Bags and unknown accessories are listed under the mannequin, not drawn.
- Garment shapes are a recognisable fashion-flat approximation, not a tailored fit.
- The backend image-compositing pipeline still exists but is no longer reachable from the shop UI.

## How to run it

Open any product in the shop and choose **Preview Outfit**, or open `/complete-outfit`. Switch Slim / Regular / Plus to resize the body.

## Open items for later phases

- Photo-realistic or layered try-on, back view, poses and drape.
- Tint the body with the shopper's detected skin tone.
- Measure whether the mannequin helps shoppers understand an outfit (Phase 8 user study).
