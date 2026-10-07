# Status

## Current phase
Phase 1 (Next.js UI port, real auth, permissions): **done**. Next: Phase 2 (catalog schema, Kaggle import, rembg cutouts, color extraction).

## Deviations from plan
- Postgres is published on host port **5433**, not 5432 (5432 is taken by a local Postgres on the dev machine). `docker-compose.yml`, `.env.example` and the settings default all use 5433. The compose project name is pinned to `wear-right` so every checkout/worktree manages the same container.
- Venv lives at `apps/server/venv` (CLAUDE.md, `run.sh`, Makefile and root `package.json` agree).
- `apps/web` uses a `src/` directory (`src/app`, `src/lib`, `src/features`, `src/components`), so `proxy.ts` is `apps/web/src/proxy.ts`.
- Phase 0 was not actually complete when Phase 1 started (Makefile, root package.json, README, `lib/api.ts`, rewrites, tests were missing and `/api/...` URLs had been moved under `/api/<app>/`). Fixed in commit `fix: phase 0 gaps`. Acceptance results are in the Phase 1 report.
- `next lint` no longer exists in Next 16; `npm run lint` runs ESLint directly (`make test` uses it). `npm run typecheck` runs `next typegen && tsc --noEmit`.
- `@types/node` is `^22` (vitest 5 needs it); the runtime requirement is still Node 20.9+.
- Demo admin is username `admin`, email `admin@wearright.local`, password `admin12345` (when `DEBUG`). Login accepts either the email or the username.
- `docs/` is tracked except `docs/agent/` (phase prompts stay local, see `.gitignore`).
- Routes renamed in the port: `/auth` is now `/login` and `/register`; `/facescan` is now `/scanner`. The old URLs redirect.
- Legacy client source was corrupted by accidental duplicated lines/blocks (introduced in commits `248fe9e` and `5e423ef`: duplicated object keys, repeated `alert()` calls, doubled JSX blocks, ten star icons, copy pasted twice, nested ternaries that always took the red branch). Removed during the port with scripts, then reviewed. Last clean version of the client is `cc8e613`.

## Phase 0 verification (done at the start of Phase 1)
As found, before any fix: check 1 FAIL (no Makefile), 2 FAIL (no Makefile, zero tests), 3 FAIL (Django 404 on `/api/products/` because the routes had moved to `/api/catalog/...`; Next answered `/api/products/` with a 308 loop; `/` was the create-next-app page), 4 PASS, 5 PASS, 6 not applicable (the Vite client had already been deleted in `9cc269e`; the port reads it from git history). After `fix: phase 0 gaps`: checks 1 to 5 pass.

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
- `make test`: backend pytest, web vitest, `tsc --noEmit`, eslint.
- `make e2e`: Postgres up, migrate, seed, then Playwright (starts Django and Next if they are not already running). First time: `cd apps/web && npx playwright install chromium`.
- `make check`: test + `next build` + e2e.
