# Status

## Current phase
Phase 1 (in progress): Next.js UI port, real auth, permissions.

## Deviations from plan
- Postgres is published on host port 5433, not 5432 (5432 is taken by a local Postgres on the dev machine). `docker-compose.yml`, `.env.example` and the settings default all use 5433.
- Compose project name is pinned to `wear-right` so every checkout/worktree manages the same container.
- Venv lives at `apps/server/venv` (CLAUDE.md, `run.sh`, Makefile and root `package.json` agree on that).
- `apps/web` uses a `src/` directory (`src/app`, `src/lib`, ...), so `proxy.ts` lives in `apps/web/src/`.
- Demo admin is username `admin`, email `admin@wearright.local`, password `admin12345` (when `DEBUG`).
- `docs/` is tracked except `docs/agent/` (phase prompts stay local, see `.gitignore`).

## Decisions
- Django ORM only, layered MVC modular monolith (see CLAUDE.md).
- Local only, no deployment.

## Open issues

## How to run
See README.md.

## Test commands
`make test`, `make e2e`, `make check`.
