from django.core.management.base import BaseCommand

from catalog.models import Product

# DEMO PLACEHOLDER PRICES in rupees, one base per slot. They are not real prices and not thesis data:
# the Kaggle dataset has none, and the demo needs priced, in-stock items for the recommender to rank.
BASE_PRICE = {
    "top": 2500, "bottom": 3500, "kurta": 4500, "outerwear": 9000, "footwear": 5500, "accessory": 2500, "dupatta": 2000,
}
SIZE_STOCK = 5


class Command(BaseCommand):
    help = (
        "Activates imported Draft products with PLACEHOLDER demo prices and stock so the recommender has a "
        "catalog to rank. Only for demos: real prices and stock are set by an admin."
    )

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=None, help="Activate at most this many drafts.")

    def handle(self, *args, **options):
        drafts = Product.objects.filter(status="Draft", external_id__isnull=False).order_by("id")
        if options["limit"]:
            drafts = drafts[: options["limit"]]
        count = 0
        for product in drafts:
            base = BASE_PRICE.get(product.slot, 3000)
            product.price = base + (int(product.external_id) % 10) * 100
            product.cost_price = round(float(product.price) * 0.6)
            product.size_s_stock = product.size_m_stock = product.size_l_stock = product.size_xl_stock = SIZE_STOCK
            product.stock_quantity = SIZE_STOCK * 4
            product.status = "Active"
            product.save()
            count += 1
        self.stdout.write(self.style.SUCCESS(f"Activated {count} products with placeholder demo prices."))
