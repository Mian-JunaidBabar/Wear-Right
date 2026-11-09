from django.core.management.base import BaseCommand

from catalog.alpha_services import publish_demo_products


class Command(BaseCommand):
    help = (
        "Makes every product that is on the mannequin buyable for the demo: Active, with a demo price and "
        "stock when it has none. Pair with SHOP_MANNEQUIN_ONLY=1 so the shop lists only these products."
    )

    def handle(self, *args, **options):
        products = publish_demo_products()
        for product in products:
            self.stdout.write(f"  {product.id:>5}  {product.name[:50]:<50}  Rs {product.price}  stock {product.stock_quantity}")
        self.stdout.write(self.style.SUCCESS(f"Published {len(products)} mannequin products."))
