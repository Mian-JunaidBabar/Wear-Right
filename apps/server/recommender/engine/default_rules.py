"""Starting tone-to-colour rules: (depth, undertone, colour, score) with score +2 best, +1 good, -2 avoid.

These are colour-theory starting points, not measurements. They are stored in the database
(ToneColorRule) so an admin can edit them; this module only builds the first set. Colour names are
the ones in catalog.engine.color.REFERENCE_COLORS, because product colours are named with that list.
"""
DEPTHS = ("Fair", "Medium", "Dark")
UNDERTONES = ("warm", "cool", "neutral")

BEST, GOOD, AVOID = 2, 1, -2

UNDERTONE_COLOURS = {
    "warm": {
        BEST: ["Olive Green", "Mustard Yellow", "Rust Orange", "Camel", "Coral", "Peach", "Teal", "Cream", "Khaki"],
        GOOD: ["Brown", "Tan", "Beige", "Orange", "Bottle Green", "Turquoise", "Off-White", "Dark Brown", "Maroon"],
        AVOID: ["Soft Lavender", "Pastel Pink", "Hot Pink", "Light Grey"],
    },
    "cool": {
        BEST: ["Royal Blue", "Navy Blue", "Burgundy", "Wine Red", "Emerald Green", "Deep Purple", "Soft Lavender",
               "Sky Blue", "Charcoal Grey"],
        GOOD: ["White", "Grey", "Light Grey", "Pastel Pink", "Teal", "Denim Blue", "Black", "Turquoise", "Bottle Green"],
        AVOID: ["Mustard Yellow", "Rust Orange", "Orange", "Camel", "Khaki", "Yellow"],
    },
    "neutral": {
        BEST: ["Navy Blue", "Teal", "Burgundy", "Emerald Green", "Charcoal Grey", "Denim Blue"],
        GOOD: ["White", "Black", "Grey", "Beige", "Brown", "Wine Red", "Royal Blue", "Sky Blue", "Maroon",
               "Bottle Green", "Coral", "Camel", "Olive Green"],
        AVOID: ["Yellow"],
    },
}

DEPTH_COLOURS = {
    "Fair": {
        BEST: ["Navy Blue", "Burgundy", "Emerald Green", "Charcoal Grey", "Sky Blue", "Soft Lavender", "Pastel Pink", "Wine Red",
               "Teal", "Olive Green", "Coral", "Peach"],  # the last four keep warm-undertone fair skin well served
        GOOD: ["Royal Blue", "Deep Purple", "Bottle Green", "Denim Blue", "Light Grey", "Black", "Maroon"],
        AVOID: ["Yellow", "Orange", "Off-White"],
    },
    "Medium": {
        BEST: ["Olive Green", "Teal", "Mustard Yellow", "Rust Orange", "Coral", "Denim Blue", "Burgundy", "Royal Blue",
               "Emerald Green"],
        GOOD: ["Navy Blue", "Camel", "Khaki", "Peach", "Turquoise", "Off-White", "White", "Wine Red", "Bottle Green"],
        AVOID: ["Light Grey", "Pastel Pink"],
    },
    "Dark": {
        BEST: ["White", "Bright Red", "Royal Blue", "Yellow", "Hot Pink", "Orange", "Emerald Green", "Turquoise", "Cream", "Coral"],
        GOOD: ["Sky Blue", "Mustard Yellow", "Teal", "Soft Lavender", "Camel", "Peach", "Off-White", "Beige", "Burgundy"],
        AVOID: ["Dark Brown", "Charcoal Grey", "Brown"],
    },
}


def _points(table, colour):
    return next((points for points, names in table.items() if colour in names), 0)


def combined_score(depth, undertone, colour):
    """Depth and undertone each vote best (2), good (1) or avoid (-2); the sum is mapped to +2, +1, 0 or -2."""
    total = _points(DEPTH_COLOURS[depth], colour) + _points(UNDERTONE_COLOURS[undertone], colour)
    if total >= 3:
        return BEST
    if total >= 1:
        return GOOD
    return AVOID if total <= -2 else 0


def build_default_rules(colour_names):
    """All (depth, undertone, colour, score) rows with a non-zero score."""
    rules = []
    for depth in DEPTHS:
        for undertone in UNDERTONES:
            for colour in colour_names:
                score = combined_score(depth, undertone, colour)
                if score:
                    rules.append((depth, undertone, colour, score))
    return rules
