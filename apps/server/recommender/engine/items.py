"""The plain data the recommender works on. No Django imports, so the engine tests need no database."""
from dataclasses import dataclass

from catalog.engine.color import REFERENCE_COLORS, nearest_color

COLOUR_HEX = dict(REFERENCE_COLORS)
ACCESSORY_KINDS = {  # keyword in the product name -> kind
    "tie": "tie", "watch": "watch", "belt": "belt", "cap": "cap", "sunglass": "sunglasses",
}


@dataclass(frozen=True)
class Item:
    id: int
    name: str
    slot: str
    gender: str          # men | women | unisex | ""
    formality: int       # 1 to 5, or 0 when unknown
    styles: tuple        # style tags such as ("Casual",)
    color_hex: str       # "" when unknown
    color_name: str
    category: str
    size_ok: bool = True  # in stock in the shopper's size


@dataclass(frozen=True)
class Profile:
    """What the recommender knows about the shopper. Every field is optional."""
    depth: str = ""
    undertone: str = ""
    gender: str = ""      # men | women | ""
    styles: tuple = ()    # preferred styles, empty when "mixed" or unknown
    favourite_colours: tuple = ()
    avoided_colours: tuple = ()


def accessory_kind(item):
    """tie, watch, belt, cap or sunglasses, guessed from the product name; "" when it is none of them."""
    name = item.name.lower()
    return next((kind for word, kind in ACCESSORY_KINDS.items() if word in name), "")


def colour_label(item):
    """Our reference name for an item's colour: from its pixels when known, else its own colour name."""
    if item.color_hex:
        return nearest_color(item.color_hex)[0]
    return item.color_name or ""
