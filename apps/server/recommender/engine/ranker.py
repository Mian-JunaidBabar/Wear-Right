"""Top picks: filter, score and cap a catalog for one shopper. Pure Python, no Django.

score = 0.5 x palette + 0.3 x style match + 0.2 x preference match (each 0 to 1).
"""
from .items import colour_label

W_PALETTE, W_STYLE, W_PREFERENCE = 0.5, 0.3, 0.2
PER_CATEGORY_CAP = 3
DEFAULT_LIMIT = 15


def gender_ok(item_gender, wanted):
    return not wanted or item_gender in (wanted, "unisex", "")


def style_match(item, profile):
    if not profile.styles:
        return 0.5
    return 1.0 if {s.lower() for s in item.styles} & {s.lower() for s in profile.styles} else 0.3


def preference_match(item, profile):
    label = colour_label(item).lower()
    if label in {c.lower() for c in profile.avoided_colours}:
        return 0.0
    return 1.0 if label in {c.lower() for c in profile.favourite_colours} else 0.5


def reason(item, profile, palette_score):
    colour = colour_label(item) or "This colour"
    if palette_score >= 2:
        text = f"{colour} is one of your best colours"
    elif palette_score == 1:
        text = f"{colour} works well for you"
    else:
        text = f"{colour} is a safe, neutral choice"
    if profile.undertone and palette_score >= 1:
        text += f" ({profile.undertone} undertone"
        text += f", {profile.depth.lower()} depth)" if profile.depth else ")"
    if profile.styles and style_match(item, profile) == 1.0:
        text += f". Fits your {profile.styles[0].lower()} style."
    else:
        text += "."
    return text


def rank(items, profile, palette, *, limit=DEFAULT_LIMIT):
    """Return [{"item", "score", "match", "reason", "colour"}] best first, at most `limit`, 3 per category."""
    scored = []
    for item in items:
        if not item.size_ok or not gender_ok(item.gender, profile.gender):
            continue
        palette_score = palette.score_item(item)
        if palette.known and palette_score <= -2:
            continue  # a colour to avoid is never recommended
        score = (
            W_PALETTE * palette.normalised(colour_label(item))
            + W_STYLE * style_match(item, profile)
            + W_PREFERENCE * preference_match(item, profile)
        )
        scored.append((score, item, palette_score))

    scored.sort(key=lambda row: (-row[0], -row[1].id))
    picked, per_category = [], {}
    for score, item, palette_score in scored:
        if per_category.get(item.category, 0) >= PER_CATEGORY_CAP:
            continue
        per_category[item.category] = per_category.get(item.category, 0) + 1
        picked.append({
            "item": item, "score": round(score, 3), "match": round(score * 100),
            "reason": reason(item, profile, palette_score), "colour": colour_label(item),
        })
        if len(picked) == limit:
            break
    return picked
