"""Coarse colour families, used to compare an extracted colour with a dataset's colour label. Pure Python.

An extracted colour is placed in a family through its nearest named reference colour, so the comparison
uses the same perceptual distance as the colour names and adds no thresholds of its own.
"""
from .color import nearest_color

# Kaggle baseColour label (lower case) -> family. Labels not listed are left out of the comparison.
LABEL_FAMILY = {
    "black": "black", "charcoal": "black",
    "white": "white", "off white": "white", "cream": "white",
    "grey": "grey", "silver": "grey", "steel": "grey", "grey melange": "grey",
    "brown": "brown", "coffee brown": "brown", "tan": "brown", "beige": "brown", "khaki": "brown", "taupe": "brown",
    "nude": "brown", "skin": "brown", "bronze": "brown", "copper": "brown", "rust": "brown", "mushroom brown": "brown",
    "navy blue": "blue", "blue": "blue", "teal": "blue", "turquoise blue": "blue",
    "green": "green", "olive": "green", "lime green": "green", "sea green": "green", "fluorescent green": "green",
    "red": "red", "maroon": "red", "burgundy": "red",
    "pink": "pink/purple", "magenta": "pink/purple", "rose": "pink/purple", "peach": "pink/purple",
    "mauve": "pink/purple", "lavender": "pink/purple", "purple": "pink/purple",
    "yellow": "yellow/orange", "orange": "yellow/orange", "gold": "yellow/orange", "mustard": "yellow/orange",
}


def family_of_label(label):
    return LABEL_FAMILY.get((label or "").strip().lower())


# Family of each reference colour in catalog.engine.color.REFERENCE_COLORS (charcoal counts as black, as the labels do).
REFERENCE_FAMILY = {
    "White": "white", "Off-White": "white", "Cream": "white",
    "Beige": "brown", "Khaki": "brown", "Camel": "brown", "Tan": "brown", "Brown": "brown", "Dark Brown": "brown",
    "Rust Orange": "brown",
    "Peach": "pink/purple", "Pastel Pink": "pink/purple", "Hot Pink": "pink/purple",
    "Soft Lavender": "pink/purple", "Deep Purple": "pink/purple",
    "Mustard Yellow": "yellow/orange", "Yellow": "yellow/orange", "Orange": "yellow/orange", "Coral": "yellow/orange",
    "Bright Red": "red", "Maroon": "red", "Burgundy": "red", "Wine Red": "red",
    "Royal Blue": "blue", "Sky Blue": "blue", "Denim Blue": "blue", "Navy Blue": "blue", "Teal": "blue", "Turquoise": "blue",
    "Emerald Green": "green", "Bottle Green": "green", "Olive Green": "green",
    "Light Grey": "grey", "Grey": "grey",
    "Charcoal Grey": "black", "Black": "black",
}


def family_of_hex(hex_value):
    """Family of a #rrggbb colour: the family of its nearest reference colour (CIEDE2000). No extra thresholds."""
    return REFERENCE_FAMILY[nearest_color(hex_value)[0]]
