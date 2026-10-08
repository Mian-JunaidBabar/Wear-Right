from django.conf import settings
from django.core.management.base import BaseCommand
from PIL import Image

from catalog.engine.cutout import rembg_remover
from catalog.models import Product
from catalog.services import apply_image_pipeline


class Command(BaseCommand):
    help = "Removes the background and extracts colours for products that have a photo but no colour yet."

    def handle(self, *args, **options):
        products = list(
            Product.objects.filter(color_hex__isnull=True).exclude(image__isnull=True).exclude(image="")
        )
        if not products:
            self.stdout.write("Nothing to do: every product with a photo already has a colour.")
            return

        remover = rembg_remover(model_dir=settings.ML_MODELS_DIR / "rembg")
        done, failed = 0, []
        for product in products:
            try:
                with Image.open(product.image.path) as image:
                    image.load()
                    apply_image_pipeline(product, source_image=image, remover=remover)
                done += 1
            except Exception as exc:  # keep going; report at the end
                failed.append((product.pk, f"{type(exc).__name__}: {exc}"))

        self.stdout.write(self.style.SUCCESS(f"Processed {done} product photos."))
        for product_id, reason in failed:
            self.stderr.write(self.style.ERROR(f"Failed product {product_id}: {reason}"))
