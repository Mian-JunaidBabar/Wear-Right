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

## Prompt 06: try-on spike (one session, before any integration)

```
You are working on Wear Right (FYP). Read /home/jb/Projects/Wear-Right/docs/plans/05-virtual-try-on.md first. This session is a spike only: no changes to apps/server or apps/web.

Goal: find out if an open-source virtual try-on model runs well enough on this machine.

1. Report the hardware: `nvidia-smi` (GPU, VRAM, driver, CUDA), RAM, Python version. If there is no NVIDIA GPU, say so and continue on CPU.
2. Create apps/tryon/ with its own venv (apps/tryon/.venv, gitignored). Clone and install FASHN VTON v1.5 (github.com/fashn-AI/fashn-vton-1.5) as its README says, download the weights into apps/tryon/weights (gitignored).
3. Prepare inputs in apps/tryon/spike/ (gitignored except the report): 2 body images (one man, one woman, full body, front, plain background; free-licence stock photos, write the URLs and licences down) and 5 products from our catalog (2 tops, 2 bottoms, 1 kurta) using their image files from apps/server/media.
4. Run: each top on each body, then each bottom on the result, and the kurta as one-pieces. Measure seconds per render and peak VRAM (torch.cuda.max_memory_allocated).
5. If FASHN fails to install/run or looks bad, repeat steps 2 to 4 with CatVTON (github.com/Zheng-Chong/CatVTON).
6. Write apps/tryon/spike/REPORT.md: hardware, model(s) tried, install problems and fixes, timing and VRAM table, the output images side by side with the inputs, which garments failed and why, and your recommendation using the decision table in plan 05 ("live + prerender", "catvton", or "prerender only").

Do not integrate anything. Commit only apps/tryon/spike/REPORT.md, the output images, apps/tryon/.gitignore and a short apps/tryon/README.md with the exact install commands that worked.
```

---

## Prompt 07: try-on integration (after the spike says go)

```
You are working on Wear Right (FYP). Read CLAUDE.md, docs/STATUS.md, /home/jb/Projects/Wear-Right/docs/plans/05-virtual-try-on.md and apps/tryon/spike/REPORT.md. Use the model and mode the spike recommended. Do only plan 05.

Order, one commit each, tests in the same commit:
1. apps/tryon service: FastAPI app (health, tryon), model loaded once, GPU lock, TRYON_MODEL switch, fake-pipeline unit tests, one @pytest.mark.models real test. Makefile targets: tryon-install, tryon-weights, tryon (run on :8010). Add it to the root `npm run dev` only when apps/tryon/.venv exists.
2. Body images: the 6 bodies in apps/server/tryon_bodies with SOURCES.md (URL + licence for each).
3. Django `tryon` app: TryOnRender model + migration, services (cache key, request_render with a single-thread executor, two-step top then bottom, one-piece path), API (renders POST/GET, status), throttle, prerender_looks command. Category from Product.kind/slot as the plan's mapping table says. Never call the service from inside a request synchronously.
4. Web: try-on panel in OutfitPreviewModal and CompleteOutfitView with polling, body presets, swap re-render, shoes/accessory chips, and the SVG mannequin fallback with the "AI try-on | Sketch" switch.
5. Docs: SETUP.md (install, weights, GPU notes, how to prerender before the demo), DEMO.md, STATUS.md, docs/phases/phase-6.md updated with the try-on decision, real timings from the spike, and the honest limits (no shoes/accessories on the body, third-party model, licence).

Testing: `make test` and `npm --prefix apps/web run build`. Do NOT run Playwright or make e2e. Then by hand: start db, Django, Next and the tryon service; open the shop Preview Outfit for 3 shirts, 2 kurtas and a pair of jeans; switch Slim/Plus; swap a piece; stop the tryon service and confirm the SVG fallback appears; run prerender_looks --limit 10 and confirm those previews open instantly. Save screenshots to docs/phases/phase-6-screens/.

Report: files per commit, real test/build output, render times seen in the app, the screenshots, what looks good and what looks wrong.
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
