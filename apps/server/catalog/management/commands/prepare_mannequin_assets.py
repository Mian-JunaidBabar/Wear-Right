from collections import Counter

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import close_old_connections, connection
from PIL import Image

from catalog.engine.cutout import cloth_remover
from catalog.models import Product
from catalog.services import prepare_mannequin_asset
from scanner.services import ScannerUnavailable, get_detector


class Command(BaseCommand):
    help = (
        "For every product with a cut-out: saves a garment-only crop for the mannequin and flags photos that show "
        "a person; for apparel it then cuts the garment out of the model photo with rembg's cloth model. "
        "Uses the real MediaPipe and rembg models (make models)."
    )

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Redo products that already have a mannequin image.")

    def handle(self, *args, **options):
        try:
            detector = get_detector()
        except ScannerUnavailable as exc:
            self.stderr.write(f"{exc} Continuing with the skin check only.")
            detector = None
        cloth = cloth_remover(model_dir=settings.ML_MODELS_DIR / "rembg")  # cuts garments out of model photos
        products = Product.objects.exclude(image="").exclude(image__isnull=True)
        if not options["force"]:
            products = products.filter(mannequin_image="") | products.filter(mannequin_image__isnull=True)
        done, failed, notes = 0, [], Counter()
        for product in list(products.distinct()):
            if not connection.in_atomic_block:  # inside a transaction (tests) the connection must stay open
                close_old_connections()  # a long run can outlive an idle database connection
            try:
                with Image.open(product.image.path) as image:
                    image.load()
                    prepare_mannequin_asset(product, source_image=image, detector=detector, cloth=cloth)
                notes[product.mannequin_note or "ready"] += 1
                done += 1
            except Exception as exc:  # keep going; report at the end
                failed.append((product.pk, f"{type(exc).__name__}: {exc}"))
        self.stdout.write(self.style.SUCCESS(f"Prepared {done} products: " + ", ".join(f"{n} {note}" for note, n in notes.most_common())))
        for product_id, reason in failed:
            self.stderr.write(self.style.ERROR(f"Failed product {product_id}: {reason}"))
