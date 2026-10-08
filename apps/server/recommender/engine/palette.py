"""Which colours suit a shopper: scores from the tone rules, and the best / avoid lists. Pure Python."""
from .items import COLOUR_HEX, colour_label


class Palette:
    """Wraps {colour name: score} rules for one depth and undertone (score +2 best, +1 good, -2 avoid)."""

    def __init__(self, rules=None):
        self.rules = {name.lower(): score for name, score in (rules or {}).items()}
        self.known = bool(self.rules)

    def score(self, colour_name):
        return self.rules.get((colour_name or "").lower(), 0)

    def normalised(self, colour_name):
        """0 (avoid) to 1 (best); an unknown shopper or colour sits in the middle at 0.5."""
        if not self.known:
            return 0.5
        return (self.score(colour_name) + 2) / 4

    def score_item(self, item):
        return self.score(colour_label(item))

    def best(self, limit=8):
        return self._named(2, limit) + self._named(1, max(0, limit - len(self._named(2, limit))))

    def avoid(self, limit=3):
        return self._named(-2, limit)

    def _named(self, score, limit):
        names = [name for name, value in self.rules.items() if value == score]
        order = {name.lower(): index for index, name in enumerate(COLOUR_HEX)}
        return [self._entry(name) for name in sorted(names, key=lambda n: order.get(n, 99))[:limit]]

    @staticmethod
    def _entry(lower_name):
        name = next((n for n in COLOUR_HEX if n.lower() == lower_name), lower_name)
        return {"name": name, "hex": COLOUR_HEX.get(name)}
