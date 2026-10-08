# Phase 3: Skin tone v2

Status: done with open items. The pipeline runs end to end on the real MediaPipe model; accuracy against labelled photos has not been measured because no labelled set exists yet.

## Goal
MediaPipe landmark regions, the white-balance fix, undertone, Monk Skin Tone, a confidence that is not hard-coded, and an evaluation script.

## What changed
- Engine (no Django), under [scanner/engine/](../../apps/server/scanner/engine/):
  [landmarks.py](../../apps/server/scanner/engine/landmarks.py) (MediaPipe Face Landmarker, 478 points), [regions.py](../../apps/server/scanner/engine/regions.py) (left cheek, right cheek, forehead), [skin.py](../../apps/server/scanner/engine/skin.py) (CIELAB, ITA, hue angle, Monk swatches), [pipeline.py](../../apps/server/scanner/engine/pipeline.py) (one frame to a reading, plus multi-frame consensus), [evaluation.py](../../apps/server/scanner/engine/evaluation.py) (accuracy metrics).
- Service and API: [scanner/services.py](../../apps/server/scanner/services.py) keeps one detector per process and saves `monk`, `undertone`, `ita`, `hue` on `FaceScanRecord` and `monk_tone`, `undertone` on `UserProfile`. The photo is never stored. `POST /api/scanner/analyze/` keeps every old key and adds `monk`, `undertone`, `ita`, `hue`, `agreement`, `reason`. A missing model file is a clear 503.
- Command: `evaluate_skin_tone --dir DIR [--white-balance off|on|both] [--out report.md]` (accuracy, depth confusion matrix, per lighting group, confidence per depth).
- Web: the result card shows depth, undertone and Monk, a "Rescan Needed" state replaces the old "Scan Successful" on a failed scan, and the two-question undertone override (gold or silver, burn or tan) is in place; the profile accepts `monk_tone` and `undertone`.
- Migrations: `accounts 0003`, `scanner 0002`.

## Decisions and why
- **Sampling.** Only cheeks and forehead polygons are used, shrunk 12% toward their centre. Indices were checked on a rendered landmark overlay and by a test that no eye, brow, mouth or nose landmark falls inside a region, on a real face.
- **Bugs removed from v1.** v1 ran gray-world white balance on the face crop (which pulls skin toward grey and erases undertone) and then gamma and CLAHE on L* before measuring. v2 measures L* untouched and rejects bad light with a retake prompt.
- **Background white balance is OFF by default.** On the one real portrait tried, a teal background moved the hue from 55 to 99 degrees. It stays available (`white_balance=True`, `--white-balance both`) so the labelled set can decide.
- **Depth.** Median Lab after trimming to the 10th to 90th L* percentile; ITA above 41 Fair, 10 to 41 Medium, below 10 Dark (PRD thresholds). **Undertone** from the hue angle: 58 degrees and up warm, below 50 cool. **Monk** is the nearest of Google's ten swatches by CIEDE2000.
- **Confidence** is frame agreement times skin-pixel count times a lighting factor (1.0 / 0.9 / 0.85), not the old hard-coded 92. One frame earns 0.9 because it cannot show agreement.
- **Lighting rejection:** nearly black ("Too Low", L* 95th percentile under 15) or over 15% clipped pixels ("Too Bright"). A first version rejected Monk 1 to 3 as too bright and Monk 9 to 10 as too dark; both rules were relaxed after painting each swatch into a synthetic face and checking.

## Gates (real output)
```
make test:        297 passed (backend; scanner 79, of which 7 use the real model)   Tests 58 passed (web)
make build:       passed
make e2e:         23 passed (3 new scanner scenarios drive the real model through the browser)
make test-models: 7 passed
```

## Real-model checks
- MediaPipe `face_landmarker.task` (3,758,596 bytes) in `apps/server/ml_models/`. On a real portrait: one face, 478 landmarks, sampling regions free of eyes, brows, mouth and nose, a valid reading, three identical frames agree fully, and a 8% brightness drop moves Monk by at most one swatch.
- A face painted with each Monk swatch 1 to 9 is read back as exactly that swatch through the whole chain (detector stand-in, regions, Lab, ITA, nearest swatch).
- Not verified: accuracy against labelled people. The one real portrait read Fair, neutral undertone, Monk 5 with balancing off, but it has no ground truth, so that is a smoke test and not an accuracy figure.

## Known limitations
- **Thresholds are uncalibrated.** On the Monk swatches the Medium depth band covers only about Monk 6, so most real users may split between Fair and Dark. The PRD's open question (3 buckets or 4) is the first thing the labelled set must answer.
- **Lighting is judged from face luminance**, so well-lit dark skin can grade "Low" (confidence factor 0.85). `evaluate_skin_tone` reports mean confidence per depth bucket so any bias shows up.
- Exposure changes depth (the real portrait was brightly lit and read light). Retake prompts reduce but do not remove this.
- The browser-side face guidance (centred, lit) from the PRD is not built; the server rejects bad frames instead.
- `mediapipe` installs `opencv-contrib-python` beside `opencv-python-headless` (same version). Both provide `cv2`; it works but is untidy.
- The `palette` field of the PRD output arrives with the tone-colour rules in phase 4.

## How to run it
```
make models
apps/server/venv/bin/python apps/server/manage.py evaluate_skin_tone --dir /path/to/photos --white-balance both --out report.md
```
`labels.csv` columns: `file, depth, monk, undertone, lighting` (monk, undertone and lighting optional).

## Open items for later phases
- Collect and label the 80 to 100 consented photos (Hammad's team), run the evaluation, then calibrate the ITA and hue thresholds and decide on white balance.
- Phase 4 consumes `depth`, `undertone` and `monk` from the profile.
