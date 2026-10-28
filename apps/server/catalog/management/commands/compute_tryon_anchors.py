from django.core.management.base import BaseCommand
from PIL import Image

from catalog.engine.kinds import infer_kind
from catalog.engine.tryon_anchors import compute_tryon_anchors
from catalog.models import Product


class Command(BaseCommand):
    help = "Computes AR try-on anchor dots for every product that already has a cut-out. Idempotent."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Recompute products that already have anchors.")

    def handle(self, *args, **options):
        products = Product.objects.exclude(mannequin_image="").exclude(mannequin_image__isnull=True)
        if not options["force"]:
            products = products.filter(tryon_anchors={})
        ready, skipped, failed = 0, 0, []
        for product in products.iterator():
            kind = product.kind or infer_kind(
                product.name, product.category, product.garment_type or '', product.slot or '',
            )
            try:
                with Image.open(product.mannequin_image.path) as image:
                    image.load()
                    anchors = compute_tryon_anchors(image, kind)
            except Exception as exc:  # keep going; one bad file must not stop the batch
                failed.append((product.pk, f"{type(exc).__name__}: {exc}"))
                continue
            if not anchors:
                Product.objects.filter(pk=product.pk).update(tryon_ready=False, tryon_anchors={})
                skipped += 1
                continue
            Product.objects.filter(pk=product.pk).update(tryon_ready=bool(product.mannequin_ready), tryon_anchors=anchors)
            ready += 1
        self.stdout.write(self.style.SUCCESS(f"AR anchors: {ready} ready, {skipped} without anchors"))
        for product_id, reason in failed:
            self.stderr.write(self.style.ERROR(f"Failed product {product_id}: {reason}"))
