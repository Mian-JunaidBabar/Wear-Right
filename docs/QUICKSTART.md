# Wear Right: quick start

Short, step-by-step version of the setup. Full details and troubleshooting: [SETUP.md](SETUP.md).
Run every command in a terminal from the project folder.

## Every day: start the project

1. Go to the project folder: `cd ~/Wear-Right` (use the folder where the project is).
2. Start the database and the local mail inbox: `make db-up`
3. Apply any new database changes: `make migrate`
4. Start the website and the backend: `make dev`
5. Open http://localhost:3000 in the browser.
6. To stop: press `Ctrl + C` in the terminal, then `make db-down`.

## Logins for the demo

| Who | Where | Email | Password |
| --- | --- | --- | --- |
| Customer | `/login` | demo@wearright.local | demo12345 |
| Admin (Super Admin) | `/admin/login` | admin@wearright.com | admin123 |

Admin and customer accounts are separate: an admin account cannot sign in on the shop, and a customer cannot open
the admin panel. Emails (password reset, order placed) appear in the local inbox at http://localhost:8025.

## For the evaluation: faster demo build

1. `make demo` (builds the website once, then starts it without the development badge).
2. Open http://localhost:3000
3. Before the evaluation day, back up the product photos: `make media-backup`

## Fresh setup on a new machine

1. Install the requirements: Git, Docker with Docker Compose, Python 3.12, Node.js 20.9 or newer, and Make.
   On Ubuntu: `sudo apt install -y git make python3.12 python3.12-venv docker.io docker-compose-v2`, and Node.js from nodejs.org or nvm.
2. Allow Docker without sudo: `sudo usermod -aG docker $USER`, then log out and log in again.
3. Copy the project folder to the machine (or clone it) and open a terminal in it.
4. Install everything: `make install` (creates the Python environment, the settings file `apps/server/.env`, and installs packages).
5. Put the product photos in the media folder named by `MEDIA_ROOT` in `apps/server/.env`, or restore a backup:
   `tar xzf ~/wear-right-media-DATE.tgz -C <media folder>`
6. Start the database and load the demo data and logins: `make demo-data`
7. Download the AI models used by the face scan and background removal (large download, once): `make models`
8. Start the project: `make dev` and open http://localhost:3000

## If something goes wrong

| Problem | Fix |
| --- | --- |
| Database will not start, port 5433 in use | Another database is using the port. Stop it, or change the port as described in SETUP.md. |
| Product photos missing, placeholder images shown | The media folder is empty or in the wrong place. Check `MEDIA_ROOT` in `apps/server/.env` and copy the photos there (step 5). |
| Login says "team account" | That is an admin account. Use `/admin/login`. |
| Need a clean database for a walkthrough | `make demo-reset` (deletes orders and accounts made during testing, then reloads the demo data). |
