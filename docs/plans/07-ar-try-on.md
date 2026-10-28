# Plan 07: instant AR try-on (replaces plan 05)

## Decision (2026-10-28)

No image generation. The "instant try-on" seen in reels is **augmented reality**: a pose model tracks the body
(shoulders, hips, wrists, ankles) every frame and the garment's cut-out image is stretched onto those points.
It runs in the browser in real time on the team laptop (Quadro T1000 4 GB / i7), needs no cloud GPU, and is a fair
FYP-level USP. Plan 05 (diffusion try-on) is kept only as a "future work" note for the thesis.

**Why it works for us**

- Pose: MediaPipe **Pose Landmarker** (`@mediapipe/tasks-vision`, the *lite* model, a few MB, 33 body landmarks),
  real time on laptop CPUs/GPUs. We already use MediaPipe for the face scanner.
- Garment images: we already make transparent garment-only cut-outs (`catalog.services.prepare_mannequin_asset`,
  `make mannequin-assets`, stored in `Product.mannequin_image`). AR reuses them.
- Privacy: frames never leave the browser. Nothing is uploaded or stored. Good point for the thesis.

**Honest limits (say them in the thesis):** it is a 2D overlay, not cloth simulation: no folds, no arm occlusion in
front of the torso, garments follow the body but do not drape. Good enough to show "this outfit on you, live".

## What the user sees

New page `/try-on` with three modes (tabs):

1. **Camera** (live): mirrored webcam, the outfit drawn on the user, ~20-30 fps. A "stand back so your knees are
   visible" hint until hips and knees are tracked.
2. **Photo**: upload a full-body photo, the outfit is drawn on it, "Download image" button.
3. **Model** (default, no camera needed): the look on one of our stock full-body photos (men/women x slim/regular/plus).
   Their pose landmarks are precomputed, so this is instant and needs no ML in the page. **This replaces the SVG
   mannequin as the default in the shop preview and the Complete Outfit page.** The SVG mannequin stays as the fallback
   when an item has no cut-out.

Entry points: "Try it on" button in `OutfitPreviewModal` and `CompleteOutfitView` → `/try-on?items=<ids>&body=<preset>`.
Swapping a piece on the Complete Outfit page updates the model view instantly. Under the canvas: chips for items that
cannot be tried on (no cut-out yet), and an "Add whole look to cart" button.

## How it works

### Garment anchors (data)

Each product gets `tryon_anchors` (JSON, in **cut-out pixel coordinates**) and `tryon_ready` (bool):

| Kind | Anchor points on the garment image |
| --- | --- |
| tops, shirts, kurta, jacket | `l_shoulder`, `r_shoulder`, `hem_center` |
| bottoms (jeans, trousers, shorts, shalwar) | `l_waist`, `r_waist`, `hem_center` |
| footwear | one shoe image used for both feet: `heel`, `toe` (the cut-out is split in half when the photo shows a pair) |
| watch | `center`, `strap_width` |
| cap | `center`, `width` |

- `catalog/engine/tryon_anchors.py` (pure Python, numpy): computes default anchors from the cut-out's alpha mask.
  Tops: shoulders = left/right extents of the opaque pixels in the top 12% of the garment box, hem = bottom centre.
  Bottoms: waist = extents in the top 5%, hem = bottom centre. Shoes: split a pair at the widest gap, heel/toe = ends of
  the main axis. Called from `prepare_mannequin_asset` and a `manage.py compute_tryon_anchors` command for existing rows.
- Admin: on the product edit form, an "AR anchors" preview showing the cut-out with the dots; drag to correct; save.
  Heuristics will be wrong for some photos, so this editor matters.
- Products whose cut-out has a person in it (`mannequin_ready = False`) are not `tryon_ready`.

### Placement (pure TypeScript, `src/features/tryon/place.ts`)

Body landmarks used (MediaPipe indices): shoulders 11/12, elbows 13/14, wrists 15/16, hips 23/24, knees 25/26,
ankles 27/28, heels 29/30, foot index 31/32, ears 7/8, nose 0.

- **Top**: affine transform mapping garment `l_shoulder, r_shoulder, hem_center` to body shoulders (pushed out ~8% so the
  garment is wider than the bone points) and the hip midpoint (lowered ~6%). Three points give an exact affine:
  `ctx.setTransform(a, b, c, d, e, f)` then `drawImage`.
- **Bottom**: garment waist L/R to hips 23/24 (widened ~15%), hem centre to the ankle midpoint (shorts: knee midpoint).
- **Shoes**: one shoe image per foot from heel (29/30) to foot index (31/32), scaled by that distance, mirrored for the
  other foot.
- **Watch**: centred on the **left wrist** (15), rotated along elbow→wrist, width from the forearm length.
- **Cap**: on the head from ears 7/8 and nose 0.
- Draw order: bottom, top, outerwear, shoes, watch, cap.
- Jitter: exponential smoothing on landmarks (alpha ~0.5) and skip drawing a garment when its landmarks' visibility is low.

### Files

- `src/features/tryon/pose.ts`: loads PoseLandmarker (VIDEO and IMAGE modes) from **local** files in
  `public/mediapipe/` (wasm + `pose_landmarker_lite.task`); `make models` downloads them. No CDN at demo time.
- `src/features/tryon/place.ts`: landmarks + garment anchors → per-layer transform. Pure, unit tested.
- `src/features/tryon/smooth.ts`: landmark smoothing. Pure, unit tested.
- `src/components/tryon/TryOnCanvas.tsx`: draws the background (video frame, photo or model image) and the layers.
- `src/app/try-on/page.tsx` + `src/components/TryOnView.tsx`: tabs, camera permission states, errors.
- Model photos: `public/tryon/bodies/{men,women}-{slim,regular,plus}.jpg` + `bodies.json` with their precomputed
  landmarks (`scripts/precompute_body_landmarks` in Python with the MediaPipe pose model, run once), plus
  `SOURCES.md` (free-licence stock URLs and licences).
- API: `ProductSerializer` exposes `tryon_ready`, `tryon_anchors`, `mannequin_image`; `PUT` accepts `tryon_anchors`
  from the admin editor (staff only, validated shape).

## Tests

- pytest: anchor heuristics on synthetic masks (a T-shirt shape, trousers, a pair of shoes); `tryon_ready` rules;
  anchors validation on PUT; the compute command is idempotent.
- vitest: `place.ts` maps anchors exactly to target points (affine round-trip), mirrored shoe for the second foot, watch
  angle follows the forearm, layers in draw order, items without anchors reported as "not available"; smoothing.

## Manual checks

Model mode for 5 tops, 3 bottoms, 2 shoes, 2 watches (men and women); camera mode standing 2-3 m from the laptop
camera; photo mode with one full-body photo; an item without a cut-out shows as a chip, not a broken image; frame rate
shown in a dev overlay (aim 20+ fps on the laptop).

## Out of scope

Cloth physics, occlusion masks, 3D, try-on of bags/jewellery, recording video.
