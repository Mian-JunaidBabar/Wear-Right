# Phase N: <title>

Status: <done | done with open items | partial>. Date: <YYYY-MM-DD>. Branch/commit: <...>.

## Goal
One or two sentences from the PRD / phase map.

## What changed
- Backend: key files and what they do (link each).
- Frontend: key files.
- Commands and Makefile targets added.
- Migrations.

## Decisions and why
- Each non-obvious choice, the alternative, and the reason. Include anything that deviates from the PRD.

## Gates (real output)
```
make test:   <paste the pytest and vitest summary lines>
make build:  <result>
make e2e:    <paste summary line>
models tests: <paste summary line>
```

## Real-model checks
Which models ran, where the weights live, what was verified with them, and what was NOT verified.

## Known limitations
- Honest list. Uncalibrated thresholds, untested data, bias risks.

## How to run it
Commands a new person needs.

## Open items for later phases
- ...
