# apps/web

Next.js 16 (App Router, TypeScript, Tailwind v4) storefront for Wear Right. See the repo-root `README.md` and `CLAUDE.md`.
The browser only talks to this app on port 3000; `next.config.ts` rewrites `/api/*` and `/media/*` to Django on 8000.
