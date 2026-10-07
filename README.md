# Wear Right

A fashion store that styles people who don't know fashion: scan your face, get skin-tone-aware recommendations, complete the outfit, and see it on a 2D mannequin. Final Year Project, University of Lahore. Runs locally only.

| Part     | Tech                                         | Port |
| -------- | -------------------------------------------- | ---- |
| Web      | Next.js 16 (App Router, Tailwind v4)         | 3000 |
| API      | Django 5 + Django REST Framework             | 8000 |
| Database | PostgreSQL 17 + pgvector (Docker)            | 5433 |

The browser only talks to port 3000. `apps/web/next.config.ts` rewrites `/api/*` and `/media/*` to Django. Postgres is published on 5433 so it does not collide with a local Postgres on 5432.

## Prerequisites

Docker, Python 3.12, Node 20.9+ and `make`.

## Setup (four commands)

```bash
make install      # venv at apps/server/venv, pip + npm installs, creates apps/server/.env
make db-reset     # fresh Postgres in Docker (destroys data)
make migrate
make seed         # demo catalog + demo admin
```

Run everything:

```bash
npm run dev       # or: make dev
```

Open http://localhost:3000. Create an account at `/register`, or use the demo admin created by `make seed`: `admin@wearright.local` / `admin12345` (the username `admin` also works). Only admins see the Admin page.

The browser never talks to Django directly: sign-in is two httpOnly cookies set by `/api/auth/login/` through the Next.js rewrite.

## Tests

```bash
make test         # backend pytest + web vitest + tsc --noEmit + eslint
make e2e          # Playwright against the real stack (starts Postgres, migrates, seeds, starts both servers if needed)
make check        # test + build + e2e
```

First-time e2e setup: `cd apps/web && npx playwright install chromium`.

## Layout

```
apps/server   Django project (core, accounts, catalog, scanner, recommender, orders)
apps/web      Next.js storefront (src/app routes, src/components, src/features, src/lib)
docs/STATUS.md  current phase, decisions, deviations, open issues
```

See `CLAUDE.md` for the architecture rules.
