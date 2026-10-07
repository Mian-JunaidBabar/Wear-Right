# Wear Right — agent guide

Wear Right is a Final Year Project (University of Lahore): a fashion store that styles people who don't know fashion. The user scans their face, the system detects skin tone (depth + undertone), recommends 10 to 15 items, completes the outfit (shirt -> pants + shoes + accessory; suit -> shoes + watch + tie; kameez -> footwear + waistcoat), and shows the look on a 2D layered mannequin.

The full PRD and phase playbook live in the team's Claude Doc "Wear Right — PRD & Build Plan". Phase prompts live in `docs/agent/phase-N.md`. Do only the phase you were given.

## Stack (local only, no deployment)

| Layer    | Tech                                                                                   | Port |
| -------- | -------------------------------------------------------------------------------------- | ---- |
| Frontend | Next.js 16 (App Router, TypeScript, Tailwind v4) in `apps/web`                         | 3000 |
| Backend  | Django 5 + Django REST Framework in `apps/server`                                      | 8000 |
| Database | PostgreSQL 17 + pgvector, in Docker (`docker-compose.yml`)                             | 5432 |
| ORM      | Django ORM only. No SQLAlchemy, no Prisma/Drizzle. Next.js never touches the database. |      |
| AI       | OpenCV, MediaPipe, rembg, FashionCLIP (later phases), all run inside Django            |      |

Python 3.12 (venv at `apps/server/venv`). Node 20.9+.
The legacy Vite client in `apps/client` stays untouched until Phase 1 deletes it.

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
| `recommender` | ToneColorRule, ranker, look generation                                                     |
| `orders`      | Cart, Order, OrderItem, Booking                                                            |

Frontend (`apps/web`), same idea:

```
app/<route>/page.tsx     View: route entry, composes components
components/              Presentational UI, no fetch calls
features/<domain>/       Controller: hooks + state for one domain (useCart, useScan), calls lib/api
lib/api.ts               Data access: the only place that calls fetch
```

The browser only talks to port 3000. `next.config.ts` rewrites `/api/*` and `/media/*` to Django on 8000. Always call Django URLs with a trailing slash.

## Commands

```bash
make db-up        # start Postgres
make db-reset     # wipe and recreate the database (destroys data)
make migrate
make seed         # demo catalog
make test         # pytest for the server
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

## Phase map

| Phase | Prompt                  | Goal                                                                                   |
| ----- | ----------------------- | -------------------------------------------------------------------------------------- |
| 0     | `docs/agent/phase-0.md` | Postgres, layered backend skeleton, Next.js scaffold with rewrites, one-command dev    |
| 1     | `docs/agent/phase-1.md` | Port UI to Next.js, real auth with httpOnly JWT cookies, permissions                   |
| 2     | `docs/agent/phase-2.md` | Catalog schema, Kaggle import, rembg cutouts, color extraction                         |
| 3     | `docs/agent/phase-3.md` | Skin tone v2: MediaPipe regions, white-balance fix, undertone, Monk, evaluation script |
| 4     | `docs/agent/phase-4.md` | Tone-color rules, ranker, complete-the-look                                            |
| 5     | `docs/agent/phase-5.md` | Layered mannequin                                                                      |
| 6     | `docs/agent/phase-6.md` | Cart + multi-item orders, FashionCLIP auto-tagging                                     |
| 7     | `docs/agent/phase-7.md` | Evaluation scripts, demo hardening                                                     |

- Every phase ends with test gates. make test must be green (backend + frontend), the app must build, and make e2e must pass once it exists. Report real command output, never a summary of it. Never skip, delete or weaken a test to make it pass. New code ships with tests in the same commit.
