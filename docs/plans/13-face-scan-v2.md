# Plan 13: Face scan v2: lighting gate, photo upload, skin-tone presets in the admin, colour schemes

Written 2026-11-07 by the lead after reading `scanner/engine/*`, `recommender/models.py`, `recommender/engine/*`,
`FaceScanView.tsx` and plan 06. Supersedes plan 06 (never done).

## 1. Where the scanner is today (it is better than we thought)

| Part | What exists | File |
| --- | --- | --- |
| Face detection | MediaPipe Face Landmarker, 478 points, model in `ml_models/` | `scanner/engine/landmarks.py` |
| Skin sampling | Only cheeks + forehead polygons (no eyes, brows, lips, beard) | `scanner/engine/regions.py` |
| Colour maths | CIELAB, trimmed median, **ITA** angle → Fair/Medium/Dark, hue angle → warm/cool/neutral, nearest **Monk Skin Tone** swatch (1–10) by CIEDE2000 | `scanner/engine/skin.py` |
| Lighting | Grade from face L* p95 + clipped pixels: Too Low / Low / Normal / Good / Too Bright; rejects the extremes | `scanner/engine/pipeline.py` |
| White balance | Gray-world from the background, **off** by default (a coloured wall made it worse) | `pipeline.py` |
| Multi-frame | Camera sends several frames; consensus by depth bucket; confidence × agreement | `pipeline.py` |
| Upload | One photo upload already exists in the UI | `FaceScanView.tsx` |
| Manual fallback | Pick Fair/Medium/Dark + warm/cool/neutral | `ManualToneAPIView` |
| Colours | `ToneColorRule` (depth × undertone × colour → best/good/avoid), editable in the admin (`ToneRulesPanel`) | `recommender/` |
| Evaluation | `manage.py evaluate_skin_tone --dir` with a labels.csv (depth, monk, undertone, lighting) | `scanner/engine/evaluation.py` |

**What is missing:** (1) the gate only checks brightness, not colour cast, blur, side light or head turn, so a yellow
bulb gives a confident wrong answer; (2) no live feedback before capture; (3) three depth words are too coarse for
Pakistani skin (most of us are Monk 4–7) and the admin cannot define named tones; (4) the result screen does not show a
proper colour scheme; (5) no real accuracy numbers yet.

## 2. Do we need a new model? No.

| Option | Verdict | Why |
| --- | --- | --- |
| **Keep MediaPipe + colour science (ITA, Monk, hue)** | **Use this** | It is the standard, explainable method (ITA comes from dermatology; the Monk scale is Google's open 10-tone scale built for this). It runs on any laptop CPU. Every number can be explained in the viva. |
| A deep-learning skin-tone classifier from Hugging Face/GitHub | No | Unknown training data and bias, no licence clarity for most, and we have no labelled Pakistani photos to check it. It still fails under a yellow bulb, so it does not remove the need for the lighting gate. |
| Train our own classifier | No | Needs hundreds of labelled faces under controlled light. Not an FYP-sized job. |
| `skin-tone-classifier` (`stone`, PyPI, GPL-3.0) | **Baseline only** | Face detection + skin segmentation + k-means + nearest palette (supports the Monk palette). Same family of method as ours. Good as a comparison column in the thesis evaluation; do not ship it in the app (GPL). |
| Google **MST-E** dataset (1,515 images + 31 videos of 19 people, labelled on the Monk scale by Dr. Ellis Monk, varied light) | **Use for evaluation** | Research use / annotator training only, and must not be used to train ML models; we only evaluate, which fits. Request it at skintone.google/mste-dataset. Only 19 people, so report per person too. |

The accuracy problem is **light**, not the model. So the work is: a strict, explained lighting gate; live hints before
capture; admin-managed presets; a clear colour scheme; and real evaluation numbers.

## 3. Part A: lighting and photo quality gate (backend, pure engine)

New `scanner/engine/quality.py` (no Django). Input: the BGR frame, landmarks, face box, region mask. Output:

```python
{"ok": bool, "confidence_factor": float,
 "checks": [{"key": "exposure|cast|blur|side_light|pose|face_size", "status": "pass|warn|fail",
             "value": float, "message": str}]}
```

| Check | How | Starting thresholds (constants, documented as starting values) |
| --- | --- | --- |
| exposure | existing `_lighting_grade` (face L* p95, clipped share) | unchanged |
| cast (colour of the light) | Neutral reference = pixels **outside the face box** with L* > 60 and chroma √(a²+b²) < 25 (white wall, white shirt, paper). If they are ≥ 2 % of the frame: median a*, b* of them. | b* > 12 warn "Light looks yellow", b* > 20 fail; b* < −8 warn "Light looks blue", < −14 fail; abs(a*) > 10 warn "Light looks pink/green", > 16 fail; under 2 % neutral pixels: warn "Could not check the light colour", no fail |
| blur | Laplacian variance of the grey face crop resized to 256 px wide | < 40 fail "Photo is blurry, hold still"; < 80 warn |
| side_light | median L* of left cheek vs right cheek (existing regions) | difference > 12 warn "Light is coming from one side, face the window"; > 20 fail |
| pose | yaw from landmarks: nose tip (1) vs the midpoint of the face edges (234, 454), as a share of face width | > 0.12 warn "Look straight at the camera"; > 0.20 fail |
| face_size | existing `MIN_FACE_WIDTH_FRACTION` | unchanged |

- Any fail → the frame is rejected with the first failing message (and all checks returned so the UI can list them).
- Each warn multiplies confidence by 0.85.
- Optional correction (off by default, like the existing background white balance): when the cast is a warn (not a fail)
  and neutral reference pixels exist, scale B, G, R so the reference median becomes neutral (von Kries / white-patch).
  Flag it in the result. Turn it on only if the evaluation in Part E shows it helps. Never correct L*.
- `analyze_frame` calls the gate after landmarks and before measuring; the API returns `quality` per frame and for the
  chosen result; the scan record stores the check statuses (JSON field `quality`, migration).
- Tests: synthetic frames for each check (a warm-tinted frame with a white wall fails `cast`; a blurred frame fails `blur`;
  a frame with one cheek darker warns `side_light`), and the existing pipeline tests still pass.

## 4. Part B: live hints before capture, and better upload (web)

1. `features/scanner/liveLight.ts` (pure): from an `ImageData` of the centre of the video, every 500 ms: mean luminance,
   clipped share, and gray-world colour ratios (mean R / mean B, mean G). Returns `{status: "ok" | "dark" | "bright" |
   "yellow" | "blue", message}`. Same thresholds idea as Part A, as constants. vitest with synthetic ImageData.
2. `FaceScanView`: a small traffic-light bar over the camera ("Light: good", "Too dark, move to a window", "Light is
   yellow, avoid bulbs"). The capture button is enabled when the status is ok for 1 second; a "Scan anyway" link stays
   available (the server gate decides).
3. Upload: accept **1 to 3 photos** at once (JPEG/PNG/WebP, 8 MB each); show each photo as a thumbnail with its check
   result (✓ used / ✗ reason), then the consensus result. Before the camera opens and on the upload screen, show the
   checklist: daylight facing a window, no filters or beauty mode, no makeup or minimal, glasses off, hair off the
   forehead, plain light wall behind.
4. Photos are never stored (unchanged).

## 5. Part C: skin-tone presets managed in the admin

New model in `recommender` (it owns colours):

```python
class SkinTonePreset(TimeStampedModel):
    name            # "Wheatish", shown to shoppers
    slug
    monk_from, monk_to   # 1..10, inclusive
    undertone       # warm | cool | neutral | any
    depth           # Fair | Medium | Dark  (kept so ToneColorRule, product.compatible_skin_tone keep working)
    swatch_hex      # the colour shown in the UI
    description     # one or two friendly lines ("Warm golden wheatish skin, the most common tone in Pakistan")
    sort_order, is_active

class SkinTonePresetColor(TimeStampedModel):
    preset FK, color FK (catalog.Color), score  # 2 best, 1 good, -2 avoid; unique (preset, color)
```

- **Seed** (data migration or `seed_skin_tone_presets` command, idempotent): 5 depth bands × 3 undertones = 15 presets,
  palettes copied from the current `ToneColorRule` rows for the matching depth + undertone so nothing changes on day one.
  Starting bands (editable): Fair = Monk 1–3 (depth Fair), Wheatish = 4–5 (Medium), Brown = 6 (Medium), Dark brown = 7–8
  (Dark), Deep = 9–10 (Dark). Swatch = the Monk swatch at the middle of the range.
- `recommender/services.py`: `match_preset(monk, undertone)` → active preset whose range contains the Monk number,
  exact undertone before `any`, then `sort_order`. `palette_for(profile)` uses the preset's colours when the profile has
  a preset, else the old `ToneColorRule` path (kept as the fallback; the old admin panel is relabelled "Fallback colour rules").
- `accounts.UserProfile` gets `skin_tone_preset` (FK, null). `save_scan_result` and the manual endpoint set it.
- API:
  - `GET /api/skin-tones/` (public): active presets with swatch, Monk range, undertone, description and palette
    (best / good / avoid, each with name + hex).
  - Scan and manual responses add `preset: {id, name, swatch_hex, description}` and the palette comes from the preset.
  - `POST /api/scanner/manual/` also accepts `preset_id` (old depth/undertone still works).
  - Admin under `/api/admin/skin-tones/`: list, create, update, delete presets and their colours (`catalog.manage`),
    and `GET .../match/?monk=5&undertone=warm` for the admin's "Test" box.
- Admin UI section **"Skin tone presets"**: table (swatch, name, Monk range, undertone, number of best/avoid colours),
  edit drawer with the fields and three colour pickers (Best / Good / Avoid) using the existing Color table chips, and a
  "Test" box (Monk + undertone → which preset). Overlapping ranges for the same undertone show a warning.
- Tests: matching rules (exact undertone wins, `any` fallback, inactive skipped, no match → fallback rules), seed
  idempotent and copies palettes, API shapes, RBAC 403, the manual endpoint with `preset_id`.

## 6. Part D: the result and the colour scheme (web)

On the result screen:
- A big swatch circle in the preset colour, the name and undertone ("Wheatish · Warm"), Monk number, and a confidence
  word (high ≥ 75, medium ≥ 50, else low) instead of a raw percentage.
- **Your colours**: the best colours as chips with their hex, the good ones smaller, and **Avoid** chips. Each chip
  links to `/shop?color=<name>`.
- "Shop my colours" → the recommendations page (already uses the palette).
- "Not right? Choose mine" → a grid of preset swatches (grouped by undertone) with two undertone helpers: the vein test
  (green veins = warm, blue/purple = cool, both = neutral) and the jewellery test (gold suits you = warm, silver = cool).
  The chosen preset is saved to the profile.
- The quality checks of the photo(s) used, collapsed under "How we read your photo".

## 7. Part E: evaluation for the thesis (real numbers only)

1. Labelled set: 20 to 40 consenting people, 2 to 3 photos each (daylight, indoor bulb, phone front camera). Labels:
   Monk number agreed by two team members holding the printed Monk scale next to the face in daylight, plus the person's
   own undertone answer (vein + jewellery test). `labels.csv` already supports `monk`, `undertone`, `lighting`. No photos
   in git.
2. MST-E (after Google approves the request): run the same command on it.
3. Report in `docs/phases/phase-7.md`: Monk exact and within ±1, depth accuracy, undertone agreement, per lighting group,
   how many photos the gate rejected and why, with and without the optional cast correction, and the `stone` baseline on
   the same photos. Paste the real command output. If a number was not measured, say so.
4. A small "bad photos" set (dark room, yellow bulb, side light, blur, head turned) to show the gate rejects each case.

## Order and testing

Parts A → C → B → D → E, one commit each, tests in the same commit. `make test` and the web build before each report; no
Playwright. Hand checks: scan under a yellow bulb (expect the cast message), in a dark room, with side light, moving
(blur), upload 3 photos where one is bad, change a preset's colours in the admin and see the scan result change.

## Out of scope

Training any model, storing photos, colour-card calibration, makeup detection.
