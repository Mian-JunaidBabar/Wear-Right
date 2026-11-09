# Wear Right: one-command tasks. Run from the repo root.
SERVER := apps/server
WEB    := apps/web
VENV   := $(SERVER)/venv
PYTHON ?= python3.12

ifeq ($(OS),Windows_NT)
PY  := $(VENV)/Scripts/python.exe
PIP := $(VENV)/Scripts/pip.exe
else
PY  := $(VENV)/bin/python
PIP := $(VENV)/bin/pip
endif

# Where product photos live. Must match MEDIA_ROOT in apps/server/.env —
# override here (make media-backup MEDIA_ROOT=/path) if MEDIA_ROOT was moved.
MEDIA_ROOT ?= $(SERVER)/media

.PHONY: help setup demo demo-build demo-data demo-reset db-up db-down db-reset venv env install migrate seed seed-all models test-models mannequin-assets demo-catalog import-catalog alpha-import process-images media-backup test test-api test-web e2e check build dev

help:
	@grep -E '^[a-z-]+:' Makefile | cut -d: -f1 | tr '\n' ' '; echo

# Cross-platform aliases. They use the Node task runner, so they also work in
# Git Bash on Windows; native PowerShell users can call the runner directly.
setup:
	node scripts/wearright.mjs install

seed-all:
	node scripts/wearright.mjs seed

demo-build:
	node scripts/wearright.mjs build

db-up:
	docker compose up -d --wait

db-down:
	docker compose down

# Destroys all database data.
db-reset:
	docker compose down -v
	docker compose up -d --wait

venv:
	test -x $(PY) || $(PYTHON) -m venv $(VENV)

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

# Everything a reviewer needs for the functional M1 walkthrough: catalog,
# colour rules, categories and the demo customer/staff logins. Safe to re-run.
demo-data: db-up migrate seed

# Downloads AI model weights into apps/server/ml_models (rembg, MediaPipe) once; they are gitignored.
models:
	$(PY) $(SERVER)/manage.py download_models

# Imports Kaggle products as drafts (no price, hidden from shoppers until an admin activates them).
# SOURCE is the unzipped Kaggle folder that holds styles.csv and images/.
import-catalog:
	@test -n "$(SOURCE)" || { echo 'usage: make import-catalog SOURCE=/path/to/kaggle-folder [LIMIT=150]'; exit 1; }
	$(PY) $(SERVER)/manage.py import_fashion_catalog --source "$(SOURCE)" --limit $(or $(LIMIT),150)

# Imports the Mannequin (alpha) kit (base photo + one render per curated product) as stackable garment layers.
# SOURCE is the kit folder that holds base/, renders/ and manifest.csv; needs `make models`.
alpha-import:
	@test -n "$(SOURCE)" || { echo 'usage: make alpha-import SOURCE=/path/to/mannequin-alpha-kit [GENDER=men] [REBUILD=1]'; exit 1; }
	$(PY) $(SERVER)/manage.py import_alpha_mannequin --source "$(SOURCE)" --gender $(or $(GENDER),men) $(if $(REBUILD),--rebuild,)

# Crops each garment cut-out for the mannequin and flags photos that show a person (needs `make models`).
mannequin-assets:
	$(PY) $(SERVER)/manage.py prepare_mannequin_assets

# DEMO ONLY: activates imported drafts with placeholder prices and stock so the recommender has items to rank.
demo-catalog:
	$(PY) $(SERVER)/manage.py activate_demo_catalog

# Removes backgrounds and extracts colours for existing products that have a photo but no colour.
process-images:
	$(PY) $(SERVER)/manage.py process_product_images

# Copies every product photo into a dated tar.gz in the home folder, e.g. ~/wear-right-media-2026-10-28.tgz.
media-backup:
	tar czf ~/wear-right-media-$$(date +%F).tgz -C $(MEDIA_ROOT) .

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
