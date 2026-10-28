# Plan 10: "Mannequin (alpha)": a try-on preview for a curated set of products

## Decision (2026-10-28)

The outfit board (plan 08, done) stays the default for every product. On top of it we add a **mannequin preview for a
curated alpha set of about 24 products**, clearly labelled "Mannequin preview (alpha, selected products)".
Putting *any* catalogue photo on a body failed three times (SVG, AR overlay, local warp) because each photo has its own
angle, crop and person. A curated set removes that problem: every alpha product gets a garment layer that is made for
**one fixed base image**, so layers line up by construction and can be stacked in any combination.

What we reject, and why (for the thesis "approaches tried" section):

| Approach | Result |
| --- | --- |
| SVG flat mannequin (plan 02) | Worked technically, looked like clip art, did not look like the product. |
| Diffusion try-on locally (plan 05) | FASHN v1.5 / CatVTON do not fit a 4 GB Quadro T1000. |
| Live AR overlay (plan 07) and Gemini's `warp_garment_to_pose` / `LiveArTryOn.tsx` | Same technique: paste a cut-out on tracked points. On real photos the garment floats over existing clothes. |
| Gemini image API (`gemini-2.5-flash-image`) | Works, but the API has no free tier for image output (about $0.03 to $0.07 per image). |
| Hugging Face Spaces (FASHN / CatVTON on ZeroGPU) | Free 5 min GPU a day with a free account (2 min without login, 40 min on PRO). Fine for pre-rendering a small set, not for live use. Tested in plan 09. |

## How the layers are made (offline, once per product)

1. **Base images**, one per gender, 768 x 1024: an AI-generated model in a plain fitted white T-shirt and neutral
   trousers, barefoot or plain socks, straight front pose, arms slightly away from the body, plain light background.
   The men's one exists (`wear_right_tryon_upgrade/apps/web/public/vton-cache/men-regular_base.jpg`). Make a women's
   one the same way. Store in `MEDIA_ROOT/mannequin_alpha/base/{men,women}.jpg`. Label them as AI-generated.
2. **Render** each alpha product on its base image, with the product's **real photo** as the garment input, using one of:
   - FASHN VTON v1.5 on Hugging Face (`tools/alpha_mannequin/render_hf.py`, uses `HF_TOKEN`, stops on quota and resumes), or
   - by hand in the Gemini app / Google AI Studio (free daily limit on free accounts): upload the base image and the
     product photo with the fixed prompt in `tools/alpha_mannequin/PROMPT.md` ("Dress the person in image 1 in the
     garment from image 2. Keep face, hair, pose, body, background, framing and every other item exactly the same.
     Output 768x1024."). Save as `renders/<product_id>.jpg`.
3. **Extract the layer** with `tools/alpha_mannequin/extract_layer.py base.jpg render.jpg --slot top|bottom|onepiece|shoes|outerwear -o layer.png`:
   - garment mask from rembg's cloth model (`u2net_cloth_seg`, already used by `prepare_mannequin_asset`) for
     top/bottom/onepiece/outerwear, intersected with the pixels that **changed** between base and render
     (absolute difference after a light blur, threshold), restricted to the slot's region of the canvas;
   - shoes: changed pixels below the ankle line;
   - clean-up: largest connected parts, 2 px feather, transparent PNG on the same 768 x 1024 canvas.
   - **Alignment check**: if the face, hands or background changed by more than a threshold (the generator moved
     the pose), reject the render and print why. Re-render; do not ship misaligned layers.
4. **Review** every layer by eye in the admin preview (below) before marking it approved.

Coverage target, about 24 products from the existing catalogue (real products with real photos and prices):
men: 3 shirts/T-shirts, 1 blazer, 3 trousers/jeans, 2 kurtas, 2 shoes; women: 3 tops/kurtis, 2 bottoms, 1 dupatta-free
kurta set, 2 shoes. Watches, belts, caps and other small accessories stay on the outfit board only.

## App changes

- `catalog.MannequinLayer` (TimeStampedModel): `product` FK, `gender`, `slot` (top/bottom/onepiece/outerwear/shoes),
  `image` (PNG in `MEDIA_ROOT/mannequin_alpha/layers/`), `source` (`hf_fashn` / `gemini_app` / `manual`), `approved` bool.
  `ProductSerializer` exposes `alpha_layer` (url, slot) when an approved layer exists.
- `manage.py import_alpha_layers <dir>`: reads `layers/<product_id>.png` + a small `manifest.csv` (product_id, gender, slot, source), creates rows.
- Admin, product edit form: "Mannequin (alpha) layer" box: upload/replace the PNG, see it composited on the base image,
  Approve checkbox.
- Web `components/AlphaMannequin.tsx`: the base image with the approved layers stacked on top as absolutely positioned
  `<img>`s of the same size (order: bottom, onepiece, top, outerwear, shoes). No transforms needed: the layers already
  line up.
- In `CompleteOutfitView` and `OutfitPreviewModal`: tabs "Outfit board | Mannequin (alpha)". The mannequin tab is
  enabled when the look's anchor has a layer; pieces without a layer are listed under it as "not in the alpha yet"
  (the base image's own white T-shirt / trousers show in their place). Shop cards of alpha products get a small
  "Try on (alpha)" badge and the shop filter "Mannequin preview".

## Tests

- pytest: `extract_layer` on synthetic base/render pairs (a coloured rectangle added on the torso gives a torso-only
  layer; a shifted render is rejected by the alignment check); `import_alpha_layers` idempotent; only approved layers
  are exposed.
- vitest: stacking order; tab disabled when the anchor has no layer; "not in the alpha" list.

## Manual checks

Every alpha product's layer on the base image looks like that product (photo vs layer side by side, saved to
`docs/phases/phase-6-screens/alpha/`); three mixed combinations (shirt + jeans + sneakers, kurta + sandals,
blazer + trousers + formal shoes) stack cleanly; a non-alpha product shows only the outfit board.

## Thesis wording

"Mannequin preview (alpha): garment layers for a curated set of products were produced offline with a third-party
virtual try-on model (FASHN VTON v1.5 on Hugging Face) / Google Gemini image editing on a fixed AI-generated base
image, extracted with background segmentation and checked for alignment, then composited in the browser. Live try-on
for arbitrary products is future work (needs a GPU with at least 8 GB VRAM)."
