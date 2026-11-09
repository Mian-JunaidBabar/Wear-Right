# Windows and Linux guide

Wear Right now uses the same setup commands on Windows, Linux and macOS. You do **not** need WSL, Make, bash, `sed` or `tar` on Windows — only Node (which the website already needs) runs the setup tasks.

The one-page commands are in [Quick start](QUICKSTART.md). This page explains what each command does and the Windows-specific details.

## What runs where

| Piece | Runs as | Address |
| --- | --- | --- |
| Next.js website | Local Node process (production build for `demo`) | <http://localhost:3000> |
| Django API | Local Python process | <http://127.0.0.1:8000> (normally reached through port 3000) |
| PostgreSQL 17 + pgvector | Docker container `wearright-db` | `localhost:5433` |
| Mailpit (catches local email) | Docker container `wearright-mailpit` | <http://localhost:8025> |

Docker is used for the database and the mail inbox. Django and Next.js stay on the host so the camera, AI model files and `.env` work without extra container setup. `demo` runs a real `next build` and `next start`, not the development server.

## Windows prerequisites

Install these once, then **open a new PowerShell window** so PATH changes are picked up:

1. **Git** — <https://git-scm.com/download/win>
2. **Python 3.12** — <https://www.python.org/downloads/windows/>
   - Tick **Add python.exe to PATH** in the installer.
   - Verify: `py -3.12 --version` (or `python --version`).
   - The project is tested on 3.12. Newer versions usually work, but some AI packages may not have wheels yet.
3. **Node.js 20.9 or newer (LTS)** — <https://nodejs.org/>
   - Verify: `node --version` and `npm --version`.
4. **Docker Desktop** — <https://www.docker.com/products/docker-desktop/>
   - Use the WSL2 backend when the installer asks. Start Docker Desktop and wait until it says **Running**.
   - Verify: `docker --version` and `docker compose version`.

No WSL terminal is needed. Docker Desktop uses WSL2 internally, but all project commands run in normal PowerShell.

> Keep the project in a short path such as `C:\dev\Wear-Right`, not deep inside OneDrive. Long paths and OneDrive sync can slow down `node_modules` and break file watching.

## Get the project

```powershell
cd C:\dev
git clone <repository-url> Wear-Right
cd Wear-Right
```

## The four main commands

These are identical on Windows and Linux; only the path separator in the script name is different.

| Job | Windows PowerShell | Linux / macOS |
| --- | --- | --- |
| Install everything | `node .\scripts\wearright.mjs install` | `node ./scripts/wearright.mjs install` |
| Seed all demo data | `node .\scripts\wearright.mjs seed` | `node ./scripts/wearright.mjs seed` |
| Create the production build | `node .\scripts\wearright.mjs build` | `node ./scripts/wearright.mjs build` |
| Run the production demo | `node .\scripts\wearright.mjs demo` | `node ./scripts/wearright.mjs demo` |

On Linux/macOS the older Make shortcuts still work: `make install`, `make demo-data`, `make build`, `make demo`. The Makefile also detects the Windows venv layout if you use Git Bash.

## What each command does

### `install`

```powershell
node .\scripts\wearright.mjs install
```

1. Checks that Node is 20.9 or newer.
2. Finds Python 3.12 (`py -3.12`, `py -3`, `python` or `python3`).
3. Creates the Python environment:
   - Windows: `apps\server\venv\Scripts\python.exe`
   - Linux/macOS: `apps/server/venv/bin/python`
4. Creates `apps/server/.env` from `.env.example` and puts a random `SECRET_KEY` in it. An existing `.env` is left alone.
5. Installs the Python packages from `apps/server/requirements.txt`.
6. Installs the root and `apps/web` npm packages.

Run this again safely if you pull new dependencies; it reuses the venv and does not overwrite your `.env`.

Optional end-to-end test browser (not needed for the demo):

```powershell
cd apps\web
npx playwright install chromium
cd ..\..
```

### `seed`

```powershell
node .\scripts\wearright.mjs seed
```

1. Starts the Docker services (`docker compose up -d --wait`): Postgres and Mailpit.
2. Applies all Django migrations.
3. Runs `seed_products`, which is idempotent and creates:
   - the 11 demo products and their photos/stock/prices;
   - categories, styles, colours and recommender tone rules;
   - the demo customer and both admin logins.
4. If a mannequin kit is present, imports the mannequin bases, layers and looks, then publishes those products for the demo.
5. Prints the demo logins.

The command is safe to run repeatedly. It does not overwrite passwords or prices you changed.

#### Mannequin data

The mannequin kit contains large image files, so it is **not committed to git**. Put the provided folder here:

```text
Wear-Right\
  extras\
    mannequin-alpha-kit\
      manifest.csv
      base\men.png
      base\women.png
      renders\...
```

`seed` finds `extras\mannequin-alpha-kit` automatically. If the kit is somewhere else:

```powershell
node .\scripts\wearright.mjs seed --mannequin-kit "D:\assets\mannequin-alpha-kit"
```

It imports both genders when `base\men.png` / `base\women.png` exist. Only rows marked `done` in `manifest.csv` are imported; unfinished renders are intentionally skipped. The first run downloads the rembg models (a few hundred MB) if they are missing.

The kit is **not** a product catalogue: each row references an existing product by `external_id` or exact name. On an existing database those products are already there. On a **fresh** database, import the Kaggle catalogue first (or restore a database backup), otherwise the mannequin rows are skipped with “no product with external_id …”. `seed` prints that reason and still finishes.

If the `publish_mannequin_demo` command exists in the branch, `seed` runs it after the import so the imported mannequin products become Active, priced and in stock for the demo.

If you do not have the kit yet, `seed` prints a warning and finishes with everything except the mannequin. That is expected; the rest of the shop works.

To seed without the mannequin even when the kit exists:

```powershell
node .\scripts\wearright.mjs seed --skip-mannequin
```

#### Demo logins

| Who | Where | Login | Password |
| --- | --- | --- | --- |
| Customer | `/login` | `demo@wearright.local` | `demo12345` |
| Admin | `/admin/login` | `admin@wearright.com` | `admin123` |
| Legacy admin | `/admin/login` | `admin` or `admin@wearright.local` | `admin12345` |

Admin and customer accounts are separate: an admin cannot sign in on the shop, and a customer cannot open `/admin`.

### `build`

```powershell
node .\scripts\wearright.mjs build
```

Runs `next build` and writes the production website to `apps\web\.next`. This is the expensive step (usually tens of seconds). It does not change the database and does not start any server.

### `demo`

```powershell
node .\scripts\wearright.mjs demo
```

1. Starts all Docker services (Postgres + Mailpit).
2. Applies migrations.
3. Seeds the base demo data (products, users, recommender rules). This is quick and idempotent.
4. Creates the production Next.js build.
5. Starts Django with `--noreload` and Next with `next start`.

Open <http://localhost:3000>. Press **Ctrl+C** in that window to stop Django and Next. Then stop the containers if you want:

```powershell
node .\scripts\wearright.mjs db-down
```

Useful variants:

```powershell
# Reuse the existing build (skip the slow build step)
node .\scripts\wearright.mjs demo --skip-build

# Start with an existing database and do not seed again
node .\scripts\wearright.mjs demo --no-seed
```

## Development mode

For normal coding with hot reload:

```powershell
node .\scripts\wearright.mjs dev
```

This starts Docker, applies migrations, and runs `next dev` plus Django. The website is still <http://localhost:3000>. The browser reaches Django through Next's `/api` and `/media` rewrites, so keep using port 3000.

## Database commands

| Command | Effect |
| --- | --- |
| `node .\scripts\wearright.mjs db-up` | Start Postgres and Mailpit, keep data |
| `node .\scripts\wearright.mjs db-down` | Stop the containers, keep the Docker volume |
| `node .\scripts\wearright.mjs db-reset` | **Delete** the database volume, then start empty |
| `node .\scripts\wearright.mjs seed` | Migrate and reload demo data |

After `db-reset`, run `seed` to get the catalogue and logins back.

## Checks and help

```powershell
node .\scripts\wearright.mjs test     # backend pytest, web vitest, typecheck, lint
node .\scripts\wearright.mjs doctor   # shows Node, Python, Docker, .env and dependency status
node .\scripts\wearright.mjs --help   # full command list
```

`test` needs the Docker database to be running; it is started by the test targets.

## Linux prerequisites and commands

Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y git python3.12 python3.12-venv docker.io docker-compose-v2
# Node 20.9+ from nvm or NodeSource
sudo usermod -aG docker "$USER"   # then log out and back in
```

Then:

```bash
git clone <repository-url> Wear-Right
cd Wear-Right
node ./scripts/wearright.mjs install
node ./scripts/wearright.mjs seed
node ./scripts/wearright.mjs build
node ./scripts/wearright.mjs demo
```

The same commands work on macOS with Docker Desktop, Homebrew Python 3.12 and Node installed.

## Common Windows problems

**`python` opens the Microsoft Store / `Python was not found`.**
Install Python 3.12 from python.org and tick **Add python.exe to PATH**, or use the `py` launcher. Verify `py -3.12 --version`, then reopen PowerShell.

**`node` or `npm` is not recognized.**
Install Node LTS, reopen PowerShell, and check `node --version`. Do not install Node inside the project folder.

**`docker` is not recognized / cannot connect.**
Start Docker Desktop and wait for **Running**. Check `docker --version` and `docker compose version`. WSL2 must be enabled for Docker Desktop's default backend.

**Port 5433 is already in use.**
Another Postgres or container owns it. Stop it, or change both the compose port and `DATABASE_URL` in `apps/server/.env` as described in [SETUP.md](SETUP.md#4-set-up-the-database). Then run `db-up` again.

**`next build` complains about a `node_modules` symlink.**
Use real installs. Run `node .\scripts\wearright.mjs install`; do not symlink `node_modules` from another checkout.

**The camera does not open.**
Browsers require a secure context. `http://localhost:3000` is allowed; a plain-HTTP LAN address is not. Check Windows camera permissions, and use the upload or manual skin-tone fallback.

**Product photos are missing.**
`seed` copies the demo photos from `apps/server/seed_media/products` into `apps/server/media/products`. If you use a custom `MEDIA_ROOT` in `apps/server/.env`, copy the photos there or restore a media backup.

**The mannequin did not import.**
Check that `extras\mannequin-alpha-kit\manifest.csv`, `base\men.png` and the `done` renders exist. Pass `--mannequin-kit` if the folder is elsewhere. The first import also needs the rembg models; `seed` downloads them automatically.

**PowerShell says scripts are disabled.**
These commands call `node`, not a `.ps1` file, so execution policy does not apply. If you write your own `.ps1` wrapper, run PowerShell with `-ExecutionPolicy Bypass` for that session.

## What "production demo" means here

`demo` is a production-style **local** demo: a real Next.js production build, Django with `--noreload`, and Dockerised Postgres/Mailpit. It is not a public deployment. For a real server you still need HTTPS, a WSGI/ASGI server, static/media hosting, secure cookies and a real email provider — see [SETUP.md](SETUP.md#7-production-style-local-demo).
