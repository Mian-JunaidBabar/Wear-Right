# Status

## Current phase

**Phase 5 (functional freeze M1) is complete.** The storefront journey works end to end: browse and filter the catalogue, create an account, pick a skin tone (scan or manual fallback), get recommendations, complete a look, use a server-backed cart, check out with cash on delivery or demo card, see order history/detail, cancel while pending, and manage products and order status as staff.

The next milestone is not started: Phase 6 (layered mannequin), Phase 7 (skin-tone algorithm v2 + `evaluate_scanner`), Phase 8 (user study and demo hardening). Per the roadmap, stop here.

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

## Roadmap phase map

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Next.js port, real auth, permissions | done (prompt file missing; verified by gates) |
| 2 | Catalogue and admin CRUD, import, colour, filters, pagination | done with open items |
| 3 | Server cart, checkout, multi-item orders, stock, status | done |
| 4 | Functional scan → recommendations → complete look | done with open items |
| 5 | Functional freeze M1, full journey, mobile, docs, tag | done |
| 6 | Layered mannequin | not started |
| 7 | Skin tone v2 + scanner evaluation | not started |
| 8 | User study, demo hardening | not started |

Summaries: `docs/phases/phase-2.md` to `phase-5.md`; walkthrough: `docs/DEMO.md`.

## Decisions and deviations

- **Auth** uses dj-rest-auth + simplejwt with httpOnly `wr-access` / `wr-refresh` cookies and CSRF double-submit. There is a non-httpOnly `wr-session=1` hint cookie so guests do not trigger `/me/` 401s. Invalid tokens are treated as anonymous; protected endpoints still return 401. See `core/authentication.py`, `core/tests/test_csrf.py`.
- **Admin sessions are separate from shop sessions.** The admin panel has its own app (`apps/server/staff/`), its own login at `/admin/login`, its own endpoints under `/api/admin/*` and its own JWT cookies (`wr-admin-access` / `wr-admin-refresh`, scoped to the `/api/admin/` path, plus a non-httpOnly `wr-admin-session` hint cookie for the `/admin` proxy redirect). Roles and permissions live in `staff` (`AdminRole`, `AdminMember`, `staff/permissions.py`, keys in `staff/catalog.py`); seeded roles are Super Admin, Manager, Inventory Staff and Order Handler, and every existing staff user was migrated onto Super Admin. Shop login (`/api/auth/login/`) now refuses staff accounts so the two session types cannot mix; admin login refuses users whose account has no admin member. The admin UI hides sections a role cannot use and gates manage buttons behind `products.manage` / `orders.manage` / `bookings.manage` / `catalog.manage` / `team.manage` — the server enforces the same keys.
- **Catalogue keeps the legacy fields** (`category` text, `cultural_tag`, `garment_type`, per-size stock) beside the new `category_ref`, `style`, `primary_color`, `sizes` and `is_active`. A full destructive rewrite would have broken the recommender, mannequin and imported data. `category_ref` is the supported relation; serializers keep both sides in sync.
- **Products API is paginated** (12 per page, `page_size` up to 500) and keeps the old `status`, `total_products`, `products` keys for existing callers, while adding `count`, `next`, `previous`, `results`, `page`, `page_size`, `total_pages`. The shop pages client-side over the full seeded catalogue; the server filters are implemented and tested and can be adopted incrementally.
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
- The mannequin exists and places garment layers, but its bodies are procedural grey shapes and placement is box-based. Realistic bodies, drape and back photos are Phase 6.
- Password reset, email verification, login rate limiting and customer-initiated order editing are not implemented.
- Demo card payment is not a payment integration and must never be presented as one.
- The product detail grid had an 8px horizontal overflow at 1280px in the legacy layout; the M1 mobile check covers 390px only.
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
