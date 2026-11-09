# Plan 00: verify the admin panel rework and close the two reported bugs

## Context

The admin panel was reworked (uncommitted in the working tree, 2026-10-27):

- New Django app `apps/server/staff/`: `AdminRole`, `AdminMember`, admin-only JWT cookies (`wr-admin-access`, `wr-admin-refresh`, scoped to `/api/admin/`, plus a `wr-admin-session` hint cookie), and every admin endpoint under `/api/admin/*` with RBAC (`staff/permissions.py`, keys in `staff/catalog.py`).
- Migrations `staff/0001_initial` and `staff/0002_default_roles_and_members` (creates Super Admin, Manager, Inventory Staff, Order Handler, and gives every existing staff user the Super Admin role).
- Shop login refuses staff accounts (`accounts/serializers.py` LoginSerializer); shop cookie auth ignores staff users (`core/authentication.py`).
- Web: `/admin/login` (own login page), `/admin` + `/admin/<section>` URLs, collapsible sidebar, Team & Roles CRUD, real Settings (name, password), tone rules editor, shop navbar/footer hidden under `/admin`. Files: `apps/web/src/app/admin/**`, `components/admin/**`, `features/admin/**`, `lib/api.ts` (admin refresh scope), `lib/routes.ts`, `proxy.ts`.
- Tests added: `staff/tests/*` (41 tests), `e2e/05-admin.spec.ts` rewritten, admin login helper `adminLogin()` in `e2e/fixtures.ts`.

Reported after it was copied in:

1. **`/admin/login` gives a 404.**
2. **An admin can still log in on the shop as a normal user.**

## Most likely cause (check this first)

Both symptoms match servers started *before* the files were copied in:

- `npm run demo` serves the **old production build** with `next start` (no `/admin/login` route existed in that build, so 404) and runs Django with `--noreload` (old login code, so staff can still sign in on the shop).
- Even with `npm run dev`, the new `staff` app needs `make migrate`, and Django must restart to pick up `INSTALLED_APPS`.

## Tasks

1. Stop every running server (`Ctrl+C` the `npm run dev`/`npm run demo` terminals; check nothing is left on ports 3000/8000: `lsof -i :3000 -i :8000`).
2. `make migrate` and confirm the output applies `staff.0001_initial` and `staff.0002_default_roles_and_members`.
3. `rm -rf apps/web/.next` then start with `npm run dev` (or `npm --prefix apps/web run build && npm run demo` for the demo build).
4. Manually check, and write the results in the report:
   - `http://localhost:3000/admin` with no session redirects to `/admin/login?next=%2Fadmin`.
   - `/admin/login` with `admin@wearright.com` / `admin123` lands on `/admin` (dashboard).
   - Same credentials on the shop `/login` show "This is a team account. Sign in to the admin panel at /admin/login instead."
   - `demo@wearright.local` on `/admin/login` is refused ("no admin access").
   - Sidebar collapse button works and survives a reload; each section changes the URL (`/admin/orders`, `/admin/team`, ...).
   - Team & Roles: add a member with the Order Handler role, sign in as them in a private window: they see Orders/Bookings, no Team, and `/admin/products` has no Add/Edit/Delete buttons.
5. **Only if a check still fails after steps 1 to 3**, debug it:
   - 404 on `/admin/login`: confirm `apps/web/src/app/admin/login/page.tsx` exists and `npx next typegen` lists the route; check the dev server log for a route conflict between `admin/login` and `admin/[section]` (a static segment must win over `[section]`; `generateStaticParams` in `[section]/page.tsx` must not list `login`).
   - 404 from the API (`POST /api/admin/auth/login/` in the network tab): `python manage.py show_urls` is not installed, so run `python -c "import django,os;os.environ['DJANGO_SETTINGS_MODULE']='core.settings';django.setup();from django.urls import resolve;print(resolve('/api/admin/auth/login/'))"` from `apps/server`. If it fails, `staff` is missing from `INSTALLED_APPS` or `core/urls.py` lacks `path('api/admin/', include('staff.urls'))` above the other `api/` includes.
   - Admin can still log in as a shopper: hit `POST /api/auth/login/` with curl using the admin credentials; it must answer 400. If it answers 200, the running Django is old code or `accounts/serializers.py` LoginSerializer lost the `is_staff` check.
6. Run the gates: `make test`, `npm --prefix apps/web run build`, `npx playwright test e2e/02-private-redirect.spec.ts e2e/05-admin.spec.ts e2e/06-all-routes.spec.ts e2e/11-signup-toasts-categories.spec.ts`.
7. Docs:
   - `docs/STATUS.md`: remove the "Admin tabs still show legacy static demo content" open issue; add a Decisions entry for "Admin sessions are separate from shop sessions (own cookies scoped to /api/admin/, own login at /admin/login); RBAC roles in `staff`"; update demo logins (staff sign in at `/admin/login`).
   - `docs/DEMO.md`: admin steps start at `/admin/login`.
   - `CLAUDE.md` "Auth and permissions": one paragraph on the admin session and the `staff` app; add `staff` to the domain apps table.
8. Commit on a branch (`feat/admin-rbac`), one commit for the code already present, one for docs.

## Acceptance

- Every manual check in step 4 passes and is listed in the report.
- Gates in step 6 green with real output pasted.
- No new code unless step 5 found a real defect; if so, a regression test comes with the fix.

## Out of scope

Password reset, email invites, audit log, per-object permissions.
