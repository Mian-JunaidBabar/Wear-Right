from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from catalog.models import Product

IMAGE_FIELDS = ("image", "back_image", "mannequin_image")


class Command(BaseCommand):
    help = (
        "Reports every product photo whose file is missing on disk. --fix clears the dead "
        "references so the shop shows its placeholder instead of a broken image."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--fix",
            action="store_true",
            help="Clear image fields whose file is missing (cut-outs also lose mannequin_ready).",
        )

    def handle(self, *args, **options):
        media_root = Path(settings.MEDIA_ROOT)
        missing = []
        for product in Product.objects.all().iterator():
            for field in IMAGE_FIELDS:
                name = getattr(product, field).name
                if name and not (media_root / name).exists():
                    missing.append((product, field, name))

        if not missing:
            self.stdout.write("Every product photo exists on disk.")
            return

        for product, field, name in missing:
            self.stdout.write(f'product {product.pk} "{product.name}" {field}: {name}')

        summary = ", ".join(
            f"{field}={sum(1 for _, f, _ in missing if f == field)}"
            for field in IMAGE_FIELDS
            if any(f == field for _, f, _ in missing)
        )
        self.stdout.write(self.style.WARNING(f"{len(missing)} missing media files ({summary})."))

        if not options["fix"]:
            self.stdout.write("Run again with --fix to clear these references.")
            return

        cleared = 0
        for product, field, _ in missing:
            setattr(product, field, "")
            update_fields = [field]
            if field == "mannequin_image":
                product.mannequin_ready = False
                update_fields.append("mannequin_ready")
            product.save(update_fields=update_fields)
            cleared += 1
        self.stdout.write(self.style.SUCCESS(f"Cleared {cleared} dead references."))
