# Phase 4: Functional scan, recommendations and complete look

Status: done with open items. Date: 2026-10-27. Branch: `agent/functional-m1`.

## Goal

Make the styling journey work without research-grade model work: a scan endpoint with a manual fallback, recommendations driven by tone rules, and a complete-look endpoint that can fill the cart as one outfit.

## What changed

- Scanner (`apps/server/scanner/views.py`): `/api/scanner/analyze/` accepts `image` and legacy `images`; returns `depth`, `undertone`, `confidence`, `palette` alongside legacy fields; no face/failure returns 422 with the standard error envelope and legacy failure fields. `POST /api/scanner/manual/` accepts Fair/Medium/Dark + warm/cool/neutral, stores a signed-in scan/profile and returns a palette.
- Recommender: `GET /api/recommendations/` alias for top picks; `GET /api/looks/` alias for complete look, accepting `product` or `product_id`; colour hex derivation hardened for admin-created products.
- Frontend: `scannerApi.manual`, manual tone panel with “Skip, pick my tone”, `/scan` route (alongside `/scanner`), result card/palette retained, recommendation reasons, “Complete the look” strip and add-whole-look-to-cart.
- Tests: `scanner/tests/test_phase4_api.py` (4 tests: functional contract + palette, manual save/validation, alias endpoints); recommender suite 79 passed.

## Decisions and why

- **Do not change the skin-tone algorithm in this phase.** The roadmap explicitly freezes it until Phase 7. The functional work only wraps the existing detector and adds a manual path.
- **422 is the right status for “no usable face”.** The old endpoint returned 200 with a rescan string. A failed analysis is not a successful resource; the client catches 422 and still shows a friendly rescan card plus the manual picker so the journey continues.
- **Manual tone is first-class.** Lighting and camera availability must not block a demo or a shopper. The manual endpoint persists the chosen tone for signed-in users and is anonymous-safe.
- **Aliases, not breaking renames.** `/api/recommendations/top/` and `/api/looks/complete/` already existed and are used by the UI; `/api/recommendations/` and `/api/looks/` match the roadmap without invalidating old callers.
- **Recommendation reasons are rule explanations.** They describe colour/style compatibility; they are not measured accuracy claims.

## Gates (real output)

Cumulative at M1 freeze:

```
backend pytest     450 passed
web vitest          99 passed
tsc --noEmit        clean
eslint              clean (2 warnings)
next build          passed
manage.py check     no issues
makemigrations --check  no changes
```

Phase-specific scanner tests: 4 passed. Recommender suite: 79 passed.

## Real-model checks

The scanner tests use synthetic inputs and monkeypatched analysis for the functional contract. `make test-models` needs downloaded MediaPipe/rembg weights; it was not part of this functional freeze. No accuracy claim is made.

## Known limitations

- Skin-tone accuracy is unmeasured; the detector is unchanged and thresholds are starting points.
- The existing 2D mannequin is untouched; its bodies are procedural and placement is box-based.
- The complete-look templates and colour harmony rules are hand-written defaults, not fitted to user data.
- Some catalogues cannot fill every slot (e.g. missing formal tops); the UI shows what exists rather than inventing items.
- Camera capture differs by browser/lighting; manual fallback is the guaranteed path.

## How to run it

Open `/scan`, allow camera or upload a face photo. If detection fails, use “Skip, pick my tone”. Then open `/recommended`, and “Complete the look” from a product.

## Open items for later phases

- Phase 7: labelled evaluation, threshold calibration, `evaluate_scanner` report.
- Phase 8: user study of recommendation quality and demo hardening.
- Phase 6: render the completed look on the layered mannequin.
