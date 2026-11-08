# Plan 04: forgot password and a basic mail service

## Decision: Mailpit yes, better-auth no

**Mail:** Mailpit in `docker-compose.yml` as the local SMTP server. Every email the app sends lands in its web inbox at http://localhost:8025, so the demo can show real emails with no external account. For a real deployment the same settings point at any SMTP provider.

**Auth library: keep Django's auth, do not add better-auth.** better-auth is a TypeScript library that owns its own user, session and account tables and runs inside the Node server. Our users, sessions (httpOnly JWT cookies), CSRF, the admin RBAC (`staff` app) and every permission check live in Django, and `CLAUDE.md` says Next.js never touches the database. Adding better-auth would mean either two user tables kept in sync or moving all auth into Next.js and teaching Django to trust its tokens: weeks of rework on the most security-sensitive part, a week before the defence. It would not reinvent less: Django already ships password reset (`PasswordResetForm`, `default_token_generator`) and dj-rest-auth, which we already use, already exposes it as API endpoints. We wire those up. No custom crypto, no new auth framework.

## What to build

### 1. Mailpit and email settings

- `docker-compose.yml`: service `mailpit` (image `axllent/mailpit`, ports `1025:1025` SMTP and `8025:8025` web UI, restart unless-stopped). `make db-up` already runs `docker compose up -d`, so it starts with the database.
- `core/settings.py` (all from env with local defaults): `EMAIL_BACKEND` smtp, `EMAIL_HOST=localhost`, `EMAIL_PORT=1025`, `EMAIL_USE_TLS=False`, `DEFAULT_FROM_EMAIL="Wear Right <no-reply@wearright.local>"`, `FRONTEND_URL=http://localhost:3000`, `PASSWORD_RESET_TIMEOUT=3600` (1 hour). Add them to `apps/server/.env.example`. Tests use Django's in-memory backend automatically (`mail.outbox`).
- `core/emails.py`: one helper `send_email(*, to, subject, template, context)` that renders `templates/emails/<template>.txt` and `.html` and sends a multipart email. It logs and swallows SMTP errors (an email failure must never break checkout or registration). Emails triggered inside a transaction are sent with `transaction.on_commit`.
- Templates in `apps/server/core/templates/emails/`: a plain base layout with the Wear Right name, brand colour `#C08E3E` and a footer. Keep the HTML simple (tables, inline styles).

### 2. Forgot password for shoppers

- API (dj-rest-auth's views, our serializer):
  - `POST /api/auth/password/reset/` `{email}`: always `200 {"detail": "If an account exists for this email, we sent a reset link."}`, whether or not the email exists (no account enumeration). Sends only to active **non-staff** users.
  - `POST /api/auth/password/reset/confirm/` `{uid, token, new_password1, new_password2}`: validates with `default_token_generator`, runs the password validators, sets the password.
- The email link goes to the web app, not to Django: `{FRONTEND_URL}/reset-password?uid=<uid>&token=<token>`. Override dj-rest-auth's `PASSWORD_RESET_SERIALIZER` (in `REST_AUTH`) so it uses our template and URL.
- After a successful reset, end the user's other sessions: blacklist all their outstanding refresh tokens (`rest_framework_simplejwt.token_blacklist` `OutstandingToken` / `BlacklistedToken`).
- Rate limit both endpoints with DRF `ScopedRateThrottle` (`password_reset: 5/hour`).
- Web:
  - `/forgot-password`: email field, submit, then always the same "check your inbox" message. In dev, show a small hint "Local emails: http://localhost:8025".
  - `/reset-password`: reads `uid` and `token`, asks for the new password twice, success sends to `/login` with a toast.
  - `AuthView.tsx`: "Forgot Password?" goes to `/forgot-password` (it currently opens WhatsApp).
  - Add both pages to the public routes (not in `PRIVATE_ROUTE_PREFIXES`).

### 3. Forgot password for the admin panel

Same mechanics, separate audience, so a shopper email never resets a team account and the reverse:

- `POST /api/admin/auth/password/reset/` and `.../password/reset/confirm/` in `staff/` (reuse the same service with an `audience="admin"` switch). Sends only to `is_admin_account(user)` users; link to `{FRONTEND_URL}/admin/reset-password?...`.
- Web: `/admin/forgot-password` and `/admin/reset-password` pages in the admin style; "Forgot password?" link on `/admin/login`. Both must be public: update `isPrivateAdminPath` in `lib/routes.ts` and the `Gate` in `components/admin/AdminRoot.tsx` (they render like the login page, without the panel).
- Team member creation: optional "Email them a link to set their password" checkbox in the Add member dialog; when ticked, the admin does not type a password, the member gets a set-password email (same reset flow, subject "You have been added to the Wear Right team").

### 4. A few basic transactional emails

Only these, all through `core/emails.py`, all non-blocking:

| When | To | Template |
| --- | --- | --- |
| Account registered | customer | `welcome` |
| Checkout succeeded | customer | `order_placed` (order code, items, total, address, payment method) |
| Admin changes order status, or the customer cancels | customer | `order_status` (new status, order code, link to `/orders/<id>`) |
| Password reset requested | user | `password_reset` |
| Team member added with the email option | member | `team_invite` |

Email verification on signup is **out of scope** (it would block demo accounts); mention it in STATUS as a possible next step.

## Tests

- pytest: reset request sends exactly one email to an existing customer and none for an unknown email, with the same response body; shop endpoint ignores staff emails and admin endpoint ignores customers; the link contains `FRONTEND_URL` and the right path; confirm with a valid token changes the password and blacklists old refresh tokens; a used or wrong token fails; mismatched passwords fail; throttle answers 429 after the limit.
- pytest: checkout sends `order_placed`; status change sends `order_status`; registration sends `welcome`; an SMTP error (patched to raise) does not break checkout.
- vitest: the two reset pages read `uid`/`token` from the URL and post the right body (mock `lib/api`).

## Manual checks (in the report)

1. `make db-up`; http://localhost:8025 shows the Mailpit inbox.
2. Shop: Forgot password with the demo customer email, open the email in Mailpit, follow the link, set a new password, log in with it. An old tab that was logged in as that user is logged out on its next request.
3. Same with an unknown email: same message on screen, no email in Mailpit.
4. Admin: same flow from `/admin/login`.
5. Place an order: `order_placed` arrives. Confirm it in the admin: `order_status` arrives.

## Out of scope

better-auth, social login, 2FA, email verification, magic links.
