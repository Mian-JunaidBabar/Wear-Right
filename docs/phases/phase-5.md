# Phase 5: Functional freeze M1

Status: done. Date: 2026-10-27. Branch: `agent/functional-m1`. Tag: `v0.1-functional`.

## Goal

Freeze a working, demonstrable M1: every main journey works in a browser, the app is usable on a phone width, gates are green with real output, documentation and demo data are reproducible, and the remaining weaknesses are stated honestly. No new styling research or mannequin work.

## What changed

- **Whole-journey browser test** (`apps/web/e2e/12-functional-m1.spec.ts`): manual tone → recommendations; guest cart → register → merged server cart → checkout → confirmation → order history/detail; non-face upload → rescan card → manual picker.
- **Quality checks** (`apps/web/e2e/13-m1-quality.spec.ts`): a real 404; every public route at 390×844 with a horizontal-overflow assertion and attached full-page screenshots; signed-in and admin routes at the same width; labelled forms with a keyboard tab order.
- **Route coverage** (`06-all-routes`): `/scan`, `/cart` and `/checkout` added to the clean-load sweep.
- **States**: `/cart`, `/checkout` and `/orders/[id]` have explicit loading, empty and error states; scanner failure is a rescan card, not a dead end. Product detail has a size picker and stock feedback.
- **Demo data**: `make demo-data` (Postgres, migrate, seed catalogue/categories/tone rules/customer/staff); `docs/DEMO.md` is a runnable walkthrough.
- **Docs**: phase summaries 2–5, README routes/setup, rewritten `docs/STATUS.md` with gates, decisions and open issues.
- **Accessibility fix**: register/login inputs now have explicit `label for`/`id` pairs, verified by keyboard tab order in Playwright.

## Decisions and why

- **A functional freeze means freeze.** Known research gaps (skin-tone accuracy, mannequin realism) were documented, not quietly improved. Changing the detector now would invalidate the demo without evaluation.
- **Test the journey, not only units.** A passing API suite did not catch the cart badge race or the scanner 422 UX; the browser tests did. The new specs are the acceptance criteria for M1.
- **390px is the mobile floor.** It covers common phones; wider layout bugs (the legacy 8px overflow at 1280) are recorded rather than hidden.
- **Demo data must be reproducible.** The seeded catalogue, tone rules and demo accounts come from commands that can be rerun; prices are explicitly placeholders.
- **Tag only after the gates pass.** `v0.1-functional` marks the frozen M1 commit.

## Gates (real output)

```
make test:     450 backend passed; 99 web tests passed (11 files); tsc clean; eslint clean
npm run build: passed (Next.js 16.4.0; security advisory acknowledged and reported)
make e2e:      48 passed (4.5m), EXIT:0
manage.py check: no issues
makemigrations --check: no changes
```

The build/dev server prints a Next.js security advisory for 16.4.0; it continues after the reminder, and the upgrade is deliberately left for a separate decision/worktree.

## Real-model checks

The journey tests use the real Django stack and seeded catalogue. Scanner specs `08-scanner-v2` exercise the real model path when weights are installed; the functional M1 tests also cover the manual path, which needs no model. No accuracy evaluation was run.

## Known limitations

- Skin-tone accuracy is unmeasured; the algorithm is frozen until Phase 7.
- Recommendations and looks are rule-based starting points, not user-validated.
- Mannequin bodies are procedural and garments are box-positioned, not draped.
- Demo card payment is not a payment integration.
- Password reset, email verification and login rate limiting are absent.
- Some admin tabs remain legacy static content.
- The shop filters/pages client-side over a large fetched page; the server-side filtered API is implemented and tested but not yet the shop's only path.

## How to run it

```bash
make install
make demo-data
make demo          # or npm run dev
```

Then follow `docs/DEMO.md`. Gates: `make test && make build && make e2e`.

## Open items for later phases

- Phase 6: improve the mannequin (bodies, drape, real back photos).
- Phase 7: labelled skin-tone evaluation and `evaluate_scanner`.
- Phase 8: user study and demo hardening.
- Adopt server-side catalogue filtering in the shop; finish admin transition options.
