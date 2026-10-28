# Prompts for the implementing agents

One prompt per session, in order. Paste the prompt as the first message. Start each session fresh.

---

## Prompt 00: verify the admin panel

```
You are working on Wear Right (FYP). Read CLAUDE.md, docs/STATUS.md, docs/plans/README.md and docs/plans/00-verify-admin-panel.md. Do only plan 00.

The admin rework (staff app, separate admin login, RBAC, team CRUD) is already in the working tree. Your job is to get it running on this machine, verify it, and fix only real defects.

1. Stop any running servers, run `make migrate`, delete apps/web/.next, start with `npm run dev`.
2. Walk through every manual check in step 4 of the plan in the browser and note pass/fail for each.
3. If something fails, follow step 5 of the plan to find the cause. Fix the smallest thing that solves it and add a unit/API test for it.
4. Run `make test` and `npm --prefix apps/web run build`. Do NOT run Playwright or make e2e.
5. Update docs as listed in step 7. Commit on branch feat/admin-rbac (code commit, then docs commit).

Report: the pass/fail list from step 2, any fix with its cause, real output of make test and build, and anything that looks badly wired (pages, API calls, navigation between shop and admin).
```

---

## Prompt 01: product kinds and the anchor in the look

```
You are working on Wear Right (FYP). Read CLAUDE.md, docs/STATUS.md, docs/plans/README.md and docs/plans/01-catalog-slots-and-anchor.md. Do only plan 01.

Start with Step 0 in the plan: run the shell snippet and paste its output. If the data does not match the plan's explanation, stop and report what you found before changing code.

Then do tasks A, B, C in order, one commit per task:
A. Product.kind + catalog/engine/kinds.py (pure, unit tested with real catalog names), serializer fills kind/slot/gender, idempotent backfill, recommender reads kind first.
B. Admin product form: Type select (kind), Shop section select (gender), remove the Garment Type select.
C. complete_look skips slots the anchor covers, kids' products out of adult looks, anchor_slot/anchor_kind in the look API.

Follow the layered rules in CLAUDE.md (logic in services/engine, thin views). Write the backend and vitest tests listed in the plan.

Testing: run `make test` and the web build. Do NOT run Playwright or make e2e. Then run the app and check by hand: run the backfill, add a product in the admin with a Type, open it in the shop's Preview Outfit, and confirm the look is built around it (no second top, no kids' items). Re-run the Step 0 snippet and paste it.

Report: Step 0 before/after, files changed, real test/build output, what you checked by hand and how it connects to the shop, admin and recommender.
```

---

## Prompt 02: the 2D SVG mannequin

```
You are working on Wear Right (FYP). Read CLAUDE.md, docs/STATUS.md, docs/plans/README.md and docs/plans/02-mannequin-2d-svg.md. Plan 01 is done; Product.kind and anchor_slot exist. Do only plan 02.

Goal: replace the photo-on-grey-statue mannequin with a basic flat SVG mannequin. Follow the design spec in the plan exactly: 400x800 viewBox, body from the key-point table (as data in geometry.ts), garments generated from those points (garments.ts), filled with the product colour plus the shared shading overlay, two shoes on two feet, watch on the left wrist, no stand or pole, no Front/Back toggle, Slim/Regular/Plus kept.

Order of work, one commit each:
1. Backend: display_hex on ProductSerializer via one shared helper (also used by recommender/adapter.py), with tests.
2. geometry.ts + garments.ts (pure) with the vitest tests from the plan.
3. layout.ts rewrite + Mannequin.tsx SVG renderer with the data-* attributes listed in the plan.
4. Wire it into OutfitPreviewModal.tsx and CompleteOutfitView.tsx; anchor always on the body and marked "Your pick" in the list.
5. Remove public/mannequin PNGs and anchors.json once nothing imports them. Leave the backend mannequin pipeline alone.
6. Rewrite e2e/10-mannequin.spec.ts to the new behaviour (do not run it) and say in the report that it changed and why.

Keep it simple and clean-looking; do not add photo warping, back views or poses. The "Show print" toggle only if everything else is done.

Testing: run `make test` and the web build. Do NOT run Playwright or make e2e. Then run the app and check by hand on at least: a shirt, a T-shirt, jeans, shorts, a kurta, sneakers, sandals, a watch, a belt, for men and women, all three presets, and at 390px width. Take screenshots of the Preview Outfit modal and the Complete Outfit page and put them in docs/phases/phase-6-screens/.

Report: files changed, real test/build output, the screenshots, which item types look right and which look weak, and how it is integrated (shop preview, complete outfit page, cart buttons still work).
```

---

## Prompt 03: shop cleanup and docs

```
You are working on Wear Right (FYP). Read CLAUDE.md, docs/STATUS.md, docs/plans/README.md and docs/plans/03-shop-cleanup.md. Plans 00 to 02 are done. Do only plan 03, one commit per numbered item.

1. Delete the dead legacy order code in Navbar.tsx and ShopView.tsx and ordersApi.create/NewOrder. Check with rg that nothing references them.
2. Make POST /api/orders/ staff-only and update the permission matrix test, explaining the change in the report.
3. Find and fix the 8px horizontal overflow on the product page at 1280px (check in the browser devtools, not Playwright).
4. Sticky first column in the admin products table.
5. Docs: STATUS.md, docs/phases/phase-6.md from the template (the mannequin work from plan 02), phases README line, CLAUDE.md phase map.

Testing: run `make test` and the web build. Do NOT run Playwright or make e2e. Check by hand: add to cart, Buy Now and Continue to Order from the shop preview all reach /checkout, an order goes through, the admin sees it.

Report: files changed, real test/build output, the hand checks, anything left open.
```

---

## Prompt 05: the rest (cleanup, forgot password, mail)

```
You are working on Wear Right (FYP). Read CLAUDE.md, docs/STATUS.md, docs/plans/README.md, docs/plans/03-shop-cleanup.md and docs/plans/04-password-reset-and-email.md.

Plans 00 to 02 are done on branch feat/admin-rbac. Work on top of that branch (create feat/password-reset from it). The team's main checkout is on another branch and is still running the old mannequin, so nothing here is merged yet; do not merge, the lead does that.

Step 0, quick integration check of plans 01 and 02 before adding anything (no Playwright): start the app from this branch (make migrate, npm run dev) and open
http://localhost:3000/complete-outfit?skinTone=dark&undertone=cool&style=casual&productId=325
and the shop Preview Outfit for a shirt, a pair of sandals and a watch. Confirm: the SVG mannequin (no grey statue), the opened product is on the body, shoes are a pair, watch on the wrist, no kids' or women's items in a men's look. Write what you see in the report. If something from plan 01/02 is broken, fix it first in its own commit.

Then:
A. Plan 03, items 1 to 5, one commit each.
B. Plan 04, sections 1 to 4, one commit each. Keep Django auth and dj-rest-auth; do not add better-auth or any new auth framework (the plan explains why). Mailpit goes in docker-compose.yml.

Rules: layered code as in CLAUDE.md, no account enumeration on reset, email failures never break checkout or signup, tests in the same commit as the code.

Testing: run `make test` and `npm --prefix apps/web run build`. Do NOT run Playwright or make e2e. Then do the manual checks listed at the end of plan 04 and the hand checks in plan 03, using the Mailpit inbox at http://localhost:8025.

Report: Step 0 findings, files changed per commit, real make test and build output, each manual check with pass/fail, and anything left open. Update docs/STATUS.md, docs/SETUP.md (Mailpit, FRONTEND_URL, how to see emails) and docs/DEMO.md (forgot-password step).
```

---

## Prompt 06 and 07 (old, image generation): superseded by Prompt 09. Do not run.

---

## Prompt 09: AR try-on

```
You are working on Wear Right (FYP). Read CLAUDE.md, docs/STATUS.md and /home/jb/Projects/Wear-Right/docs/plans/07-ar-try-on.md. Do only plan 07. No image generation and no cloud GPU: everything runs in the browser with MediaPipe Pose Landmarker on the team laptop (Quadro T1000 4 GB, i7-9850H).

Order, one commit each, tests in the same commit:
1. Backend data: Product.tryon_anchors (JSON) + tryon_ready (bool) + migration; catalog/engine/tryon_anchors.py (pure, numpy) with the heuristics in the plan; called from prepare_mannequin_asset; `manage.py compute_tryon_anchors`; serializer exposes the fields, PUT validates anchors (staff only). pytest on synthetic masks.
2. Pose assets: `make models` also downloads the MediaPipe tasks-vision wasm files and pose_landmarker_lite.task into apps/web/public/mediapipe/ (gitignored); add @mediapipe/tasks-vision to apps/web. src/features/tryon/pose.ts loads them locally (no CDN).
3. src/features/tryon/place.ts and smooth.ts (pure) with the vitest tests from the plan: 3-point affine for tops and bottoms, shoes per foot mirrored, watch on the left wrist along the forearm, cap on the head, draw order.
4. Model photos: 6 free-licence full-body stock photos in public/tryon/bodies with SOURCES.md, and a one-off script that writes bodies.json with their landmarks.
5. /try-on page with Model (default), Photo and Camera tabs, TryOnCanvas, camera permission and error states, "not available for try-on" chips, add-whole-look-to-cart, dev FPS overlay.
6. Wire it in: "Try it on" buttons in OutfitPreviewModal and CompleteOutfitView; the model view replaces the SVG mannequin as the default panel there (SVG stays as fallback for items without cut-outs); swaps update instantly.
7. Admin AR anchors editor on the product form (drag the dots on the cut-out, save).
8. Run `make mannequin-assets` and `compute_tryon_anchors` for the demo products; list how many are tryon_ready.
9. Docs: STATUS.md, SETUP.md (models, camera permission on localhost), DEMO.md (try-on steps), docs/phases/phase-6.md with the decision (AR over diffusion, why), limits and screenshots.

Testing: `make test` and `npm --prefix apps/web run build`. Do NOT run Playwright or make e2e. By hand: the manual checks at the end of the plan, with the FPS you see in camera mode. Save screenshots of model, photo and camera modes to docs/phases/phase-6-screens/.

Report: files per commit, real test/build output, how many demo products are tryon_ready, FPS on the laptop, screenshots, which garment types look good and which need anchor fixes in the admin editor.
```

---

## Prompt 10: outfit board + local media storage (DONE, see plan 08)

---

## Prompt 11: test the cloud try-on from the Gemini package

```
You are working on Wear Right (FYP). Read /home/jb/Projects/Wear-Right/docs/plans/09-cloud-tryon-test.md. Do only "The test" section. Do not change apps/server or apps/web and do not copy the package into the app.

The package is in /home/jb/Projects/Wear-Right/apps/web/wear_right_tryon_upgrade/. Its cached images and HERO_LOOKS are not real outputs; ignore them. The only thing under test is calling FASHN VTON v1.5 (and CatVTON as fallback) on Hugging Face Spaces with gradio_client, on our real product photos.

Steps 1 to 6 exactly as the plan says. Ask me for an HF_TOKEN if none is set (a free Hugging Face account token, read access). Stop as soon as the daily quota message appears and report how many renders you got.

Commit only apps/tryon_test/REPORT.md and the output images, plus a .gitignore for the venv. Never write into /home/jb/Projects/Wear-Right/docs/plans/ (that folder is the lead's; copy from it, never back to it).

Report: view_api output, corrected call code, the results table, the images side by side, and your honest verdict.
```

---

## Prompt 12: Mannequin (alpha) for curated products

```
You are working on Wear Right (FYP). Copy /home/jb/Projects/Wear-Right/docs/plans/ into this worktree's docs/plans/ (never the other way round). Read CLAUDE.md, docs/STATUS.md, docs/plans/08-outfit-board-and-media.md (what exists now), docs/plans/10-alpha-mannequin.md and, if present, apps/tryon_test/REPORT.md. Do only plan 10.

Order, one commit each, tests in the same commit:
1. tools/alpha_mannequin/: PROMPT.md (the fixed prompt), extract_layer.py (cloth mask x changed pixels x slot region, clean-up, alignment check), render_hf.py (only if plan 09's report says the HF route works; quota-aware, resumable). pytest on synthetic pairs.
2. catalog.MannequinLayer + migration, import_alpha_layers command, serializer field alpha_layer (approved only).
3. Admin: layer upload, composite preview on the base image, Approve.
4. Web: AlphaMannequin component, "Outfit board | Mannequin (alpha)" tabs in CompleteOutfitView and OutfitPreviewModal, "Try on (alpha)" badge and shop filter. vitest.
5. Produce the alpha set: pick the ~24 products listed in the plan from the catalogue (send me the list first and wait for OK), render them (HF route or tell me which ones to do by hand in the Gemini app, with the exact files to upload), extract, import, review in the admin.
6. Docs: STATUS.md, DEMO.md, docs/phases/phase-6.md with the "approaches tried" table and the thesis wording from the plan.

Testing: `make test` and the web build. No Playwright. Manual checks from the plan, screenshots to docs/phases/phase-6-screens/alpha/.

Report: commits, real test/build output, the product list, how each layer was made, rejected renders and why, screenshots.
```

---

## Prompt 08: skin tone, basic

```
You are working on Wear Right (FYP). Read CLAUDE.md, docs/STATUS.md and /home/jb/Projects/Wear-Right/docs/plans/06-skin-tone-basic.md. Do only plan 06. Do not change the skin tone algorithm in scanner/engine beyond the quality gate.

Tasks 1 to 3, one commit each, with tests (quality gate thresholds unit-tested on synthetic images; the "Not right? Choose mine" flow saves the confirmed value). Task 4: only if data/eval/labels.csv and photos exist; otherwise write in STATUS.md that the evaluation is waiting for the team's labelled selfies, and stop.

Testing: `make test` and the web build. No Playwright. Check /scan by hand in good light, in a dark room and with a blurry photo.

Report: files, real test/build output, what the scan says in each hand check.
```

---

## Final run (lead, once)

After prompt 03: `make check` (test + build + e2e) on the whole app. Failing specs go back to the agent of the plan that touched that area.
