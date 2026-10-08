# Wear Right: one-command tasks. Run from the repo root.
SERVER := apps/server
WEB    := apps/web
VENV   := $(SERVER)/venv
PY     := $(VENV)/bin/python
PIP    := $(VENV)/bin/pip

.PHONY: help demo demo-reset db-up db-down db-reset venv env install migrate seed models test-models import-catalog process-images test test-api test-web e2e check build dev

help:
	@grep -E '^[a-z-]+:' Makefile | cut -d: -f1 | tr '\n' ' '; echo

db-up:
	docker compose up -d --wait

db-down:
	docker compose down

# Destroys all database data.
db-reset:
	docker compose down -v
	docker compose up -d --wait

venv:
	test -x $(PY) || python3.12 -m venv $(VENV)

# Creates apps/server/.env with a random SECRET_KEY the first time (JWTs are signed with it).
env:
	@test -f $(SERVER)/.env || { \
	  sed "s|^SECRET_KEY=.*|SECRET_KEY=$$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')|" $(SERVER)/.env.example > $(SERVER)/.env; \
	  echo "created $(SERVER)/.env"; }

install: venv env
	$(PIP) install -q -r $(SERVER)/requirements.txt
	npm install
	npm --prefix $(WEB) install

migrate:
	$(PY) $(SERVER)/manage.py migrate

seed:
	$(PY) $(SERVER)/manage.py seed_products

# Downloads AI model weights into apps/server/ml_models (rembg, MediaPipe) once; they are gitignored.
models:
	$(PY) $(SERVER)/manage.py download_models

# Imports Kaggle products as drafts (no price, hidden from shoppers until an admin activates them).
# SOURCE is the unzipped Kaggle folder that holds styles.csv and images/.
import-catalog:
	@test -n "$(SOURCE)" || { echo 'usage: make import-catalog SOURCE=/path/to/kaggle-folder [LIMIT=150]'; exit 1; }
	$(PY) $(SERVER)/manage.py import_fashion_catalog --source "$(SOURCE)" --limit $(or $(LIMIT),150)

# Removes backgrounds and extracts colours for existing products that have a photo but no colour.
process-images:
	$(PY) $(SERVER)/manage.py process_product_images

# Runs only the tests that load the real downloaded models (needs `make models`).
test-models: db-up
	cd $(SERVER) && ../../$(PY) -m pytest -m models -v

test-api: db-up
	cd $(SERVER) && ../../$(PY) -m pytest

test-web:
	npm --prefix $(WEB) test
	npm --prefix $(WEB) run typecheck
	npm --prefix $(WEB) run lint

test: test-api test-web

build:
	npm --prefix $(WEB) run build

# Starts Postgres, migrates, seeds, and (unless already running) both servers, then runs Playwright.
e2e: db-up migrate seed
	npm --prefix $(WEB) run e2e

check: test build e2e

dev: db-up
	npm run dev

# Production build of the web app: faster, and no Next.js dev badge on screen.
demo: db-up migrate build
	npm run demo

# Fresh database with the seeded catalog and logins, ready for a walkthrough.
demo-reset: db-reset migrate seed
