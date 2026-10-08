from catalog.engine.color import REFERENCE_COLORS
from recommender.engine.items import Item
from recommender.engine.palette import Palette

HEX = dict(REFERENCE_COLORS)
_counter = iter(range(1, 10_000))


def item(slot="top", colour="Navy Blue", *, gender="men", formality=2, styles=("Casual",), name=None,
         category=None, size_ok=True, id=None, ready=True):
    number = id if id is not None else next(_counter)
    return Item(
        id=number, name=name or f"{colour} {slot} {number}", slot=slot, gender=gender, formality=formality,
        styles=tuple(styles), color_hex=HEX[colour], color_name=colour, category=category or f"cat-{slot}", size_ok=size_ok, ready=ready,
    )


def palette(**scores):
    """Palette({"Navy Blue": 2, ...}) with underscores for spaces: palette(Navy_Blue=2)."""
    return Palette({name.replace("_", " "): score for name, score in scores.items()})
