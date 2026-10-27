# Setup guide

Wear Right is a local-first project: Next.js on port 3000, Django on port 8000, PostgreSQL + pgvector on port 5433. This guide covers a fresh install, development, a production-style local demo, the database and `.env`, and the problems people actually hit.

The browser only talks to **port 3000**. Next.js proxies `/api/*` and `/media/*` to Django, so do not open the API on 8000 for normal use.

## 1. Prerequisites

| Requirement | Version / notes |
| --- | --- |
| Git | Any recent version |
| Docker Engine + Compose v2 | `docker compose version` must work. On Linux, the user must be able to run Docker without `sudo` (or prefix commands with it). |
| Python | **3.12** — the Makefile creates the venv with `python3.12`. |
| Node.js | **20.9 or newer** (Next.js 16). |
| npm | Ships with Node. |
| GNU Make | `make --version`. Linux/macOS normally have it; on Windows use WSL2. |
| Playwright browsers | Only for end-to-end tests: `cd apps/web && npx playwright install chromium`. |

The AI models are optional for browsing, but required for real face scanning and image cut-out work. They are downloaded separately because they are large (`make models`).

### Ubuntu / Debian packages

```bash
sudo apt update
sudo apt install -y git make python3.12 python3.12-venv docker.io docker-compose-v2
# install Node 20.9+ with nvm, or from NodeSource
node --version
npm --version
```

Add your user to the Docker group if necessary, then log out and back in:

```bash
sudo usermod -aG docker "$USER"
```

### macOS

```bash
brew install python@3.12 node make
# Install Docker Desktop and start it before continuing.
```

### Windows

Use WSL2 with a Linux distribution and follow the Ubuntu steps. Run the project from the Linux filesystem (for example `~/projects/Wear-Right`), not `/mnt/c`, for acceptable file-watching and install speed. Docker Desktop must have WSL integration enabled.

## 2. Clone and install

```bash
git clone <repository-url> Wear-Right
cd Wear-Right
make install
```

`make install` does three things:

1. Creates the Python venv at `apps/server/venv` using `python3.12`.
2. Creates `apps/server/.env` from `.env.example` with a random `SECRET_KEY` the first time.
3. Installs Python and npm dependencies (root + `apps/web`).

If step 2 says the file already exists, it leaves it alone. That is safe.

If `make` is unavailable on Windows/WSL, run the equivalent commands manually:

```bash
python3.12 -m venv apps/server/venv
cp apps/server/.env.example apps/server/.env
# edit SECRET_KEY in apps/server/.env
apps/server/venv/bin/pip install -r apps/server/requirements.txt
npm install
npm --prefix apps/web install
```

Do not commit `.env`, `media/`, `ml_models/`, or `venv/`; they are gitignored.

## 3. Configure `apps/server/.env`

Minimum working file:

```dotenv
SECRET_KEY=<long random string>
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=postgres://wearright:wearright@localhost:5433/wearright
```

`make env` generates `SECRET_KEY` for you. You can also generate one manually:

```bash
python3 -c 'import secrets; print(secrets.token_urlsafe(50))'
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `SECRET_KEY` | Yes | Signs sessions/JWTs. `DEBUG=False` refuses to start without it. |
| `DEBUG` | Yes | `True` locally. Set `False` for a production-style run. |
| `ALLOWED_HOSTS` | Yes | Comma-separated Django hosts. `localhost,127.0.0.1` locally; `*` only for throwaway demos. |
| `DATABASE_URL` | Yes | Must match `docker-compose.yml`. Default uses port **5433**. |
| `DEMO_ADMIN_PASSWORD` | No | Password for the legacy seeded `admin` user. Falls back to `admin12345` when `DEBUG=True`. Only applied when that user is first created. The primary demo admin (`admin@wearright.com` / `admin123`) is created only when `DEBUG=True` and is not controlled by this variable. |
| `DEMO_USER_PASSWORD` | No | Password for the seeded customer. Falls back to `demo12345` when `DEBUG=True`. |
| `CSRF_TRUSTED_ORIGINS` | No | Defaults to `http://localhost:3000,http://127.0.0.1:3000`. Change this if the web app runs on another origin. |
| `ML_MODELS_DIR` | No | Defaults to `apps/server/ml_models`. |
| `BACKEND_URL` | No (web) | Target for Next's proxy. Defaults to `http://127.0.0.1:8000`. |

`BACKEND_URL` belongs to the web process environment, not `apps/server/.env` (the Next config reads it directly). Start with `BACKEND_URL=http://127.0.0.1:8100 npm --prefix apps/web run dev` if Django runs elsewhere.

The JWT cookies are `HttpOnly` and CSRF-protected. For a real HTTPS deployment, `JWT_AUTH_SECURE` in `apps/server/core/settings.py` must become `True`; it is hard-coded `False` for plain-http local use.

## 4. Set up the database

Start PostgreSQL:

```bash
make db-up
```

This starts the pinned `pgvector/pgvector:pg17` image as container `wearright-db`, exposes **5433**, waits for health, and keeps data in the `wearright_pg` Docker volume.

Then create the schema and seed data:

```bash
make migrate
make seed
```

Or do both, plus the database startup, in one command:

```bash
make demo-data
```

`make seed` is idempotent: it creates the demo catalogue, categories, colour rules, admin, and demo customer if they do not already exist. It does not overwrite existing passwords or prices; it may fill missing recommender tags on existing products.

Verify:

```bash
docker ps --filter name=wearright-db
apps/server/venv/bin/python apps/server/manage.py showmigrations --plan | tail
```

Useful database commands:

```bash
make db-down       # stop the container, keep data
make db-up         # start it again
make db-reset      # DESTROYS the volume, then starts an empty database
make migrate       # apply migrations
make seed          # seed catalogue, taxonomy, rules, demo logins
```

After `make db-reset`, always run `make migrate` and `make seed` (or `make demo-data`).

Open a SQL shell:

```bash
docker exec -it wearright-db psql -U wearright -d wearright
```

### If port 5433 is already used

Two services cannot publish the same host port. Find the conflict:

```bash
sudo lsof -i :5433
# or
docker ps --format '{{.Names}} {{.Ports}}'
```

Either stop the other service, or change **both** the compose mapping and the URL:

```yaml
# docker-compose.yml
ports:
  - "5434:5432"
```

```dotenv
# apps/server/.env
DATABASE_URL=postgres://wearright:wearright@localhost:5434/wearright
```

Then `make db-up`.

The project uses 5433 because a local PostgreSQL installation commonly occupies 5432.

## 5. Optional: AI models and real catalogue images

For the real face scanner and mannequin cut-outs:

```bash
make models            # downloads MediaPipe/rembg weights into apps/server/ml_models
make test-models       # verifies the downloaded models; 10 tests
```

Without the weights, browsing, manual tone selection, recommendations, cart and checkout still work. A real camera scan may answer 503/model-missing; the UI offers the manual tone picker.

Optional Kaggle catalogue import (large, external download):

```bash
make import-catalog SOURCE=/path/to/kaggle-folder LIMIT=150
make demo-catalog       # DEMO ONLY: activates drafts with placeholder prices
make process-images     # cut-outs + dominant colours for imported photos
make mannequin-assets   # prepares garments for the mannequin
```

Prices created by `make demo-catalog` are placeholders, not real prices.

## 6. Run the development environment

```bash
make dev
```

or, equivalently:

```bash
npm run dev
```

This starts both processes:

- Next.js: <http://localhost:3000>
- Django: <http://127.0.0.1:8000> (API; normally reached through the Next proxy)

Open **http://localhost:3000**. Do not browse the frontend through port 8000.

Useful logins after seeding (with `DEBUG=True`):

| Role | Login | Password |
| --- | --- | --- |
| Customer | `demo@wearright.local` | `demo12345` |
| Staff/admin (primary demo) | `admin@wearright.com` | `admin123` |
| Staff/admin (legacy alias) | `admin@wearright.local` or `admin` | `admin12345` |

Create additional accounts at `/register`. Staff-only screens live at `/admin`.

### Admin panel data

`make demo-data` (or `make migrate && make seed`) creates the data the admin screens need:

| Area | Seeded / available after setup |
| --- | --- |
| Products | 11 demo products with images, prices, stock and sizes. They are real rows in the database, so edits are persistent. |
| Categories and styles | The taxonomy rows used by the shop and the product form. Category and style CRUD is real. |
| Colours | Colour rows used by the product form and filters. |
| Tone rules | The recommender's colour rules and palettes. |
| Users | The demo staff accounts above plus the demo customer. |
| Orders | **Empty initially.** They appear when a customer checks out (or you create one through the API). |
| Bookings | **Empty initially.** The booking APIs exist, but the storefront does not create bookings yet. |
| Face scans | **Empty initially.** A signed-in scan or manual tone choice adds a record. |

What the real admin screens can do:

- **Dashboard:** totals for products, orders, bookings, scans, revenue/profit, low stock and status charts.
- **Products:** search, create/edit with image upload and live preview, request a dominant-colour suggestion, change price/stock/sizes, hide/show with the eye toggle, and delete with confirmation.
- **Orders:** list/search orders, open details, and move an order through the allowed statuses (Pending → Confirmed → Shipped → Delivered, or cancel while Pending/Confirmed).
- **Bookings and face scans:** read the records created by the app.
- **Categories and styles:** create, rename and remove taxonomy values.

The **Skin Tone Matrix**, **Outfit Rules**, **Team Members** and **Settings** tabs still show legacy static demo content. They are not backed by editable data yet. Django's own admin is also available at <http://127.0.0.1:8000/admin/> for staff users, but the Next.js `/admin` screen is the supported interface.

### Run the servers separately

```bash
# terminal 1 — API
apps/server/venv/bin/python apps/server/manage.py runserver 8000

# terminal 2 — web
npm --prefix apps/web run dev
```

If Django is on another port, point the proxy at it:

```bash
BACKEND_URL=http://127.0.0.1:8100 npm --prefix apps/web run dev
```

The web app must keep its own origin in `CSRF_TRUSTED_ORIGINS`. The default trusts port 3000 only. For a web app on 3100:

```bash
CSRF_TRUSTED_ORIGINS=http://localhost:3100,http://127.0.0.1:3100 \
  apps/server/venv/bin/python apps/server/manage.py runserver 8000
```

## 7. Production-style local demo

There is **no deployment configuration** in this repository (no real web server, container for the app, static/media hosting, HTTPS, or secret manager). The supported “production” path is a production Next.js build served locally:

```bash
make demo-data     # database + seed, if not already done
make demo          # next build, then next start + Django
```

`make demo` runs `npm run build`, starts `next start` on 3000 and Django with `--noreload`. It is faster than dev mode and has no Next development badge. Open <http://localhost:3000>.

To do the same by hand:

```bash
make build
npm --prefix apps/web run start
# in another terminal:
apps/server/venv/bin/python apps/server/manage.py runserver 8000 --noreload
```

Stop with `Ctrl+C`.

### What a real production deployment would additionally require

Treat these as required engineering work, not configuration tweaks:

- Run Django under a real WSGI/ASGI server (for example Gunicorn/Uvicorn) behind HTTPS.
- Serve Next and Django behind one HTTPS reverse proxy; keep `/api/*` and `/media/*` pointed at Django.
- `DEBUG=False`, a strong `SECRET_KEY`, explicit `ALLOWED_HOSTS`, and the real `DATABASE_URL`.
- Set `JWT_AUTH_SECURE=True` (currently hard-coded false) and keep `SameSite`/CSRF origins consistent with the public origin.
- Host `STATIC_ROOT` and `MEDIA_ROOT` (or object storage) and collect static files.
- Restrict admin access, add rate limiting/email verification/password reset, and use a managed PostgreSQL with backups.
- Do not expose the demo accounts or `DEMO_*_PASSWORD` values.

Until those are done, do not put this on a public server.

## 8. Tests and checks

```bash
make test          # backend pytest + web vitest + tsc + eslint
make build         # production Next build
make e2e           # Playwright against the real stack
make test-models   # only real-model tests (requires make models)
make check         # test + build + e2e
```

First-time E2E only:

```bash
cd apps/web && npx playwright install chromium
```

If your dev servers are already running, `make e2e` reuses them. To avoid a collision with another checkout, use separate ports:

```bash
E2E_WEB_PORT=3100 E2E_API_PORT=8100 make e2e
```

The E2E database is the same database as development. It creates test users and orders, so do not point it at data you care about.

## 9. Common problems

**`make db-up` fails: port 5433 is allocated.** Another Postgres/container is using it. See the port section above. A previous project container may still be running.

**Django says `SECRET_KEY environment variable is required`.** `.env` is missing or `DEBUG=False` without a key. Run `make env` and check `apps/server/.env`.

**Login works but writes fail with 403/CSRF.** The web app is being opened on an origin not listed in `CSRF_TRUSTED_ORIGINS`, or you are calling Django directly on 8000. Use port 3000 and update the trusted origins for custom ports.

**Shop is empty.** Run `make demo-data`. If you imported Kaggle items, they are drafts hidden from shoppers until activated (`make demo-catalog` for a placeholder demo, or `/admin` to price and activate them).

**`admin` login does not exist.** Seeding creates demo users only when `DEBUG=True` or the `DEMO_*_PASSWORD` variables are set. Existing users are not given a new password by re-running seed.

**Scanning says models are missing / 503.** Run `make models` (large download), then restart Django. Use “Skip, pick my tone” if you only need the styling journey.

**Camera does not open.** Browsers require a secure context; `http://localhost` is allowed, a plain-HTTP LAN address is not. Also check the browser's camera permission. Upload or manual tone are the fallbacks.

**`next build`/`next dev` fails with a symlink error for `node_modules`.** Turbopack rejects `node_modules` symlinked outside the project. Use real installs (`npm install` / `npm --prefix apps/web install`) rather than symlinking a `node_modules` from another checkout. The documented build command is `npm run build`.

**Next.js prints a security advisory.** Next.js 16.4.0 is affected by a published advisory. The build/dev command continues after the reminder, but the dependency should be upgraded deliberately and re-tested.

**A migration was applied by another checkout.** The PostgreSQL database is shared per Docker volume. Merge/pull the branch before running this checkout; otherwise old code may not understand newer tables.

**Port 3000 is busy.** Stop the old dev server or use `npm --prefix apps/web run dev -- --port 3100`, with matching `CSRF_TRUSTED_ORIGINS`.

## 10. First-run checklist

```text
[ ] Docker is running
[ ] make install completed without errors
[ ] apps/server/.env has SECRET_KEY, DEBUG=True, DATABASE_URL
[ ] make db-up is healthy
[ ] make migrate and make seed (or make demo-data) completed
[ ] http://localhost:3000 loads the storefront
[ ] customer and staff logins work
[ ] make test passes
[ ] optional: make models + make test-models
```

For the demo script, see [`docs/DEMO.md`](DEMO.md). For current limitations and decisions, see [`docs/STATUS.md`](STATUS.md).
