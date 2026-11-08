# Plan 02: a basic flat 2D mannequin (SVG), replacing the grey statue

Depends on plan 01 (`Product.kind`, correct `slot`/`gender`, `anchor_slot` in the look API).

## Decision

The team chose a **basic 2D mannequin**. The current one composites product photos on a procedural grey body
(`public/mannequin/*.png` + box coordinates in `public/mannequin/anchors.json`, placed by
`src/features/mannequin/layout.ts`, drawn by `src/components/Mannequin.tsx`). It fails for real reasons:

| Problem in the screenshot | Cause |
| --- | --- |
| Looks like a grey statue on a pole | The body PNGs are rendered statues with a stand. |
| The product you opened is missing | Only products with a processed `mannequin_image` can be drawn; most admin products have none, and photos of people are refused. |
| One shoe, side-on, between the feet | A shoe product photo is a single side shot of a pair; it is pasted into one box. |
| Watch sits on the waist | The watch box in `anchors.json` is at hip height near the body, not on a wrist. |
| Garments do not fit the body | Photos have their own perspective and proportions; a box cannot fix that. |

**New approach: draw everything as flat vector shapes.** One simple SVG body per gender, and one SVG shape per
garment *kind* (T-shirt, shirt, kurta, jeans, shorts, sneakers, sandals, watch, ...), filled with the product's colour.
No photos on the body, so every product can always be drawn, shoes are two shoes on two feet, and the watch is drawn
on the wrist because the wrist is a known point of our own body. The product photos stay in the list next to it.

This is the "fashion flat / paper doll" look: clean, consistent, honest. It is what we will present as the
mannequin USP: *the outfit the recommender built, in the colours it chose, on a body in the shopper's size.*

## Design spec

### Canvas and body

- One `<svg viewBox="0 0 400 800">` per render. Front view only (remove the Front/Back toggle; there are no back photos and a flat back view adds nothing).
- Body colour: a flat warm neutral (`#E9DFD3` fill, `#D4C6B5` 1.5px outline). Head is a plain oval, no face, no hair. Simple hands (rounded ends). **No stand, no pole, no plinth**; just a soft ellipse shadow under the feet (`#000`, opacity 0.08).
- Pose: relaxed A-pose, arms ~12° away from the body so wrists, waist and both feet are clear of each other.
- Key points (regular preset, men). Put them in `src/features/mannequin/geometry.ts` as data, not inside path strings:

| Point | x | y |
| --- | --- | --- |
| head centre / radius | 200, 72 | r 36 (rx 32) |
| neck | 186 to 214 | 106 to 126 |
| shoulders | 128 and 272 | 140 |
| armpits | 150 and 250 | 190 |
| elbows | 104 and 296 | 285 |
| wrists (centre) | 80 and 320 | 395 |
| hands end | 72 and 328 | 440 |
| waist | 150 to 250 | 375 |
| hips | 142 to 258 | 430 |
| crotch | 200 | 470 |
| knees | 165 and 235 | 600 |
| ankles (centre) | 168 and 232 | 740 |
| floor | | 778 |

- Women body: shoulders 136/264, waist 158 to 242, hips 136 to 264, otherwise the same.
- Presets (`slim | regular | plus`, from the profile's `body_preset`): scale the horizontal distance from x=200 of torso, hip and leg points by 0.9 / 1.0 / 1.15. Arms move out with the shoulders. Heights do not change.
- Garments are generated from these points (functions that take the geometry and return a `d` string), so every garment fits every body and preset with no per-image coordinates.

### Garment shapes (one function each in `src/features/mannequin/garments.ts`)

| kind | Shape notes | Layer (z) |
| --- | --- | --- |
| `tshirt` | shoulders to just below hips (y 455), short sleeves to mid upper arm, round neck | 20 |
| `shirt` | to y 465, long sleeves to wrists, collar + button placket line | 20 |
| `polo` | like tshirt plus small collar and 2-button placket | 20 |
| `kurta` / `kameez` | to knees (y 610), long sleeves, side slits, band collar | 20 |
| `dress` | shoulders to y 640, flared | 20 |
| `jeans` / `trousers` | waist (y 375) to ankles, two legs, fly line; jeans get a pocket curve, trousers a centre crease | 10 |
| `shorts` | waist to y 540 | 10 |
| `shalwar` | waist to ankles, wide, gathered at ankles | 10 |
| `jacket` / `hoodie` / `blazer` | open front over the top, long sleeves, lapels for blazer, hood outline for hoodie | 30 |
| `waistcoat` | sleeveless, V-neck, buttons, to y 470 | 30 |
| `dupatta` | a sash from one shoulder across to the opposite hip, hanging end | 35 |
| `belt` | band across the waist, buckle at centre | 25 |
| `tie` | knot at the collar, blade down to the waist | 32 |
| `sneakers` / `formal_shoes` / `boots` / `sandals` | **two** shoes, one per ankle, front three-quarter view, toes slightly outward; sandals = sole + 2 straps (body colour shows through); formal shoes darker with a highlight; boots go up to y 700 | 40 |
| `watch` | strap around the **left wrist** (viewer's right, x 320, y 395) with a round dial | 50 |
| `cap` | crown + brim on the head | 50 |
| `sunglasses` | two lenses at eye height | 50 |
| `bag` | not drawn on the body; listed only | n/a |

Colour and finish, the same for every garment:

- Fill = the product colour (see "Colour" below). Outline = the colour darkened 30% (1.5px). Detail lines (collar, placket, seams, pockets, laces) = darkened 45% at 60% opacity.
- One shared shading overlay per garment: a `<linearGradient>` from `rgba(255,255,255,0.18)` top-left to `rgba(0,0,0,0.12)` bottom-right, drawn as a second path with the same `d`. This is what keeps it from looking like a colouring book.
- White and near-white garments get a slightly darker outline (contrast with the light background).
- Optional, only if everything else is done: a "Show print" toggle that fills tops with the product photo as an SVG `<pattern>` clipped to the garment path. Off by default.

### Colour

Every item needs a colour to draw. Add `display_hex` to `ProductSerializer` (read-only), computed in this order: `color_hex`, `primary_color.hex`, `recommender.engine.items.COLOUR_HEX[color_name or color]`, else `#9CA3AF`. Same logic the recommender already uses in `recommender/adapter.py::product_to_item`; move it to one helper and use it in both places.

### Which items go on the body

- **Always the anchor** (the product the shopper opened), even if nothing else fits.
- Then the look's picks. If two items want the same layer (two tops), keep the anchor's.
- Use `kind` from the API (plan 01). If `kind` is empty, fall back to `slot` defaults (top → shirt, bottom → trousers, footwear → sneakers, accessory → listed only).
- Items with no shape (bags, unknown accessories) are listed under the mannequin as "Not shown on the mannequin: ...".

## Code changes

1. `src/features/mannequin/geometry.ts`: points per gender, `scaleForPreset(points, preset)`. Pure.
2. `src/features/mannequin/garments.ts`: `garmentPaths(kind, geometry) => { d: string; details: string[] }[]` (shoes return two entries with `foot: "left" | "right"`). Pure.
3. `src/features/mannequin/layout.ts`: rewrite. `layoutLook(anchor, picks, gender, preset)` returns `{ layers: { id, name, kind, slot, z, hex, isAnchor }[], notShown: {id, name}[] }`. Delete the anchors.json import and the photo logic.
4. `src/components/Mannequin.tsx`: rewrite as the SVG renderer. Props: `layout`, `gender`, `preset`, `onPreset`. Keep the Slim/Regular/Plus buttons; remove Front/Back. Every garment group gets `data-testid="mannequin-layer" data-kind=... data-product-id=... data-anchor=true|false`; shoes `data-foot="left|right"`; the body parts `data-part="wrist-left"` etc. so tests can check placement.
5. `src/components/OutfitPreviewModal.tsx` and `src/components/CompleteOutfitView.tsx`: use the new layout and component; remove `angle` state. In the list, give the anchor row a "Your pick" badge and a matching highlight on the mannequin (e.g. a subtle dashed outline on hover of the row).
6. Hovering or tapping a row highlights that garment on the mannequin (nice to have; skip if it costs more than an hour).
7. Remove the old assets when the new one ships: `public/mannequin/*.png`, `public/mannequin/anchors.json`. Leave the backend mannequin pipeline (`catalog/engine/mannequin.py`, `prepare_mannequin_assets`) and its tests untouched: it is harmless and documented in the phase reports. Add a note in `docs/STATUS.md` that the web app no longer uses `mannequin_image`.

## Tests

- Vitest `features/mannequin/garments.test.ts`: every kind returns valid non-empty paths for both genders and all presets; shoes return exactly two paths with `left`/`right`; the watch path's bounding box contains the left wrist point; nothing extends outside the 400 x 800 viewBox.
- Vitest `features/mannequin/layout.test.ts` (rewrite the existing one): the anchor is always a layer; a second top is dropped in favour of the anchor; `bag` goes to `notShown`; z-order bottom < top < outerwear < shoes < accessories; `display_hex` fallback to grey.
- Playwright `e2e/10-mannequin.spec.ts` (rewrite; it tested the photo layers, which no longer exist, say so in the report):
  - open the preview for a shirt: a layer with `data-anchor="true"` and that product's id exists;
  - a look with shoes has two `[data-kind="sneakers"]` (or other footwear) elements with `data-foot` left and right;
  - open a watch: the watch layer's bounding box overlaps `[data-part="wrist-left"]` and is above the waist line;
  - switching Slim / Plus changes the body width (bounding box) and keeps every layer visible;
  - no horizontal overflow at 390px.
- Backend: test for `display_hex` (each fallback step).

## Acceptance (screenshot this for the report and the thesis)

- Shop → any product → Preview Outfit: the opened product is on the body in its colour; no statue, no pole.
- Shoes are a pair, one on each foot. A watch is on the wrist.
- Slim / Regular / Plus visibly change the body.
- Gates: `make test`, web build, full `make e2e`.

## Out of scope

Photo-realistic try-on, warping photos onto the body, back view, poses, skin tone on the body (could be a later
touch: tint the body with the shopper's detected depth; do not do it now).
