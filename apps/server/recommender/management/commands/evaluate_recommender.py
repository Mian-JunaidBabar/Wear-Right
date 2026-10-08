from collections import Counter

from django.core.management.base import BaseCommand

from recommender.engine.default_rules import DEPTHS, UNDERTONES
from recommender.selectors import get_shoppable_products
from recommender.services import build_look, top_picks


def _jaccard(a, b):
    return len(a & b) / len(a | b) if a | b else 0.0


class Command(BaseCommand):
    help = (
        "Coverage report on the live catalog: how personal the top picks are across depth and undertone, "
        "and how often a look can be completed around each product. It measures coverage, not taste."
    )

    def handle(self, *args, **options):
        products = list(get_shoppable_products())
        if not products:
            self.stdout.write("No active, in-stock products. Run `make demo-catalog` (demo only) or price some drafts in the admin.")
            return
        self.stdout.write(f"Shoppable catalog: {len(products)} products. By slot: "
                          + ", ".join(f"{slot or 'untagged'} {n}" for slot, n in Counter(p.slot for p in products).most_common()))
        self._top_picks()
        self._looks(products)

    def _top_picks(self):
        self.stdout.write("\nTop picks (men, no style preference): items returned and how many are in the shopper's best colours")
        picks = {}
        for depth in DEPTHS:
            for undertone in UNDERTONES:
                _, palette, results = top_picks(None, {"depth": depth, "undertone": undertone, "gender": "men"})
                picks[(depth, undertone)] = {row["item"].id for row in results}
                best = sum(1 for row in results if "best colours" in row["reason"])
                self.stdout.write(f"  {depth:<6} {undertone:<8} {len(results):>2} items, {best:>2} in best colours")
        for depth in DEPTHS:
            self.stdout.write(
                f"  {depth} overlap warm vs cool: {_jaccard(picks[(depth, 'warm')], picks[(depth, 'cool')]):.0%}"
                f", fair vs dark (warm): {_jaccard(picks[('Fair', 'warm')], picks[('Dark', 'warm')]):.0%}" if depth == "Fair" else
                f"  {depth} overlap warm vs cool: {_jaccard(picks[(depth, 'warm')], picks[(depth, 'cool')]):.0%}"
            )

    def _looks(self, products):
        self.stdout.write("\nComplete the look (profile: Medium, warm), one look around every shoppable product")
        by_type, missing, filled = {}, Counter(), []
        for product in products:
            _, _, look = build_look(None, {"depth": "Medium", "undertone": "warm"}, product)
            stats = by_type.setdefault(look["look_type"], [0, 0])
            stats[1] += 1
            stats[0] += look["complete"]
            missing.update(look["missing"])
            slots = [s for s in look["slots"] if s["required"]]
            filled.append(sum(1 for s in slots if s["pick"]) / len(slots) if slots else 1)
        for kind, (done, total) in sorted(by_type.items()):
            self.stdout.write(f"  {kind:<14} {done}/{total} looks complete ({done / total:.0%})")
        self.stdout.write(f"  required slots filled on average: {sum(filled) / len(filled):.0%}")
        if missing:
            self.stdout.write("  most often missing: " + ", ".join(f"{slot} {n}" for slot, n in missing.most_common(5)))
