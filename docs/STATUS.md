# Status

## Current phase

**Phase 5 (functional freeze M1) is complete.** The storefront journey works end to end: browse and filter the catalogue, create an account, pick a skin tone (scan or manual fallback), get recommendations, complete a look, use a server-backed cart, check out with cash on delivery or demo card, see order history/detail, cancel while pending, and manage products and order status as staff.

Phase 6's USP changed direction on 2026-10-28 (plan 08): the SVG mannequin (and the AR/diffusion try-on attempts) were dropped — both failed on real data — and the USP is now the **outfit board**: the complete look shown as the products' own photos arranged top over bottom over shoes, accessories alongside, swappable tile by tile. Product media moved out of the repo (`MEDIA_ROOT` from the env, served independently of `DEBUG`, with `check_media` and `make media-backup`). See `docs/plans/08-outfit-board-and-media.md`. Phase 7 (skin-tone algorithm v2 + `evaluate_scanner`) and Phase 8 (user study and demo hardening) are not started.

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

Gates on the plans 00–04 branch, run on 2026-10-28:

```
backend pytest     555 passed, 9 skipped
web vitest         129 passed (15 files)
tsc --noEmit       clean
eslint             0 errors, 2 warnings
next build         passed (after the 16.4.0 security-advisory retry)
Playwright         not run by this agent; the lead runs it after review
```

The email tests use Django's in-memory backend (`mail.outbox`); Mailpit itself was checked by hand in the manual pass, not by pytest.

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
- **Password reset stays in Django auth; no new auth framework.** The project keeps Django users and `dj-rest-auth`/simplejwt cookies. Adding better-auth would have put user and session tables in Node, duplicated Django's auth and CSRF/RBAC, and broken the rule that Next.js never touches the database. Instead the existing `PasswordResetForm` token flow is reused behind `POST /api/auth/password/reset/` and `/confirm/`, with separate admin-audience endpoints under `/api/admin/auth/` (and a set-password variant for team invites). The request endpoint always answers "If an account exists for this email, we sent a reset link.", sends nothing for unknown or ineligible accounts (shop ignores staff, admin ignores customers), and both audiences are throttled at 5/hour. Links point at `FRONTEND_URL` (`/reset-password` or `/admin/reset-password`); a successful reset blacklists every outstanding refresh token so old sessions die. Django's `PASSWORD_RESET_TIMEOUT` is one hour.
- **Email is local-first and never blocks a request.** `docker-compose.yml` runs Mailpit (`axllent/mailpit`) on SMTP 1025 with its inbox at <http://localhost:8025>; `make db-up` starts it with Postgres. Django reads `EMAIL_*`, `DEFAULT_FROM_EMAIL`, `FRONTEND_URL` and `PASSWORD_RESET_TIMEOUT` from the environment with local defaults. `core.emails.send_email` renders both a plain-text and an HTML part from `core/templates/emails/`, and logs and swallows any SMTP or template error, so a dead mail server cannot roll back a signup, checkout or reset. Messages triggered inside a transaction use `transaction.on_commit`. Transactional mail now covers welcome (registration), order placed, order status (admin change or customer cancel), password reset and team invite. Email verification at signup is deliberately out of scope because it would block the seeded demo accounts.
- **Catalogue keeps the legacy fields** (`category` text, `cultural_tag`, `garment_type`, per-size stock) beside the new `category_ref`, `style`, `primary_color`, `sizes` and `is_active`. A full destructive rewrite would have broken the recommender, mannequin and imported data. `category_ref` is the supported relation; serializers keep both sides in sync.
- **Products know what they are, not just where they go.** `Product.kind` (`catalog/engine/kinds.py`, migration `0008_product_kind` backfills) is the garment type guessed from the name/category words (tshirt, shirt, kurta, jeans, sandals, dupatta, ..., 24 kinds); the serializer also fills a blank `slot` from the kind and a blank `gender` from the category, without ever clobbering already-set values on partial updates. The look engine uses it: a one-piece anchor (kurta/kameez/dress) covers its own slots (COVERS map in `recommender/engine/looks.py`), so a shirt anchor no longer lets the template re-fill the "Top" slot, kids-named products never pair into adult looks (and never appear in top picks), and the complete-look API reports `anchor_slot` / `anchor_kind`. The mislabelled import row "Heavy Shirt" (garment_type=Accessory) is now correctly a men's top. E2e regression: `e2e/09` test 9f.
- **Products API is paginated** (12 per page, `page_size` up to 500) and keeps the old `status`, `total_products`, `products` keys for existing callers, while adding `count`, `next`, `previous`, `results`, `page`, `page_size`, `total_pages`. The shop pages client-side over the full seeded catalogue; the server filters are implemented and tested and can be adopted incrementally.
- **The mannequin was dropped (plan 08, 2026-10-28).** The SVG "fashion flat" (plan 02) and the AR try-on (plan 07) both failed on real data; the diffusion try-on (plan 05) needs a GPU the team does not have. The USP is skin-tone-aware outfit completion shown as an **outfit board**: `features/outfit/board.ts` lays the complete-look response out (kurta/dress as one tall tile, outerwear overlapping the top, footwear below, accessories in a side column), `OutfitBoard.tsx` draws it in `CompleteOutfitView` and `OutfitPreviewModal`. A slot whose piece is out of stock keeps a dashed "No match in stock" tile; a piece the shopper dropped reads "Not included". The backend `prepare_mannequin_asset` cut-out pipeline stays: its transparent cut-outs (`Product.mannequin_image` when `mannequin_ready`) are the board's preferred tile images, with `Product.image` as the fallback. `Product.display_hex` (`catalog/engine/color.py`) stays in the API for stability even though nothing paints with it now.
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
- **Next.js upgraded to 16.4.1 for the October 2026 security advisory** (two critical RCEs + one high-severity DoS in React Server Components, patched in 16.4.1 / 15.5.28). `next upgrade --agent=security` crashed with a bus error on this machine, so the upgrade was applied as a direct npm pin (`next` + `eslint-config-next` at exactly 16.4.1); the build no longer prints the advisory notice.
- **Product media lives outside the repo.** `MEDIA_ROOT` comes from the environment (default `apps/server/media`, documented in `.env.example`, e.g. `/home/jb/wear-right-data/media`) so every worktree sees the same uploads. Django serves `/media/` while `SERVE_MEDIA=True` — independent of `DEBUG`, because `static()` only served with `DEBUG=True` and hid photos from the production demo build; set `SERVE_MEDIA=False` behind a real web server. `manage.py check_media` lists product photos whose file is missing on disk (with counts) and `--fix` clears the dead references so the UI shows its placeholder; `make media-backup` tars the folder into a dated archive in the home folder. Every product photo in the web app goes through `components/ProductImage.tsx` (lazy, placeholder after one failed load). See Plan 08.
- **Tests use a small fixture CSV** for the catalogue importer because the Kaggle archive is not in the repo. The real import remains a documented command, not a verified full-dataset run.

## Open issues

- Real face-scan accuracy is unmeasured; no labelled photo set has been run. Thresholds are the algorithm's starting values. This is Phase 7 work.
- Recommendations use colour-theory rules, not measured user preference or sales data. The palette and look ranking need a user study (Phase 8).
- The mannequin is gone (plan 08); the outfit board shows real product photos, so photo quality and consistent product photography now matter more than ever. Cut-out generation (`make mannequin-assets`) still feeds the board's transparent tiles.
- Email verification at signup and shop/admin login rate limiting are not implemented. Password reset (both audiences) is implemented; customer-initiated order editing is still missing.
- Demo card payment is not a payment integration and must never be presented as one.
- The shared Postgres database may contain migrations from other checkouts; merge the branch before switching checkouts. Migrations added in this work: catalog `0005`–`0007`, orders `0003`.
- `docs/agent/` stays local/gitignored, so phase prompts are not shipped. Only `docs/phases/` summaries are tracked.

## How to run

```bash
make install
make demo-data      # Postgres, migrations, catalogue, rules, demo customer + staff
npm run dev         # http://localhost:3000
```

Demo logins: customer `demo@wearright.local` / `demo12345` (at `/login`); staff `admin@wearright.com` / `admin123` — staff sign in at the admin panel's own login, `/admin/login` (shop login refuses team accounts). Local email lands in Mailpit at <http://localhost:8025>; `make db-up` starts it with Postgres.

Full gate: `make test && make build && make e2e`. The Playwright suite reuses running servers when present.
