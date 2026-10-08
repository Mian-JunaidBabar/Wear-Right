# Phase 4: Tone-colour rules, ranker, complete-the-look

Status: done with open items. Runs on the real 161-product catalog; the rule values are starting points, not validated styling advice.

## Goal
One backend source of truth for which colours suit a skin tone, a ranker that returns 10 to 15 picks with reasons, and look templates that complete an outfit around one item (FR-08, FR-09, FR-14).

## What changed
- **Rules table:** `ToneColorRule` (depth, undertone, colour, score +2 / +1 / -2) in [recommender/models.py](../../apps/server/recommender/models.py), editable in the Django admin and through `GET/POST/PUT/DELETE /api/tone-rules/` (public read, staff write). 244 starting rules are seeded by `make seed` (`seed_tone_rules`, idempotent, never overwrites staff edits). Defaults are built in [default_rules.py](../../apps/server/recommender/engine/default_rules.py).
- **Engine (no Django):** [ranker.py](../../apps/server/recommender/engine/ranker.py) (filter, score, cap), [looks.py](../../apps/server/recommender/engine/looks.py) (four look templates), [harmony.py](../../apps/server/recommender/engine/harmony.py) (neutrals, analogous, complementary, clashing, shoes-and-belt match), [palette.py](../../apps/server/recommender/engine/palette.py), [items.py](../../apps/server/recommender/engine/items.py). [adapter.py](../../apps/server/recommender/adapter.py) turns catalog products into engine items and infers slot, gender and formality for products that were never tagged.
- **API:**
  - `GET /api/recommendations/top/` ranked picks with `reason` and `match`, plus the shopper's `palette`.
  - `GET /api/looks/complete/?product_id=` a best pick and two swaps per slot, `complete` and `missing`.
  - `GET /api/tone-rules/palette/` best and avoid colours for a depth and undertone.
  - The old `/api/outfit/generate/` and `/api/products/recommendations/` still work.
- **Profile (FR-03):** `favorite_colors` and `avoided_colors` on `UserProfile` (migration `accounts 0004`); they change the ranking. No UI for them yet.
- **Web:** the Recommended page and the Complete Outfit page now read the server (reasons, match %, palette chips, swaps, look total, "Add whole look to cart"). The scan result card's palette is the server's palette and follows the undertone override. The client colour tables were deleted from [recommendationRules.ts](../../apps/web/src/features/recommender/recommendationRules.ts). The Roman Urdu empty-state text is now English.
- **Commands:** `seed_tone_rules`, `evaluate_recommender`, and `activate_demo_catalog` (`make demo-catalog`, demo only).

## Decisions and why
- **Score** = 0.5 x palette + 0.3 x style + 0.2 x preference (PRD). Palette score maps rule +2 / +1 / none / -2 to 1 / 0.75 / 0.5 / 0. Colours scored -2 are never recommended. At most 3 items per category, 15 in total.
- **Rule combining:** depth and undertone each vote best (2), good (1) or avoid (-2); a total of 3 or more is "best", 1 to 2 "good", -2 or less "avoid". The first version gave Fair + warm shoppers only one best colour, because the Fair and warm lists barely overlapped; teal, olive, coral and peach were added to the Fair list.
- **Colour of a product** is named from its extracted pixel colour (nearest reference colour), falling back to its colour name.
- **Look slot filling:** candidates must match gender and be within one formality level of the anchor. Score = 0.5 harmony with the anchor and earlier picks + 0.3 palette + 0.2 formality. Shoes are chosen before the belt, and the belt is matched to the shoes' leather colour.
- **Accessory kinds** (tie, watch, belt) are read from the product name, because the catalog has no article-type column.
- **Demo prices:** the Kaggle data has none, so `make demo-catalog` activates the 150 imported drafts with clearly labelled placeholder prices (a base per slot plus up to Rs. 900) and 5 per size in stock. They are not real prices and not thesis data.
- Style preference on the Recommended page is a soft boost, not a filter.

## Gates (real output)
```
make test:        370 passed (backend)   Tests 66 passed (web)   tsc + eslint clean
make build:       passed
make test-models: 7 passed
make e2e:         28 passed (2.1m)
tests added:      73 backend (recommender), 8 web unit, 5 Playwright scenarios (09-recommender)
```
During development one of my new scenarios failed because its selector matched 13 elements ("Your best colours" also appears inside every pick's reason text). The app was right; the test was fixed and the full suite then passed.

## Real-data checks (`evaluate_recommender` on the dev database)
Shoppable catalog: 161 products (accessory 29, footwear 29, top 27, bottom 26, outerwear 21, kurta 20, dupatta 9).
- **Picks are personal.** The same catalog gives 15 items for every depth and undertone, and the item sets overlap little: Fair 30%, Medium 11%, Dark 36% between warm and cool, and 15% between Fair and Dark (both warm).
- Items in the shopper's best colours out of 15: Fair warm 1, Fair cool 15, Fair neutral 15, Medium warm 6, Medium cool 13, Medium neutral 12, Dark warm 3, Dark cool 12, Dark neutral 7.
- **Looks complete:** casual 102 of 102, eastern men 9 of 9, eastern women 20 of 21, formal 19 of 29 (66%). Required slots filled on average: 98%. Most often missing: top (10).

## Known limitations
- **The rule values are my colour-theory starting points**, not validated. They are data in a table so the team can change them; no styling accuracy is claimed.
- **Fair + warm shoppers see few best-colour items** (1 of 15) because the catalog is mostly black, grey, white and blue.
- **Formal looks fail 1 time in 3** mainly for lack of a formal top: a blazer needs a top within one formality level, and nearly all Kaggle tops are casual.
- Product colour names come from pixels, so dark navy can read as black and shaded white as grey (phase 2 finding); on-model photos can skew the colour.
- Accessory kind comes from words in the name; an unnamed accessory is never offered as a tie, watch or belt.
- Size filtering only knows sizes S to XXL on garments; shoe and trouser numeric sizes are ignored.
- Favourite and avoided colours have an API but no screen yet.
- "Add whole look to cart" uses the browser cart; the server cart arrives in phase 6.
- Orders still contain one product each (phase 6).

## How to run it
```
make seed            # also loads the tone rules
make demo-catalog    # DEMO ONLY: placeholder prices for the imported drafts
apps/server/venv/bin/python apps/server/manage.py evaluate_recommender
```
Edit rules at `/admin/` (Tone color rules) or `PUT /api/tone-rules/<id>/` as staff.

## Open items for later phases
- Phase 5 (mannequin) needs flat-lay or cut-out garments; the on-model photos from phase 2 will look wrong there.
- A user study (week 8) is the only honest way to judge whether the picks and looks are good.
- Tag formal tops (or add formality per article type) so formal looks complete.
