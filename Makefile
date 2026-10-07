# Wear Right: one-command tasks. Run from the repo root.
SERVER := apps/server
WEB    := apps/web
VENV   := $(SERVER)/venv
PY     := $(VENV)/bin/python
PIP    := $(VENV)/bin/pip

.PHONY: help demo demo-reset db-up db-down db-reset venv env install migrate seed test test-api test-web e2e check build dev

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
