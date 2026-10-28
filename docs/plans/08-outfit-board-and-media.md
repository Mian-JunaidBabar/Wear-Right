# Plan 08: the outfit board (replaces plans 02, 05 and 07) + local media storage done properly

## Decision (2026-10-28)

Drop the mannequin. Both attempts to put a garment *on a body* failed on real data: the SVG mannequin
(plan 02) could not place real garments believably and the AR try-on (plan 07) could not track real
photos; the diffusion try-on (plan 05) was already out because it needs a GPU we do not have.

The USP becomes **skin-tone-aware outfit completion**, shown as an **outfit board**: the complete look
is presented with the products' own real photos arranged the way a person wears them — top over bottom
over shoes, accessories alongside. Every piece is swappable tile by tile, and the whole look goes to the
cart in one click. The recommender already picks look pieces by skin tone, so the board is simply the
honest visual for it — no generated bodies, no live body tracking, no broken promises.

## Part A — remove the mannequin work

- Reverted the seven try-on commits (engine, `ArAnchorsEditor`, migration `0009`, MediaPipe page,
  try-on view, admin editor) on this branch. The backend `prepare_mannequin_asset` pipeline stays:
  its transparent cut-outs feed the board (and migration `0003` fields stay).
- Deleted the SVG mannequin UI: `components/Mannequin.tsx`, `features/mannequin/*`, the e2e spec
  `10-mannequin.spec.ts` and `tools/generate_mannequin_bodies.py`, plus the `make mannequin` target.
- The DB never had migration `0009` applied, so no rollback was needed (`showmigrations catalog`
  ends at `0008_product_kind`).

## Part B — the outfit board

- `features/outfit/board.ts` lays a complete-look response out as tiles: a kurta/dress becomes one
  tall tile spanning the top and bottom rows; outerwear overlaps the top; footwear sits below;
  dupatta, tie, watch, belt and generic accessories stack in the side column in template order.
  A slot whose piece is out of stock keeps its dashed tile ("No match in stock"); a piece the shopper
  dropped themselves reads "Not included".
- `components/OutfitBoard.tsx` draws the board; the anchor tile carries a "Your pick" badge.
- `CompleteOutfitView` shows the board beside the item rows — clicking a tile scrolls to and highlights
  that row. `OutfitPreviewModal` previews the same board; a tile click navigates to the product.

## Part C — local media storage done properly

- `MEDIA_ROOT` now comes from the environment (documented in `apps/server/.env.example`) and should
  point **outside the repo** (e.g. `/home/jb/wear-right-data/media`), so uploads survive worktrees,
  backups and reinstalls and every worktree sees the same files.
- Django serves `/media/` itself while `SERVE_MEDIA=True` — independent of `DEBUG`, so the production
  demo build (`DEBUG=False`) shows photos. `static()` only served with `DEBUG=True`, which hid images
  from the demo. For a real deployment, point a web server at `MEDIA_ROOT` and set `SERVE_MEDIA=False`.
- `manage.py check_media` lists every product photo whose file is missing on disk with counts;
  `--fix` clears the dead references (cut-outs also lose `mannequin_ready`) so the UI shows its
  placeholder. `make media-backup` tars the folder into a dated archive in the home folder.
- Every product photo in the web app is drawn through `components/ProductImage.tsx`: lazy,
  `object-contain` (or `object-cover` where a tile crops), and it swaps to the placeholder once if the
  file is missing instead of showing a broken image.

**Why the shop's images were broken:** `ShopView.getProductImage` appended a `?v=Date.now()`
cache-buster to every render (symptom masker: endless refetches and flicker) while the real cause was
`MEDIA_ROOT` sitting inside each empty worktree — DB rows pointed at files that folder did not have.
With `MEDIA_ROOT` outside the repo the DB and the files agree; `check_media` reported a single dead
cut-out reference across the whole catalogue, which `--fix` cleared.
