# Work plans for the implementing agents

Written 2026-10-27 by the lead after reviewing the code, `docs/STATUS.md`, `docs/agent/ROADMAP.md` and the app running at Phase 5 (M1).

Each plan is a self-contained task for one agent session. Give the agent `CLAUDE.md`, `docs/STATUS.md` and **one** plan file. Do them in order; each one lists its own acceptance checks.

| # | Plan | Size | Why it matters |
| - | ---- | ---- | -------------- |
| 00 | [00-verify-admin-panel.md](00-verify-admin-panel.md) | small | The admin rework (separate login, RBAC, team CRUD) is already in the tree but was never run on the team machine. Two reported bugs (`/admin/login` 404, admin can log in as a shopper) are almost certainly stale servers. Verify, fix if not, update docs. |
| 01 | [01-catalog-slots-and-anchor.md](01-catalog-slots-and-anchor.md) | medium | The product you open is not the one on the mannequin. Root cause is missing `slot`/`gender` on products added from the admin panel, so the look engine treats the anchor as "unknown" and fills its slot with another product. Must land before 02. |
| 02 | [02-mannequin-2d-svg.md](02-mannequin-2d-svg.md) | large | Replace the grey statue + pasted photos with a basic flat 2D SVG mannequin: garments drawn as shapes in the product's colour, two shoes on two feet, watch on the wrist. This is the Phase 6 USP, done the simple way the team decided. |
| 03 | [03-shop-cleanup.md](03-shop-cleanup.md) | small | Dead legacy order code, the old single-product order endpoint, stale docs, small UI issues found in review. |
| 07 | [07-ar-try-on.md](07-ar-try-on.md) | large | **Superseded by 08** — AR try-on could not track real photos, so the mannequin work was dropped entirely. Kept as thesis future work. |
| 05 | [05-virtual-try-on.md](05-virtual-try-on.md) | — | **Superseded by 08** (was already superseded by 07; diffusion try-on needs a GPU we don't have). Kept as thesis future work. |
| 06 | [06-skin-tone-basic.md](06-skin-tone-basic.md) | small | Skin tone scaled down to an honest, correctable estimate plus a small real evaluation. |
| 04 | [04-password-reset-and-email.md](04-password-reset-and-email.md) | medium | Forgot password for shoppers and admins, Mailpit as the local mail server, a few basic emails (welcome, order placed, order status). Keeps Django auth; explains why not better-auth. |
| 08 | [08-outfit-board-and-media.md](08-outfit-board-and-media.md) | large | **The new USP: skin-tone-aware outfit completion shown as an outfit board** — the look's real product photos arranged top over bottom over shoes, accessories alongside, swappable tile by tile, one-click add to cart. Also moves product media out of the repo (`MEDIA_ROOT`, `SERVE_MEDIA`, `check_media`, `make media-backup`) and sends every photo through a placeholder-falling-back component. |

## Rules for every plan

- Read the files a plan names before changing them. Do not refactor outside the plan.
- Tests ship in the same commit as the code. Never delete or weaken a test to get green; if a test describes behaviour the plan replaces, rewrite it to the new behaviour and say so in the report.
- **Testing policy (overrides any e2e/Playwright gate written inside a plan):** do not run Playwright or `make e2e` while working. Before reporting run `make test` (pytest, vitest, tsc, lint) and `npm --prefix apps/web run build`, then start the app (`npm run dev`) and check the feature by hand in the browser: what was built, and whether it is wired into the rest of the app (the pages that use it, the API it calls, the admin and shop flows around it). If a plan rewrites behaviour that an e2e spec covers, update the spec so it matches, but do not run it; the lead runs `make e2e` once at the end.
- Finish with a short report: what changed (files), what was run (real output), what is left open. Update `docs/STATUS.md`.
- `docs/agent/` is gitignored; these plans live in `docs/plans/` so the whole team has them.

## What is left overall (after these four plans)

From `docs/agent/ROADMAP.md` and `docs/STATUS.md`:

1. **Skin tone**: scaled down to plan 06 (decided 2026-10-28). The USP is the outfit board from plan 08 (skin-tone-aware outfit completion; mannequin plans 02/05/07 dropped).
2. **Phase 8: user study scripts, demo hardening** (offline models, backup screen recording, demo checklist). Not started.
3. **Auth extras**: password reset and email are plan 04. Email verification and login rate limiting stay optional.
4. **Next.js 16.4.0 security advisory**: ask before upgrading (STATUS says so); do it in its own branch after the demo is stable.

Things STATUS still lists as open that are now done or covered: admin static tabs (done in the admin rework, verified by plan 00), mannequin quality (moot — the mannequin was dropped by plan 08).
