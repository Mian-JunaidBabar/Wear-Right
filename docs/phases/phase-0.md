# Phase 0: Foundation

Status: done (retrospective summary, compiled from `docs/STATUS.md`; re-verified by the full gate run at the end of phase 3). Delivered in commits up to `fix: phase 0 gaps`.

## Goal
Postgres, a layered backend skeleton, a Next.js scaffold with rewrites, and one-command dev.

## What changed
- PostgreSQL 17 + pgvector in Docker ([docker-compose.yml](../../docker-compose.yml)), published on host port 5433.
- Django project split into domain apps (`core`, `accounts`, `catalog`, `scanner`, `recommender`, `orders`) with the controller / DTO / service / selector / model layers (see [CLAUDE.md](../../CLAUDE.md)).
- Next.js 16 app in `apps/web` with `/api/*` and `/media/*` rewritten to Django, so the browser only talks to port 3000.
- [Makefile](../../Makefile), root `package.json` (`npm run dev`), [README.md](../../README.md), `lib/api.ts` (the only place that calls `fetch`).
- The legacy Vite client was removed.

## Decisions and why
- Postgres on 5433, not 5432, because a local Postgres already uses 5432. Compose project pinned to `wear-right` so every checkout shares one container.
- Django ORM only; Next.js never touches the database.
- Local only, no deployment config.

## Gates
Phase 0 checks initially failed (no Makefile, no tests, wrong API paths). They were fixed in `fix: phase 0 gaps`; checks 1 to 5 passed afterwards and check 6 did not apply (the Vite client was already gone).

## Real-model checks
None: this phase used no AI models.

## Known limitations
- The shared dev database is one container for all checkouts, so a migration applied by one branch affects the others (see phase 2).

## How to run it
`make install && make db-reset && make migrate && make seed`, then `npm run dev`.

## Open items for later phases
None carried forward.
