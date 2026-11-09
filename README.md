# Wear Right

A fashion store that styles people who don't know fashion: scan your face, get skin-tone-aware recommendations, complete the outfit, and see it on a 2D mannequin. Final Year Project, University of Lahore. Runs locally only.

| Part     | Tech                                         | Port |
| -------- | -------------------------------------------- | ---- |
| Web      | Next.js 16 (App Router, Tailwind v4)         | 3000 |
| API      | Django 5 + Django REST Framework             | 8000 |
| Database | PostgreSQL 17 + pgvector (Docker)            | 5433 |

The browser only talks to port 3000. `apps/web/next.config.ts` rewrites `/api/*` and `/media/*` to Django. Postgres is published on 5433 so it does not collide with a local Postgres on 5432.

## Prerequisites

Docker (Docker Desktop on Windows/macOS), Python 3.12, Node 20.9+, and npm. The Node task runner means Windows does **not** need WSL or Make. Linux/macOS can use the Makefile shortcuts.

## Setup (four commands)

The same commands work in PowerShell and in a Linux/macOS shell. On Windows use `.\` before the script; on Linux/macOS use `./`.

```powershell
node .\scripts\wearright.mjs install   # venv, .env with a random SECRET_KEY, pip + npm installs
node .\scripts\wearright.mjs seed      # Postgres + migrations + products, admin, demo users, mannequin (if the kit is present)
node .\scripts\wearright.mjs build     # production Next.js build
node .\scripts\wearright.mjs demo      # start Docker, migrate/seed, build, run Django + next start
```

Linux/macOS equivalents: `node ./scripts/wearright.mjs ...`, or the older `make install`, `make demo-data`, `make build`, `make demo`. Windows details and every command explained: [`docs/WINDOWS.md`](docs/WINDOWS.md).

Optional, real catalog: `make import-catalog SOURCE=/path/to/kaggle-folder` imports products from the Kaggle "Fashion Product Images" dataset as drafts (hidden from shoppers until priced). Details and open items are in `docs/STATUS.md`.

Run everything:

```powershell
node .\scripts\wearright.mjs dev   # Windows PowerShell
```

```bash
npm run dev                       # or: make dev, or: node ./scripts/wearright.mjs dev
```

Open http://localhost:3000. Create an account at `/register`, or use the logins created by `seed`: customer `demo@wearright.local` / `demo12345`, admin `admin@wearright.com` / `admin123` (the legacy `admin@wearright.local` / `admin12345` still works). Only admins see the Admin page.

The functional M1 journey is: Shop → product → cart → register/login (guest cart merges) → `/scan` or the manual tone picker → `/recommended` → complete the look → `/checkout` (COD or demo card) → `/my-orders` → `/orders/<id>`. Staff manage products and order status at `/admin`.

For a presentation use `node scripts/wearright.mjs demo` for a production build, or `make demo-reset && make demo` for a clean database first. The walkthrough is in `docs/DEMO.md`.

The browser never talks to Django directly: sign-in is two httpOnly cookies set by `/api/auth/login/` through the Next.js rewrite.

## Tests

```bash
make test         # backend pytest + web vitest + tsc --noEmit + eslint
make e2e          # Playwright against the real stack (starts Postgres, migrates, seeds, starts both servers if needed)
make check        # test + build + e2e
```

First-time e2e setup: `cd apps/web && npx playwright install chromium`. If your own dev servers are running on 3000 and 8000, run the suite on other ports: `E2E_WEB_PORT=3100 E2E_API_PORT=8100 make e2e`.

## Layout

```
apps/server   Django project (core, accounts, catalog, scanner, recommender, orders)
apps/web      Next.js storefront (src/app routes, src/components, src/features, src/lib)
docs/STATUS.md  current phase, decisions, deviations, open issues
```

Detailed install, database, `.env`, development and production-style run instructions: [`docs/SETUP.md`](docs/SETUP.md).

See `CLAUDE.md` for the architecture rules.
