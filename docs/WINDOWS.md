# Wear Right - Windows setup guide

This guide is for a Windows 10 or Windows 11 computer. It uses normal PowerShell, not WSL. The same steps work on a laptop brought to the demo.

## 1. Install these once

Open each download page and use the normal installer. After installing, **close PowerShell and open it again** so Windows sees the new commands.

| Program | Where to get it | What to check |
| --- | --- | --- |
| Git | <https://git-scm.com/download/win> | `git --version` |
| Python 3.12 | <https://www.python.org/downloads/windows/> | Tick **Add python.exe to PATH**. Check `py -3.12 --version`. |
| Node.js LTS (20.9 or newer) | <https://nodejs.org/> | `node --version` and `npm --version` |
| Docker Desktop | <https://www.docker.com/products/docker-desktop/> | Start it and wait for **Running**. Check `docker --version` and `docker compose version`. |

Docker Desktop may ask to enable WSL2. Allow it; Docker needs that internally. You still run every project command in normal PowerShell.

> Put the project in a short folder such as `C:\dev\Wear-Right`. Do not put it inside OneDrive; syncing thousands of `node_modules` files slows everything down.

## 2. Download the project

Right-click the folder where you want it, choose **Open in Terminal**, then run:

```powershell
git clone <repository-url> Wear-Right
cd Wear-Right
```

## 3. The four commands

Run these from the project folder, in this order.

### Install

```powershell
node .\scripts\wearright.mjs install
```

This creates the Python environment, creates `apps\server\.env` with a random secret key, and installs the Python and Node packages. You only need it once, or again after pulling new dependencies.

### Seed all demo data

```powershell
node .\scripts\wearright.mjs seed
```

This starts Postgres and Mailpit in Docker, applies the database migrations, and creates:

- the demo products, photos, prices and stock;
- categories, styles, colours and recommender tone rules;
- the demo customer and both admin logins.

If the mannequin kit is present, it imports the mannequin bases, layers and looks as well.

### Create the production build

```powershell
node .\scripts\wearright.mjs build
```

This makes the fast production version of the website in `apps\web\.next`. It does not start anything.

### Run the production demo

```powershell
node .\scripts\wearright.mjs demo
```

This starts Docker, applies migrations, seeds the base data, builds the website, and starts the production website and backend. Open:

**<http://localhost:3000>**

Press **Ctrl + C** in that window to stop the website and backend. To stop the database containers:

```powershell
node .\scripts\wearright.mjs db-down
```

If you already built the website and want to skip the slow build step:

```powershell
node .\scripts\wearright.mjs demo --skip-build
```

## Demo logins

| Who | Page | Email | Password |
| --- | --- | --- | --- |
| Customer | `/login` | demo@wearright.local | demo12345 |
| Admin | `/admin/login` | admin@wearright.com | admin123 |

Admin and customer accounts are separate. The demo emails appear at <http://localhost:8025>.

## Mannequin data

The mannequin kit is not in Git because the images are large. Put the provided folder here:

```text
Wear-Right\
  extras\
    mannequin-alpha-kit\
      manifest.csv
      base\men.png
      base\women.png
      renders\...
```

`seed` finds that folder automatically. If the kit is somewhere else:

```powershell
node .\scripts\wearright.mjs seed --mannequin-kit "D:\assets\mannequin-alpha-kit"
```

Only rows marked `done` in `manifest.csv` are imported. The kit references products that must already exist in the database. On this demo machine they do. On a completely empty database, import the product catalogue first or restore a database backup; otherwise the mannequin rows are skipped with a message.

To skip the mannequin even when the kit exists:

```powershell
node .\scripts\wearright.mjs seed --skip-mannequin
```

## Every day

```powershell
node .\scripts\wearright.mjs dev
```

This starts Docker and runs the development website and backend with live reload. Open <http://localhost:3000>.

## Helpful commands

| Command | What it does |
| --- | --- |
| `node .\scripts\wearright.mjs db-up` | Start Postgres and Mailpit |
| `node .\scripts\wearright.mjs db-down` | Stop the containers, keep the data |
| `node .\scripts\wearright.mjs db-reset` | Delete the database volume and start empty |
| `node .\scripts\wearright.mjs test` | Run the backend and website tests |
| `node .\scripts\wearright.mjs doctor` | Show what is installed and what is missing |
| `node .\scripts\wearright.mjs --help` | Show every command |

After `db-reset`, run `seed` again.

## If something goes wrong

**"python is not recognized" or the Microsoft Store opens.**
Install Python 3.12 from python.org and tick **Add python.exe to PATH**, or use the `py` launcher. Check `py -3.12 --version`, then open a new PowerShell window.

**"node" or "npm" is not recognized.**
Install Node.js LTS, close PowerShell, open it again, and run `node --version`.

**Docker says it cannot connect.**
Start Docker Desktop and wait until it says **Running**. Check `docker --version` and `docker compose version`.

**Port 5433 is already in use.**
Another database is using it. Stop the other program, or change the port in `docker-compose.yml` and `apps\server\.env` together.

**The website is empty.**
Run `node .\scripts\wearright.mjs seed`, then reload the page.

**Product photos are missing.**
Check `MEDIA_ROOT` in `apps\server\.env`, then run `seed` again or restore the media backup.

**The camera does not open.**
Use `http://localhost:3000`, not a network address. Allow camera access in Windows and in the browser. You can always upload a photo or pick the skin tone manually.

**The build stops with a security warning.**
Use Node.js LTS and run `node .\scripts\wearright.mjs install` again. The package lock installs the tested Next.js version.

## What "production demo" means

`demo` is a production-style **local** demo: the website is built once and served with `next start`, and Django runs without the development reloader. It is not a public website. For a real public deployment you still need HTTPS, a proper web server, secure cookies and a real email provider.
