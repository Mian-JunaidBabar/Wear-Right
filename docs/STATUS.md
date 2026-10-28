# Status

## Current phase

**Phase 5 (functional freeze M1) is complete.** The storefront journey works end to end: browse and filter the catalogue, create an account, pick a skin tone (scan or manual fallback), get recommendations, complete a look, use a server-backed cart, check out with cash on delivery or demo card, see order history/detail, cancel while pending, and manage products and order status as staff.

Phase 6's first step shipped early: the web app now draws a flat 2D SVG mannequin instead of the grey statue and photo layers (see `docs/phases/phase-6.md`). Phase 7 (skin-tone algorithm v2 + `evaluate_scanner`) and Phase 8 (user study and demo hardening) are not started.

`docs/agent/phase-1.md` (the step-by-step Phase 1 prompt) is not present in this checkout or anywhere on disk. `docs/agent/` is gitignored. Phase 1 was therefore verified from the roadmap and the existing code/tests rather than followed step by step; there was no Step 0 to run. This is recorded honestly rather than reconstructed.

## Gates at the M1 freeze

Run on 2026-10-27 in this checkout, with the real Postgres catalogue (356 products):

```
backend pytest     450 passed
web vitest          99 passed (11 files)
tsc --noEmit        clean
eslint              clean (2 harmless unused-disable warnings)
next build          passed
manage.py check     no issues
makemigrations --check  no changes
Playwright          48 passed (4.5m), EXIT:0
models tests        10 passed (real MediaPipe/rembg, 41.23s)
```

The exact Playwright count and any skipped model-dependent scenarios are in the Phase 5 summary and the final report. Model tests (`make test-models`) still require downloaded weights and were not part of the functional M1 gate.

Gates on the plans 00–03 branch, run on 2026-10-28:

```
backend pytest     531 passed, 9 skipped
web vitest         117 passed (13 files)
tsc --noEmit       clean
eslint             0 errors, 2 warnings
next build         passed (after the 16.4.0 security-advisory retry)
Playwright         not run by this agent; the lead runs it after review
```

## Roadmap phase map

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Next.js port, real auth, permissions | done (prompt file missing; verified by gates) |
| 2 | Catalogue and admin CRUD, import, colour, filters, pagination | done with open items |
| 3 | Server cart, checkout, multi-item orders, stock, status | done |
| 4 | Functional scan → recommendations → complete look | done with open items |
| 5 | Functional freeze M1, full journey, mobile, docs, tag | done |
| 6 | Layered mannequin | done (basic flat 2D SVG mannequin; later phases can add drape/back view) |
| 7 | Skin tone v2 + scanner evaluation | not started |
| 8 | User study, demo hardening | not started |

Summaries: `docs/phases/phase-2.md` to `phase-6.md`; walkthrough: `docs/DEMO.md`.

## Decisions and deviations

- **Auth** uses dj-rest-auth + simplejwt with httpOnly `wr-access` / `wr-refresh` cookies and CSRF double-submit. There is a non-httpOnly `wr-session=1` hint cookie so guests do not trigger `/me/` 401s. Invalid tokens are treated as anonymous; protected endpoints still return 401. See `core/authentication.py`, `core/tests/test_csrf.py`.
- **Admin sessions are separate from shop sessions.** The admin panel has its own app (`apps/server/staff/`), its own login at `/admin/login`, its own endpoints under `/api/admin/*` and its own JWT cookies (`wr-admin-access` / `wr-admin-refresh`, scoped to the `/api/admin/` path, plus a non-httpOnly `wr-admin-session` hint cookie for the `/admin` proxy redirect). Roles and permissions live in `staff` (`AdminRole`, `AdminMember`, `staff/permissions.py`, keys in `staff/catalog.py`); seeded roles are Super Admin, Manager, Inventory Staff and Order Handler, and every existing staff user was migrated onto Super Admin. Shop login (`/api/auth/login/`) now refuses staff accounts so the two session types cannot mix; admin login refuses users whose account has no admin member. The admin UI hides sections a role cannot use and gates manage buttons behind `products.manage` / `orders.manage` / `bookings.manage` / `catalog.manage` / `team.manage` — the server enforces the same keys.
- **Catalogue keeps the legacy fields** (`category` text, `cultural_tag`, `garment_type`, per-size stock) beside the new `category_ref`, `style`, `primary_color`, `sizes` and `is_active`. A full destructive rewrite would have broken the recommender, mannequin and imported data. `category_ref` is the supported relation; serializers keep both sides in sync.
- **Products know what they are, not just where they go.** `Product.kind` (`catalog/engine/kinds.py`, migration `0008_product_kind` backfills) is the garment type guessed from the name/category words (tshirt, shirt, kurta, jeans, sandals, dupatta, ..., 24 kinds); the serializer also fills a blank `slot` from the kind and a blank `gender` from the category, without ever clobbering already-set values on partial updates. The look engine uses it: a one-piece anchor (kurta/kameez/dress) covers its own slots (COVERS map in `recommender/engine/looks.py`), so a shirt anchor no longer lets the template re-fill the "Top" slot, kids-named products never pair into adult looks (and never appear in top picks), and the complete-look API reports `anchor_slot` / `anchor_kind`. The mislabelled import row "Heavy Shirt" (garment_type=Accessory) is now correctly a men's top. E2e regression: `e2e/09` test 9f.
- **Products API is paginated** (12 per page, `page_size` up to 500) and keeps the old `status`, `total_products`, `products` keys for existing callers, while adding `count`, `next`, `previous`, `results`, `page`, `page_size`, `total_pages`. The shop pages client-side over the full seeded catalogue; the server filters are implemented and tested and can be adopted incrementally.
- **The mannequin is a flat 2D SVG ("fashion flat"), not photos.** `apps/web/src/features/mannequin/` (`geometry.ts` key points, `garments.ts` one vector shape per garment kind, `layout.ts` layering) draws every product in its colour on one `<svg viewBox="0 0 400 800">` body — shoes are a left/right pair, the watch sits on the wrist, no photos on the body, no per-item screenshots. clothing layers follow the z order bottom → top → outerwear → shoes → accessories; a product with no drawable shape (bags) is listed under the body. `Product.display_hex` (`catalog/engine/color.py`) gives the serializer and adapter one colour fallback chain. The web no longer uses `mannequin_image` / `anchors.json` (both removed from `public/`); the backend mannequin-image pipeline and its tests stay, unused. See Plan 02.
- **There is one order path, and only staff can use the legacy one.** The web app's dead checkout/order modals were removed; shoppers add to the cart and finish at `/checkout`. `POST /api/orders/` (the single-product order creator that skipped size stock and created no `OrderItem` rows) is staff-only, while `GET /api/orders/` stays available to signed-in customers. The service function remains for staff smoke tests. See Plan 03.
- **Responsive fixes from Plan 03.** The product detail grid uses `minmax(0, 45fr) / minmax(0, 55fr)` so its gap no longer pushes the page 8px past a 1280px viewport; the admin product table pins its product name/photo column while the table scrolls sideways. Both are covered by checks (the overflow spec now includes 1280px).
- **Colour** is a real table (`Color`: name, hex, family) plus `Product.primary_color`. Uploading an image can suggest a dominant colour with the existing OpenCV/Lab helper; staff can override it. A suggestion is a suggestion, not a measured label.
- **Cart** is server-backed for signed-in users and localStorage for guests. On login the guest cart is merged into `/api/cart/merge/`; the server then owns quantity, size and stock checks. The navbar and pages share one server-cart snapshot so the badge updates immediately.
- **Checkout** is one transaction with `select_for_update`: it validates stock and size, snapshots name/price into `OrderItem`, decrements stock (including per-size stock), clears the cart and generates `WR-XXXXXXXX`. Failure leaves the cart and stock untouched.
- **Payment** is `cod` or `card_demo` only. The card option is explicitly a demo; the API rejects card-number/CVV/expiry fields rather than storing them. No payment processor is integrated.
- **Order status** follows only Pending → Confirmed/Cancelled, Confirmed → Shipped/Cancelled, Shipped → Delivered. Customers can cancel while pending/confirmed and stock is restored; staff change status through `/api/orders/<id>/status/`.
- **Scan API** accepts `image` (and the old `images` list), returns `depth`, `undertone`, `confidence`, `palette` plus legacy keys, and answers 422 for no face. `/api/scanner/manual/` lets a shopper pick Fair/Medium/Dark + warmth so the journey never depends on face detection. A no-face upload shows the rescan card and manual picker, not a dead end.
- **Demo prices are placeholders.** The Kaggle catalogue has no prices, so `make demo-catalog`/seed values are labelled demo data, not real market prices.
- **Postgres runs on 5433** because 5432 is used by a local Postgres. Compose project name is pinned to `wear-right`. During setup the unrelated `deepkhata-postgres-1` container was stopped to free 5433; it was **not** restarted. Start it again if that project is needed.
- **Build environment:** this worktree originally symlinked `node_modules` and `apps/server/venv`, media and model folders (all gitignored). Turbopack rejects a `node_modules` symlink outside the project root, so the symlinked `node_modules` folders were replaced with real copies for verification. This is an environment detail, not a repository change. The tracked build command is `npm run build`.
- **Next.js 16.4.0 has a published security advisory.** The build and dev server completed after acknowledging the advisory, but the upgrade was not applied as part of M1. Ask before running `next upgrade --agent=security` in a separate worktree.
- **Tests use a small fixture CSV** for the catalogue importer because the Kaggle archive is not in the repo. The real import remains a documented command, not a verified full-dataset run.

## Open issues

- Real face-scan accuracy is unmeasured; no labelled photo set has been run. Thresholds are the algorithm's starting values. This is Phase 7 work.
- Recommendations use colour-theory rules, not measured user preference or sales data. The palette and look ranking need a user study (Phase 8).
- The mannequin is deliberately basic: flat 2D front view only, no back view, draping or poses. The photo-like realism in the original PRD remains future work.
- Password reset, email verification, login rate limiting and customer-initiated order editing are not implemented.
- Demo card payment is not a payment integration and must never be presented as one.
- The shared Postgres database may contain migrations from other checkouts; merge the branch before switching checkouts. Migrations added in this work: catalog `0005`–`0007`, orders `0003`.
- `docs/agent/` stays local/gitignored, so phase prompts are not shipped. Only `docs/phases/` summaries are tracked.

## How to run

```bash
make install
make demo-data      # Postgres, migrations, catalogue, rules, demo customer + staff
npm run dev         # http://localhost:3000
```

Demo logins: customer `demo@wearright.local` / `demo12345` (at `/login`); staff `admin@wearright.com` / `admin123` — staff sign in at the admin panel's own login, `/admin/login` (shop login refuses team accounts).

Full gate: `make test && make build && make e2e`. The Playwright suite reuses running servers when present.
