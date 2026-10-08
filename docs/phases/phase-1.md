# Phase 1: Next.js port, real auth, permissions

Status: done (retrospective summary, compiled from `docs/STATUS.md`; the whole suite was re-run at the end of phase 3 and passes).

## Goal
Port the shop UI to Next.js, add real sign-in with httpOnly JWT cookies, and enforce permissions per endpoint.

## What changed
- Every legacy page ported to `apps/web/src` (routes `/login`, `/register`, `/scanner`, ... with the old URLs redirecting).
- Auth: dj-rest-auth + simplejwt, cookies `wr-access` and `wr-refresh`, never in response bodies ([accounts](../../apps/server/accounts/)).
- CSRF double-submit token on every cookie-authenticated unsafe request ([core/csrf.py](../../apps/server/core/csrf.py)).
- Permissions: public reads, staff-only product writes, customer data scoped to `request.user`; another user's order is a 404.
- `proxy.ts` sends visitors without a session cookie from private pages to `/login`.
- Demo customer and admin logins, `make demo`, [docs/DEMO.md](../DEMO.md).

## Decisions and why
See `docs/STATUS.md`, section "Decisions": cookie plus CSRF strategy, the `wr-session` hint cookie (so guests never trigger 401s), stale tokens treated as anonymous on public endpoints, and customers can create but not edit or delete orders.

## Gates
At the end of phase 1: 150 backend tests, 58 frontend tests, 20 Playwright scenarios. Current full-app run (end of phase 3): 297 backend, 58 frontend, 23 Playwright.

## Real-model checks
None: this phase used no AI models.

## Known limitations
- No password reset by email, no email verification, no login rate limit.
- Customers cannot cancel or edit an order.
- The cart is still in the browser until phase 6.
- Several admin tabs show static placeholder content.

## How to run it
See [README.md](../../README.md).

## Open items for later phases
Cart to the server (phase 6); the open issues list in `docs/STATUS.md`.
