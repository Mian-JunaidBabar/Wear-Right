# Plan 01: every product knows what it is, and the product you open is the one you see

## The bug

Shop → open "Heavy Shirt" → Preview Outfit. The panel lists "Your pick: Heavy Shirt", but the mannequin wears an orange kids' T-shirt (listed as **TOP**) with jeans and shoes. Two things are wrong:

1. **The anchor is not drawn.** The current mannequin only draws products with `mannequin_ready=True` and a `mannequin_image` (made by `make mannequin-assets`). Products added from the admin panel never go through that pipeline, and "Heavy Shirt" is a photo of a person, which the pipeline refuses anyway. So the anchor is silently skipped and only the picks show. (Plan 02 removes the photo dependency entirely; this plan makes sure the data is right for it.)
2. **The look engine filled the anchor's own slot with another product.** `recommender/engine/looks.py` skips a template slot only when `spec.slot == anchor.slot`. The anchor's slot comes from `recommender/adapter.py::infer_slot`: `product.slot`, else words in the category name, else `garment_type`. Admin-created products have `slot` blank, and depending on the category and garment type the anchor ends up as `outerwear`, `kurta` or `''`, so the template still asks for a `top` and picks the orange T-shirt. A kids' item in an adult man's look is a second data problem (Kaggle has Boys/Girls rows).

## Step 0: confirm the data (do this first, paste the output in the report)

```bash
cd apps/server && venv/bin/python manage.py shell -c "
from catalog.models import Product
from recommender.adapter import product_to_item
for p in Product.objects.filter(name__icontains='heavy shirt') | Product.objects.filter(name__icontains='tantra'):
    i = product_to_item(p)
    print(p.id, p.name, '| slot', p.slot, '| garment', p.garment_type, '| cat', p.category, '| cat.slot', getattr(p.category_ref,'slot',None), '| gender', p.gender, '| item.slot', i.slot, '| item.gender', i.gender, '| ready', p.mannequin_ready, p.mannequin_note)
print('blank slot:', Product.objects.filter(slot__isnull=True).count() + Product.objects.filter(slot='').count())
print('blank gender:', Product.objects.filter(gender__isnull=True).count() + Product.objects.filter(gender='').count())
print('kids:', Product.objects.filter(name__iregex=r'\b(kid|kids|boys|girls|baby)\b').count())
"
```

If the numbers show something different from the explanation above, stop and write what you found before changing code.

## Tasks

### A. One field that says what a product is: `Product.kind`

1. Add `kind = CharField(max_length=20, blank=True, default='')` to `catalog.Product` with choices:
   - tops: `tshirt`, `shirt`, `polo`, `kurta`, `kameez`
   - outerwear: `jacket`, `blazer`, `waistcoat`, `hoodie`
   - bottoms: `jeans`, `trousers`, `shorts`, `shalwar`
   - footwear: `sneakers`, `formal_shoes`, `sandals`, `boots`
   - accessories: `watch`, `belt`, `tie`, `cap`, `sunglasses`, `bag`
   - women: `dupatta`, `dress`
2. `catalog/engine/kinds.py` (pure Python, no Django): `infer_kind(name, category, slot, garment_type) -> str` from keywords. Examples: "t-shirt|tee|tshirt" → tshirt, "polo" → polo, "shirt" → shirt, "kurta|kurti" → kurta, "kameez|shalwar kameez" → kameez, "jean|denim" → jeans, "short" → shorts, "trouser|pant|chino" → trousers, "sandal|chappal|slipper|flip flop|kolhapuri" → sandals, "sneaker|casual shoe|sports shoe|trainer|vans" → sneakers, "formal shoe|oxford|loafer|derby|brogue" → formal_shoes, "boot" → boots, "watch" → watch, "belt" → belt, "tie" (whole word) → tie, "cap|hat" → cap, "sunglass" → sunglasses, "jacket|coat" → jacket, "blazer|suit jacket" → blazer, "waistcoat|vest" → waistcoat. Fall back on slot (top → shirt, bottom → trousers, footwear → sneakers). Unit-test it with a table of at least 30 real names taken from the catalog.
3. `slot` derives from `kind` when blank (`tshirt/shirt/polo` → top, `kurta/kameez/dress` → kurta, etc.). Keep `garment_type` as legacy, do not remove it.
4. `ProductSerializer` (`catalog/serializers.py`, inside `_sync_relations`): when `kind` is blank, infer it; when `slot` is blank, take it from `kind`, else from `category_ref.slot` (map Category `fullbody` → product `kurta`); when `gender` is blank, take it from `category_ref.gender`. Explicit values from the admin always win.
5. Migration + backfill: a data migration (or a `manage.py backfill_kinds` command called from `make demo-data`) that fills `kind`, `slot`, `gender` for existing rows using the same functions. Idempotent; prints counts.
6. `recommender/engine/items.py::accessory_kind` and `recommender/adapter.py`: read `product.kind` first, keep the name-based guess as the fallback.

### B. Admin form

In `apps/web/src/components/AdminView.tsx` product modal:

- Add a **Type** select (the `kind` list, grouped with `<optgroup>`), default "Detect from name" (`""`).
- Add a **Shop section** select for `gender` (men / women / unisex), default from the chosen category.
- Show a small read-only line under them: "Mannequin slot: top" (computed the same way as the server; or just show what the API returns after save).
- Remove the old **Garment Type** select from the form (keep sending nothing for it; the column stays in the DB).

### C. The look must be built around the anchor

1. `recommender/engine/looks.py::complete_look`: skip every template spec whose slot equals the anchor's slot **or** whose slot is "covered" by the anchor (`kurta` covers `top`; `dress` covers `top` and `bottom`). Add a `COVERS` map and tests.
2. Exclude kids' products from adult looks and recommendations: a product is "kids" when its Kaggle gender is Boys/Girls or the name matches `\b(kid|kids|boys|girls|baby|infant)\b`. Add `is_kids` to the engine `Item` and filter in `_candidates` and the ranker unless the anchor itself is a kids' item.
3. Return `anchor_slot` and `anchor_kind` in `/api/looks/complete/` so the web app does not have to guess.

## Tests

- `catalog/tests/test_kinds.py`: inference table; serializer fills `kind`/`slot`/`gender` on create and update; explicit admin values are kept.
- `recommender/tests/test_looks.py`: anchor with blank `slot` but name "Heavy Shirt" and category "Men Shirt" → no `top` slot in the response; a kurta anchor → no `top`; kids' tee never picked for an adult anchor.
- API test: `/api/looks/complete/?product_id=<heavy shirt>` returns `anchor_slot == "top"` and no slot with `slot == "top"`.
- Playwright: extend `e2e/09-recommender.spec.ts`: open the preview for a shirt; the list must not contain a second "Top" row.

## Acceptance

- Step 0 output pasted; re-run it after the backfill and paste again (blank slot/gender counts near zero).
- Opening any shirt shows exactly one top in the look: the shirt itself.
- Gates: `make test`, web build, `npx playwright test e2e/09-recommender.spec.ts e2e/05-admin.spec.ts`.

## Out of scope

Drawing anything (plan 02). Changing the colour scoring.
