# Status

## Current phase
Phases 2 to 5 are **done with open items** (summaries in `docs/phases/`, protocol in `CLAUDE.md`). Next: Phase 6 (server cart, multi-item orders, FashionCLIP tagging).

Gates for the full app at the end of Phase 5: `make test` 427 backend and 99 web passed with `tsc` and `eslint` clean; `make build` passes; `make test-models` 10 passed; `make e2e` 41 scenarios (see the Phase 5 summary).

**Running more than one checkout:** `media/` and `ml_models/` are gitignored, so each checkout needs its own copy (`make models`, `make seed`, `make demo-catalog`), and the Postgres on 5433 is shared, so a migration applied by one checkout affects the others. Merge the branch before running the app from another checkout. End-to-end tests take `E2E_WEB_PORT` and `E2E_API_PORT` so they do not reuse another checkout's dev servers.

## Deviations from plan
- Postgres is published on host port **5433**, not 5432 (5432 is taken by a local Postgres on the dev machine). `docker-compose.yml`, `.env.example` and the settings default all use 5433. The compose project name is pinned to `wear-right` so every checkout/worktree manages the same container.
- Venv lives at `apps/server/venv` (CLAUDE.md, `run.sh`, Makefile and root `package.json` agree).
- `apps/web` uses a `src/` directory (`src/app`, `src/lib`, `src/features`, `src/components`), so `proxy.ts` is `apps/web/src/proxy.ts`.
- Phase 0 was not actually complete when Phase 1 started (Makefile, root package.json, README, `lib/api.ts`, rewrites, tests were missing and `/api/...` URLs had been moved under `/api/<app>/`). Fixed in commit `fix: phase 0 gaps`. Acceptance results are in the Phase 1 report.
- `next lint` no longer exists in Next 16; `npm run lint` runs ESLint directly (`make test` uses it). `npm run typecheck` runs `next typegen && tsc --noEmit`.
- `@types/node` is `^22` (vitest 5 needs it); the runtime requirement is still Node 20.9+.
- A demo customer `demo@wearright.local` / `demo12345` is seeded too (same rule: only when `DEBUG` or `DEMO_USER_PASSWORD` is set). `make demo` runs the production build; `make demo-reset` is db-reset + migrate + seed. Walkthrough: `docs/DEMO.md`.
- Demo admin is username `admin`, email `admin@wearright.local`, password `admin12345` (when `DEBUG`). Login accepts either the email or the username.
- `docs/` is tracked except `docs/agent/` (phase prompts stay local, see `.gitignore`).
- Routes renamed in the port: `/auth` is now `/login` and `/register`; `/facescan` is now `/scanner`. The old URLs redirect.
- Legacy client source was corrupted by accidental duplicated lines/blocks (introduced in commits `248fe9e` and `5e423ef`: duplicated object keys, repeated `alert()` calls, doubled JSX blocks, ten star icons, copy pasted twice, nested ternaries that always took the red branch). Removed during the port with scripts, then reviewed. Last clean version of the client is `cc8e613`.

## Phase 0 verification (done at the start of Phase 1)
As found, before any fix: check 1 FAIL (no Makefile), 2 FAIL (no Makefile, zero tests), 3 FAIL (Django 404 on `/api/products/` because the routes had moved to `/api/catalog/...`; Next answered `/api/products/` with a 308 loop; `/` was the create-next-app page), 4 PASS, 5 PASS, 6 not applicable (the Vite client had already been deleted in `9cc269e`; the port reads it from git history). After `fix: phase 0 gaps`: checks 1 to 5 pass.

## Phase 5 decisions
See `docs/phases/phase-5.md`. In short: 12 procedural bodies and an anchor map (not MPFB renders); a layout engine that places `mannequin_image` cut-outs in slot boxes in a fixed layer order; garments cut out of model photos with rembg's cloth model on a white background; photos of people are detected by face, skin (apparel only) or clothing in the other body layer. Also from the review: 6-character password minimum with a confirm field, toasts instead of alerts, and categories and styles as editable tables (FR-14).

## Phase 4 decisions
See `docs/phases/phase-4.md`. In short: tone-to-colour rules are a database table (`ToneColorRule`, 244 seeded rows, editable by staff); top picks score 0.5 palette + 0.3 style + 0.2 preference, 3 per category, 15 total, each with a reason; looks are filled from four templates (casual, formal, eastern men, eastern women) by colour harmony, palette and formality, with two swaps per slot; the client colour tables are gone. Profiles can store favourite and avoided colours. `make demo-catalog` activates imported drafts with **placeholder** prices (demo only).

## Phase 3 decisions
See `docs/phases/phase-3.md`. In short: MediaPipe landmarks pick cheek and forehead pixels; the v1 face-crop gray-world and the gamma/CLAHE-before-measuring steps are gone; background white balance exists but is off by default; depth by ITA, undertone by hue angle, Monk by nearest swatch; confidence is agreement x skin pixels x lighting; the photo is never stored; a successful signed-in scan is saved on the profile and as a `FaceScanRecord`.

## Phase 2 decisions
- **Draft products.** Imported items are created with status `Draft`, price 0, stock 0 and no sizes. Nothing is invented: the Kaggle dataset has no prices or stock, so an admin sets both. Shoppers never see drafts (the public list leaves them out, the detail returns 404), and `create_order` already refuses any product that is not `Active`. Staff see drafts in the API and admin.
- **New catalog fields** (`catalog/models.py`, migration `0002_product_catalog_fields`): `external_id` (unique Kaggle image id; makes imports idempotent), `slot` (top, bottom, kurta, outerwear, footwear, accessory, dupatta), `gender` (men, women, unisex), `formality` (1 to 5), `style_tags` (list), `color_name`, `color_hex`, `color_palette` (up to 3 clusters: hex, name, share). The legacy fields (`category`, `garment_type`, `cultural_tag`, `compatible_skin_tone`) are still filled so the existing pages keep working. Imports leave the legacy `color` choice field empty; `color_name` is the colour from now on.
- **Mapping rules** (`catalog/engine/kaggle.py`): Kaggle `articleType` to slot, `gender` to gender, `usage` to formality and primary style, and (gender, slot) to the legacy category label. These are initial rules, not measurements. Rows that match no rule are counted in the import report, never guessed. Run `--list-article-types` on the real `styles.csv` before a real import.
- **Selection.** Round-robin across (gender, slot) groups with a fixed seed (default 42). The same seed picks the same products, and a larger `LIMIT` extends a smaller run.
- **Cut-outs.** rembg with `isnet-general-use` (from the PRD). Only the transparent PNG is stored (`products/<kaggle id>.png`). The full-size original is not kept; the Kaggle id links back to it.
- **Colour extraction** (`catalog/engine/color.py`). k-means (k=3, OpenCV) over visible pixels (alpha at least 128) in CIELAB D65, sampled to at most 20,000 pixels. Each cluster is named by the nearest reference colour by CIEDE2000 (coloraide). The reference colours are common web colour anchors, not measurements; tune them in phase 3 if naming drifts. `color_name` keeps the dataset's base colour when there is one.
- **Placeholders until phase 4.** Imported `compatible_skin_tone` is `All`, and `style_tags` come straight from `usage`.
- **Engine layout.** `catalog/engine/` has no Django imports, so it unit-tests without a database. The rembg model is loaded only when a command needs it; tests use a stand-in remover, so no test downloads weights.

## Decisions
- Django ORM only, layered MVC modular monolith (see CLAUDE.md). Local only, no deployment.
- **Auth**: dj-rest-auth + simplejwt. Cookies `wr-access` (30 min) and `wr-refresh` (7 days, rotated, old one blacklisted), both `HttpOnly`, `SameSite=Lax`, `Secure` off (plain http locally). Tokens are never in response bodies. `login/`, `register/` and `me/` return `{user, profile}`.
- **CSRF strategy (cookie auth needs one)**: Django's double-submit token. `JWT_AUTH_COOKIE_USE_CSRF` makes dj-rest-auth enforce a CSRF check on every cookie-authenticated unsafe request (POST/PUT/PATCH/DELETE). Django sets a readable `csrftoken` cookie (on login, register, refresh and `GET /api/auth/me/`); `apps/web/src/lib/api.ts` echoes it in the `X-CSRFToken` header on every unsafe request. Because the Next.js rewrite makes the browser `Origin` (`http://localhost:3000`) differ from Django's `Host` (`127.0.0.1:8000`), those two origins are listed in `CSRF_TRUSTED_ORIGINS` (env var, defaults to localhost/127.0.0.1 on 3000). Requests without cookie auth (guests, login, register, refresh) need no token. Tested in `core/tests/test_csrf.py` (missing header, wrong header, valid header, trusted origin, foreign origin).
- **`wr-session` hint cookie**: a non-httpOnly cookie (value `1`, no secret) set and cleared together with the real tokens. The web app calls `GET /api/auth/me/` on start only when it is present, so guests never trigger 401s. `proxy.ts` and the server do not trust it; Django validates the real cookies on every call.
- **Stale tokens mean anonymous**: `core.authentication.JWTCookieAuthentication` (subclass of dj-rest-auth's) treats an invalid or expired token as anonymous instead of raising 401, so public endpoints keep working for a guest with a stale cookie. Protected endpoints still answer 401.
- **401 handling in the browser**: `lib/api.ts` calls `token/refresh/` once and retries once; refreshes are shared between parallel requests; the auth endpoints themselves never trigger a refresh; if the refresh fails the session-expired listeners clear the user.
- **Permissions** (default `IsAuthenticatedOrReadOnly`): products and recommendations are public read, staff-only write; `scanner/analyze/` and `outfit/generate/` are public; `profiles/`, `orders/`, `bookings/`, `face-scans/` need sign-in and are scoped to `request.user` (staff see everything); `admin/dashboard/` is staff-only. Another user's order or booking is a **404** (existence is not revealed). **Changing or deleting an existing order or booking is staff-only (403 for customers)**; customers only create and read their own. The legacy UI never let customers edit either. Customers cannot self-approve: on create their `order_status` is forced to `Pending` and `payment_status` can only be `Unpaid` or `Cash on Delivery`. `user` is never client-writable.
- `POST /api/profiles/` upserts the caller's own profile and ignores any `user` in the payload. A scan is stored only when the caller is signed in.
- Media URLs from the API are relative (`/media/...`) so the browser only ever talks to port 3000.
- **proxy.ts** only checks that a `wr-access` or `wr-refresh` cookie exists for the private prefixes (`/profile`, `/my-orders`, `/orders`, `/order-confirmation`, `/checkout`, `/bookings`, `/admin`) and redirects to `/login?next=...`. `<RequireAuth>` handles expired sessions client side and the staff-only admin page. `?next=` is only followed when it is a same-site path.
- Cart (`wearRightCart`) and wishlist (`wearRightWishlist`) live in localStorage behind `useCart()`/`useWishlist()` (a `useSyncExternalStore` store; storage failures fall back to memory). Phase 6 moves the cart to the server. Checkout and "Buy Now" need an account: guests are sent to `/login?next=...` and their cart is kept.
- Scanner, recommender and mannequin logic were not changed. A detected skin tone is also saved to the profile (`PATCH /api/auth/me/`) for signed-in users.

## Port inventory (legacy `apps/client/src/App.tsx`, from git `771e736`)

Routes:

| Legacy route | New route | Component | Access |
| --- | --- | --- | --- |
| `/` | `/` | `HomeView` | public |
| `/auth` | `/login`, `/register` | `AuthView` (mode) | public |
| `/profile` | `/profile` | `ProfileView` | signed in |
| `/facescan` | `/scanner` | `FaceScanView` | public |
| `/recommended` | `/recommended` | `RecommendedProductsView` | public |
| `/complete-outfit` | `/complete-outfit` | `CompleteOutfitView` | public |
| `/shop` | `/shop` | `ShopView` | public |
| `/product/:id` | `/product/[id]` | `ProductDetailView` | public |
| `/wishlist` | `/wishlist` | `WishlistView` | public (local) |
| `/about` | `/about` | `AboutView` | public |
| `/contact` | `/contact` | `ContactView` | public |
| `/order-confirmation` | `/order-confirmation` | `OrderConfirmationView` | signed in |
| `/my-orders` | `/my-orders` | `MyOrdersView` | signed in |
| `/admin` | `/admin` | `AdminView` (was `ProtectedAdminView` with a hard-coded password) | staff |
| `*` | `not-found.tsx` (redirects to `/`) | | |

Shared state:

| Legacy state in `App` | Now |
| --- | --- |
| `user` (fake, started logged in as "Aura Identity") | `features/auth` `useAuth()`: `user`, `profile`, `loading`, `login`, `register`, `logout`, `updateProfile`, `setSkinTone` |
| `selectedStyles`, `selectedColors`, `sortBy`, toggles, `resetFilters` | `features/catalog/useFilters.tsx` (`FiltersProvider`) |
| `cartItems`, add/remove/update/clear, `cartCount`, `cartTotal` (memory only) | `features/cart/useCart.ts` (localStorage) |
| `wishlistItems`, add/remove/toggle, `isInWishlist` | `features/wishlist/useWishlist.ts` (localStorage) |
| `currentView` / `setView` | `lib/navigation.ts` (`useSetView`, `viewFromPath`) |
| `wearRightLastOrder` (localStorage) | `features/orders/lastOrder.ts` |
| `wearRightAdminLoggedIn` + password `admin123` | removed; real staff check |

Components (all in `apps/web/src/components/`): `Navbar`, `Footer`, `HomeView`, `FeaturedCarousel` (unused by any route, as in the legacy app), `AuthView`, `ProfileView`, `FaceScanView`, `RecommendedProductsView`, `CompleteOutfitView`, `ShopView`, `ProductDetailView`, `WishlistView`, `AboutView`, `ContactView`, `OrderConfirmationView`, `MyOrdersView`, `AdminView`. `ProtectedAdminView` is replaced by `features/auth/RequireAuth`. `utils/recommendationRules.ts` moved verbatim to `features/recommender/recommendationRules.ts`.

## Phase 5 open issues
- Bodies are placeholders; back photos do not exist, so the back view reuses front photos; about 7% of products cannot be placed (person in photo or a failed extraction).
- Placement realism is unmeasured (checked by eye and by structure tests only).
- Admin upload does not run extraction or mannequin preparation yet; there is no way to upload a back photo.
- The Django admin and the web admin both edit categories and styles (the web screen is the supported one).

## Phase 4 open issues
- Tone rule values are starting points from colour theory, not validated; a user study is the only honest check of the picks and looks.
- Formal looks complete only 19 of 29 times on the demo catalog (no formal tops); Fair + warm shoppers find few best-colour items.
- Favourite and avoided colours have an API but no screen.
- The demo catalog prices are placeholders, and the 150 on-model Kaggle photos will not suit the mannequin (phase 5).
- The shared dev database also has `accounts 0004` and `recommender 0001`.

## Phase 3 open issues
- No labelled photo set exists, so skin tone accuracy is **unmeasured**. ITA and hue thresholds are the PRD's starting values; the Medium band is narrow on the Monk swatches. Run `evaluate_skin_tone` once the 80 to 100 photos are labelled.
- `mediapipe` brings `opencv-contrib-python` next to `opencv-python-headless`; both provide `cv2`.
- Models live in `apps/server/ml_models/` (`make models`); without them the scan endpoint answers 503 and the `models` tests skip.
- The shared dev database now also has `accounts 0003` and `scanner 0002` applied; older checkouts cannot insert scans or profiles until this branch is merged.
- Browser-side face guidance (PRD FR-04) is not built.

## Phase 2 open issues
- **Real data status:** 150 Kaggle products are imported as drafts; colour family agreement with the dataset labels is 57.3% (see `docs/phases/phase-2.md`). Many photos are on-model, so cut-outs include the person.
- **Admin upload does not cut out or tag yet** (FR-13). The building blocks exist: `apply_image_pipeline` in `catalog/services.py` and `make process-images` for existing products. Wiring them into the product API is a small follow-up.
- **Shared dev database.** The Postgres on 5433 is shared by every checkout, and migration `catalog 0002` is now applied to it. The `style_tags` and `color_palette` columns are NOT NULL with no database default. Code from `Junaid/initials` (before this branch is merged) therefore cannot create products on this database (`make seed` and admin create will fail). Merging this branch fixes it.
- **Legacy names remain.** `color`, `garment_type` and the older category labels (for example "Men Cap" used for watches) are still in use. Consolidating them into tables is FR-14, planned for phase 4.
- `docs/agent/phase-2.md` was not in the repo (it is gitignored), so this phase followed the PRD and the phase map in `CLAUDE.md`.

## Open issues
- Password reset is not implemented (the old UI faked it). The "Forgot password" panel now says so and links to WhatsApp support.
- Profile phone and delivery address inputs are still local to the page (no backend field). Checkout asks for them again.
- Customers cannot cancel or edit an order, and there is no customer booking UI (only the admin manages bookings). Phase 6 (orders) should decide.
- Orders and bookings created before this phase have no owner (`user` is null); only staff can see them.
- Admin "Styles", "Skin Tone Matrix", "Outfit Rules", "Team Members" and "Settings" tabs show static demo content (legacy), not data.
- Registration has no email verification; login has no rate limit or lockout.
- `JWT_AUTH_SECURE` is `False` because everything runs on plain http locally; it must be `True` anywhere with HTTPS.
- The product detail grid (`lg:grid-cols-[45%_55%] gap-8`) overflows horizontally by 8px at 1280px wide. This is how the legacy page was written; left alone ("same look").
- `cacheComponents` and `partialPrefetching` (set by the Phase 0 scaffold) are on; client hooks that read runtime data (`usePathname`, `useSearchParams`) must sit inside `<Suspense>`.

## How to run
See README.md. In short: `make install && make db-reset && make migrate && make seed`, then `npm run dev` and open http://localhost:3000.

## Test commands
- Catalog import (after `make seed`): `make import-catalog SOURCE=/path/to/kaggle-folder LIMIT=150`; cut-outs and colours for existing photos: `make process-images`.
- `make test`: backend pytest, web vitest, `tsc --noEmit`, eslint.
- `make e2e`: Postgres up, migrate, seed, then Playwright (starts Django and Next if they are not already running). First time: `cd apps/web && npx playwright install chromium`.
- `make check`: test + `next build` + e2e.
