from collections import Counter, defaultdict

from django.core.management.base import BaseCommand

from catalog.engine.families import family_of_hex, family_of_label
from catalog.models import Product


class Command(BaseCommand):
    help = (
        "Compares each imported product's extracted colour (color_hex) with the dataset's own colour label "
        "(color_name) at colour-family level. Prints agreement overall and per slot."
    )

    def handle(self, *args, **options):
        products = Product.objects.filter(external_id__isnull=False).exclude(color_hex__isnull=True)
        total = agree = skipped = 0
        by_slot = defaultdict(lambda: [0, 0])
        misses = Counter()
        for product in products:
            expected = family_of_label(product.color_name)
            if expected is None:
                skipped += 1
                continue
            found = family_of_hex(product.color_hex)
            total += 1
            agree += expected == found
            by_slot[product.slot][0] += expected == found
            by_slot[product.slot][1] += 1
            if expected != found:
                misses[(expected, found)] += 1

        if not total:
            self.stdout.write("No imported products with a comparable colour label.")
            return
        self.stdout.write(f"Family agreement: {agree}/{total} = {agree / total * 100:.1f}% ({skipped} products skipped: label not in a family)")
        for slot, (hits, count) in sorted(by_slot.items()):
            self.stdout.write(f"  {slot:<10} {hits}/{count} = {hits / count * 100:.1f}%")
        if misses:
            self.stdout.write("Most common mismatches (label -> extracted): " + ", ".join(f"{a}->{b} {n}" for (a, b), n in misses.most_common(6)))
