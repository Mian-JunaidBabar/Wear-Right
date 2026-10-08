"""Complete the look: fill each slot around an anchor item with the best colour-harmonious pieces. Pure Python."""
from collections import namedtuple

from .harmony import harmony, leather_match
from .items import accessory_kind, colour_label
from .ranker import gender_ok

Spec = namedtuple("Spec", "slot kind required", defaults=("", True))

LOOK_TEMPLATES = {
    "casual": [Spec("top"), Spec("bottom"), Spec("footwear"), Spec("accessory", "", False)],
    "formal": [
        Spec("outerwear"), Spec("top"), Spec("bottom"), Spec("footwear"),
        Spec("accessory", "tie", False), Spec("accessory", "watch", False), Spec("accessory", "belt", False),
    ],
    "eastern_men": [Spec("kurta"), Spec("footwear"), Spec("outerwear", "", False)],
    "eastern_women": [
        Spec("kurta"), Spec("bottom"), Spec("dupatta"), Spec("footwear"), Spec("accessory", "", False),
    ],
}
W_HARMONY, W_PALETTE, W_FORMALITY = 0.5, 0.3, 0.2
SWAPS = 2


def look_type(anchor, gender):
    styles = {s.lower() for s in anchor.styles}
    if anchor.slot in ("kurta", "dupatta") or "eastern" in styles:
        return "eastern_women" if gender == "women" else "eastern_men"
    if anchor.slot == "outerwear" or anchor.formality >= 4:
        return "formal"
    return "casual"


def _formality_score(anchor, item):
    if not anchor.formality or not item.formality:
        return 0.5
    return 1 - abs(anchor.formality - item.formality) / 2


def _candidates(anchor, spec, items, gender):
    for item in items:
        if item.id == anchor.id or item.slot != spec.slot or not item.size_ok or not gender_ok(item.gender, gender):
            continue
        if spec.kind and accessory_kind(item) != spec.kind:
            continue
        if anchor.formality and item.formality and abs(anchor.formality - item.formality) > 1:
            continue
        yield item


def _score(anchor, item, spec, references, palette, footwear):
    if spec.kind == "belt" and footwear is not None:
        fit, why = leather_match(footwear.color_hex, item.color_hex), "belt matches the shoes"
    else:
        results = [harmony(ref.color_hex, item.color_hex) for ref in references]
        fit = sum(score for score, _ in results) / len(results)
        why = results[0][1]
    palette_score = palette.normalised(colour_label(item))
    total = W_HARMONY * fit + W_PALETTE * palette_score + W_FORMALITY * _formality_score(anchor, item)
    return round(total, 3), why


def complete_look(anchor, items, palette, *, gender=""):
    """Template slots filled around the anchor: best pick plus two swaps per slot, or None when nothing fits."""
    gender = anchor.gender if anchor.gender in ("men", "women") else gender
    kind = look_type(anchor, gender)
    chosen, slots = [], []
    footwear = anchor if anchor.slot == "footwear" else None
    for spec in LOOK_TEMPLATES[kind]:
        if spec.slot == anchor.slot and (not spec.kind or accessory_kind(anchor) == spec.kind):
            continue  # the anchor already fills this slot
        references = [anchor] + chosen
        ranked = sorted(
            ((*_score(anchor, item, spec, references, palette, footwear), item) for item in _candidates(anchor, spec, items, gender)),
            key=lambda row: (-row[0], -row[2].id),
        )
        best = ranked[0] if ranked else None
        if best:
            chosen.append(best[2])
            if spec.slot == "footwear":
                footwear = best[2]
        slots.append({
            "slot": spec.slot, "kind": spec.kind, "required": spec.required,
            "pick": None if not best else {"item": best[2], "score": best[0], "why": best[1]},
            "swaps": [{"item": row[2], "score": row[0], "why": row[1]} for row in ranked[1:1 + SWAPS]],
        })
    missing = [s["slot"] if not s["kind"] else s["kind"] for s in slots if s["required"] and not s["pick"]]
    return {"look_type": kind, "gender": gender, "slots": slots, "complete": not missing, "missing": missing}
