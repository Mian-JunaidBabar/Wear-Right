# Wear Right: quick start

Short, step-by-step version of the setup. Full details and troubleshooting: [SETUP.md](SETUP.md). Windows-specific notes: [WINDOWS.md](WINDOWS.md).
Run every command from the project folder.

## Commands for every operating system

The same Node commands work in **PowerShell on Windows** and in a **Linux/macOS terminal**. On Windows use `.\` before the script path; on Linux/macOS use `./`.

| Job | Windows PowerShell | Linux / macOS |
| --- | --- | --- |
| Install everything | `node .\scripts\wearright.mjs install` | `node ./scripts/wearright.mjs install` |
| Seed all demo data | `node .\scripts\wearright.mjs seed` | `node ./scripts/wearright.mjs seed` |
| Create the production build | `node .\scripts\wearright.mjs build` | `node ./scripts/wearright.mjs build` |
| Run the production demo | `node .\scripts\wearright.mjs demo` | `node ./scripts/wearright.mjs demo` |
| Run development mode | `node .\scripts\wearright.mjs dev` | `node ./scripts/wearright.mjs dev` |

Linux/macOS users can still use `make install`, `make demo-data`, `make build` and `make demo` if they prefer.

## First setup on a new machine

### Windows

1. Install **Git**, **Python 3.12** (tick *Add python.exe to PATH*), **Node.js 20.9+**, and **Docker Desktop**. Start Docker Desktop and wait for **Running**.
2. Open PowerShell in the project folder.
3. `node .\scripts\wearright.mjs install`
4. `node .\scripts\wearright.mjs seed`
5. `node .\scripts\wearright.mjs build`
6. `node .\scripts\wearright.mjs demo`, then open <http://localhost:3000>.

No WSL terminal or Make is needed. Keep the project in a short path such as `C:\dev\Wear-Right`, not inside OneDrive.

### Linux / macOS

1. Install Git, Docker with Compose, Python 3.12 and Node 20.9+.
   Ubuntu: `sudo apt install -y git python3.12 python3.12-venv docker.io docker-compose-v2`, then install Node from nodejs.org or nvm.
   Allow Docker without sudo: `sudo usermod -aG docker "$USER"`, then log out and back in.
2. `node ./scripts/wearright.mjs install`
3. `node ./scripts/wearright.mjs seed`
4. `node ./scripts/wearright.mjs build`
5. `node ./scripts/wearright.mjs demo`, then open <http://localhost:3000>.

## Every day: start the project

Windows:

```powershell
node .\scripts\wearright.mjs dev
```

Linux/macOS:

```bash
make dev
# or: node ./scripts/wearright.mjs dev
```

This starts Docker, applies migrations, and starts the website plus the backend. Open <http://localhost:3000>.
Press **Ctrl+C** to stop the servers. To stop the database containers too:

```powershell
node .\scripts\wearright.mjs db-down
```

## Logins for the demo

| Who | Where | Email | Password |
| --- | --- | --- | --- |
| Customer | `/login` | demo@wearright.local | demo12345 |
| Admin (Super Admin) | `/admin/login` | admin@wearright.com | admin123 |

Admin and customer accounts are separate: an admin account cannot sign in on the shop, and a customer cannot open
the admin panel. Emails (password reset, order placed) appear in the local inbox at <http://localhost:8025>.

## For the evaluation: faster demo build

Windows:

```powershell
node .\scripts\wearright.mjs demo
```

Linux/macOS:

```bash
make demo
```

This builds the website once and starts it without the development badge. Before the evaluation day, back up the product photos (Linux/macOS: `make media-backup`).

## Seed data and the mannequin

`seed` creates the products, categories, colours, recommender tone rules, demo customer, and both admin logins. It is safe to run again.

If the mannequin kit is at `extras\mannequin-alpha-kit` (Windows) or `extras/mannequin-alpha-kit` (Linux), the mannequin bases, layers and looks are imported too. If the folder is elsewhere:

```powershell
node .\scripts\wearright.mjs seed --mannequin-kit "D:\assets\mannequin-alpha-kit"
```

Only rows marked `done` in the kit's `manifest.csv` are imported. The kit references existing catalogue products, so a **fresh** database needs the Kaggle catalogue import (or a database backup) before the mannequin rows can attach to products. The first mannequin import downloads the required AI models automatically (large, once). Without the kit, `seed` prints a warning and continues with everything else.

## If something goes wrong

| Problem | Fix |
| --- | --- |
| Database will not start, port 5433 in use | Another database is using the port. Stop it, or change the port as described in SETUP.md. |
| Product photos missing, placeholder images shown | Check `MEDIA_ROOT` in `apps/server/.env`, then re-run `seed` or restore a media backup. |
| Login says "team account" | That is an admin account. Use `/admin/login`. |
| Need a clean database for a walkthrough | `db-reset` (deletes orders and accounts made during testing), then `seed`. |
| `python` not found on Windows | Install Python 3.12 and tick *Add python.exe to PATH*; verify `py -3.12 --version`. |
| Docker not running | Start Docker Desktop and wait for **Running**; verify `docker compose version`. |
