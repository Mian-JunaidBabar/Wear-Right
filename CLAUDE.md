# Wear Right — agent guide

Wear Right is a Final Year Project (University of Lahore): a fashion store that styles people who don't know fashion. The user scans their face, the system detects skin tone (depth + undertone), recommends 10 to 15 items, completes the outfit (shirt -> pants + shoes + accessory; suit -> shoes + watch + tie; kameez -> footwear + waistcoat), and shows the look on a 2D layered mannequin.

The full PRD and phase playbook live in the team's Claude Doc "Wear Right — PRD & Build Plan". Phase prompts live in `docs/agent/phase-N.md`. Do only the phase you were given.

## Stack (local only, no deployment)

| Layer    | Tech                                                                                   | Port |
| -------- | -------------------------------------------------------------------------------------- | ---- |
| Frontend | Next.js 16 (App Router, TypeScript, Tailwind v4) in `apps/web`                         | 3000 |
| Backend  | Django 5 + Django REST Framework in `apps/server`                                      | 8000 |
| Database | PostgreSQL 17 + pgvector, in Docker (`docker-compose.yml`)                             | 5433 |
| ORM      | Django ORM only. No SQLAlchemy, no Prisma/Drizzle. Next.js never touches the database. |      |
| AI       | OpenCV, MediaPipe, rembg, FashionCLIP (later phases), all run inside Django            |      |

AI model weights are downloaded once with `make models` into `apps/server/ml_models/` (gitignored) and used from there. Nothing downloads at request time.

Python 3.12 (venv at `apps/server/venv`). Node 20.9+.
The legacy Vite client (`apps/client`) was removed. Its source only exists in git history (commit `771e736`).

## Architecture: layered MVC in a modular monolith

The backend is one Django project split into domain apps. Every app follows the same four layers. Dependencies only point downward.

```
Controller   views.py + urls.py        HTTP in/out only. Validate with a serializer, call a service or selector, return a Response. No business logic, no ORM queries beyond trivial get_object.
DTO          serializers.py            Request validation and response shape.
Service      services.py               Business logic and all writes (create/update/delete). Plain functions with keyword args. Transactions live here.
             selectors.py              Read queries. Return querysets or plain data.
Model        models.py                 Django ORM models, constraints, small model methods. No HTTP, no cross-app business logic.
Engine       <app>/engine/             Pure Python algorithms (skin tone, recommender). No Django imports, so they unit-test without a database.
```

Domain apps in `apps/server`:

| App           | Owns                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------ |
| `core`        | settings, root urls, shared base model (`TimeStampedModel`), exception handler, pagination |
| `accounts`    | UserProfile, preferences, auth endpoints (Phase 1)                                         |
| `catalog`     | Product, Category, Color, import + image pipeline                                          |
| `scanner`     | FaceScanRecord, skin tone engine                                                           |
| `recommender` | ToneColorRule (editable colour rules), ranker, look generation (engine in `recommender/engine/`) |
| `orders`      | Cart, Order, OrderItem, Booking                                                            |
| `staff`       | AdminRole, AdminMember, `/api/admin/*` endpoints, admin-only JWT cookies, RBAC permissions  |

Frontend (`apps/web`, sources under `src/`), same idea:

```
app/<route>/page.tsx     View: route entry, composes components
components/              Presentational UI, no fetch calls
features/<domain>/       Controller: hooks + state for one domain (useAuth, useCart, useWishlist, ...), calls lib/api
proxy.ts                 Next.js 16 middleware: sends visitors without a session cookie from private pages to /login
lib/api.ts               Data access: the only place that calls fetch
```

The browser only talks to port 3000. `next.config.ts` rewrites `/api/*` and `/media/*` to Django on 8000. Always call Django URLs with a trailing slash.

## Auth and permissions (Phase 1)

Login is dj-rest-auth + simplejwt with httpOnly cookies `wr-access` / `wr-refresh`; endpoints live under `/api/auth/` (`login/`, `logout/`, `token/refresh/`, `register/`, `me/`). Unsafe requests also need Django's CSRF token in `X-CSRFToken` (done by `apps/web/src/lib/api.ts`). Default permission is `IsAuthenticatedOrReadOnly`; every view sets its own (`core/permissions.py` has `IsStaff` and `IsStaffOrReadOnly`). Customer data (orders, bookings, profiles, face scans) is always filtered by `request.user` in `selectors.py`; staff see all. Errors are `{"error": {"code", "message", "details"}}`. Full list and reasons: `docs/STATUS.md` (Decisions).

**Admin sessions are separate from shop sessions** (`apps/server/staff/`). Admin sign-in happens at `/admin/login` against `/api/admin/auth/login/` and sets its own JWT cookies (`wr-admin-access` / `wr-admin-refresh` scoped to the `/api/admin/` path, plus a JS-readable `wr-admin-session` hint cookie the `/admin` proxy redirect uses). Shop login (`/api/auth/login/`) refuses staff accounts, so the two session types do not mix. Every admin endpoint under `/api/admin/*` checks RBAC permissions from `staff/permissions.py` (keys in `staff/catalog.py`); roles (`AdminRole`) and members (`AdminMember`) are managed in the Team & Roles section. Seeded roles: Super Admin, Manager, Inventory Staff, Order Handler.

## Commands

```bash
make db-up        # start Postgres
make db-reset     # wipe and recreate the database (destroys data)
make migrate
make seed         # demo catalog
make models       # download AI model weights + test portrait into apps/server/ml_models (once)
make import-catalog SOURCE=/path/to/kaggle-folder   # Kaggle products as drafts (phase 2)
make process-images                                  # cut-outs + colours for existing photos
make demo-catalog                                    # DEMO ONLY: placeholder prices so the recommender has items
cd apps/server && venv/bin/python manage.py evaluate_skin_tone --dir DIR   # accuracy report (phase 3)
make test         # backend pytest + web vitest + tsc + eslint (needs Postgres, starts it)
make e2e          # Playwright against the real stack (starts it if needed)
make check        # test + build + e2e
npm run dev       # Next.js + Django together (root package.json)
```

## Rules

- Keep views thin. If a view has more than ~15 lines of logic, move it to a service.
- New models extend `core.models.TimeStampedModel`.
- Every new endpoint gets at least one pytest test (status code + response shape).
- Never commit `.env`, media uploads, `db.sqlite3`, model weight files over 50 MB.
- Do not change the skin tone algorithm's behavior unless the phase says so.
- Do not add deployment config (Vercel, Docker images for the app, CI deploy). The project runs locally.
- Do not invent product data, test results or accuracy numbers. Anything that will go in the thesis must come from a script output.
- When a phase is done, run its acceptance checks yourself and finish with a short report: what changed, what was checked, anything left open.

## Phase completion protocol (every phase, no exceptions)

1. **Use the real models.** Every AI model a phase uses must be downloaded locally (`make models`, extend `core/management/commands/download_models.py` for a new one) and used from `apps/server/ml_models/`. Unit tests may use stand-ins for speed, but each model also needs tests marked `@pytest.mark.models` that run the real weights (they skip only when the weights are missing). A phase is not done on stand-in results alone.
2. **Test the finished phases again.** Before reporting, run `make test`, `make build` and `make e2e` for the whole app (earlier phases included), and the `models` tests. Fix regressions before adding to them. Report the real command output.
3. **Write the phase summary** in `docs/phases/phase-N.md` using `docs/phases/TEMPLATE.md`: goal, what changed, decisions and why, real gate output, real-model checks, known limitations, how to run. Add one line to the table in `docs/phases/README.md`.
4. **Update `docs/STATUS.md`** (current phase, decisions, open issues) and the Phase map below.
5. Do not invent numbers. Accuracy, timings and counts in docs come from a script run or command output; if it was not run, say so.
6. `docs/agent/` is local and gitignored; `docs/phases/` is the tracked record of what each phase delivered.

## Phase map

The roadmap is `docs/agent/ROADMAP.md`: a complete, working shop first (Phases 1 to 5, milestone M1), then the two USPs (Phases 6 and 7). Phase 0 is already done.

| Phase | Prompt                    | Goal                                                                                          |
| ----- | ------------------------- | --------------------------------------------------------------------------------------------- |
| 0     | `docs/agent/phase-0.md`   | Postgres, layered backend skeleton, Next.js scaffold with rewrites, one-command dev (done)     |
| 1     | `docs/agent/phase-1.md`   | Next.js port, real auth with httpOnly JWT cookies, permissions                                 |
| 2     | `docs/agent/phase-2.md`   | Catalog and admin panel with full product CRUD, import, colour suggestion, filters/pagination   |
| 3     | `docs/agent/phase-3.md`   | Server cart, checkout, orders, stock and status rules                                          |
| 4     | `docs/agent/phase-4.md`   | Functional scan to recommendations to complete the look                                        |
| 5     | `docs/agent/phase-5.md`   | Functional freeze (milestone M1): full journey, states, mobile, demo data, tag `v0.1-functional` |
| 6     | written after M1          | Basic flat 2D SVG mannequin (USP) — shipped early; done with open items                          |
| 7     | written after M1          | Skin tone v2 (USP) and `evaluate_scanner` with real numbers                                    |
| 8     | written after M1          | User study scripts, demo hardening, offline models, backup recording                           |

Stop at the end of Phase 5 (M1) and wait. Do not start Phase 6 or later.

- Every phase ends with test gates. make test must be green (backend + frontend), the app must build, and make e2e must pass once it exists. Report real command output, never a summary of it. Never skip, delete or weaken a test to make it pass. New code ships with tests in the same commit.
