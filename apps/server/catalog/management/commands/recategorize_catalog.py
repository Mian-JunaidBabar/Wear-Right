from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from catalog.engine.kaggle import category_for, read_styles
from catalog.models import Category, Product


class Command(BaseCommand):
    help = (
        "Moves imported products into the finest category that fits (watches, belts, women's shalwar, waistcoats...) "
        "using the article type in styles.csv. Hand-made products are not touched."
    )

    def add_arguments(self, parser):
        parser.add_argument("--source", required=True, help="Folder with the Kaggle styles.csv.")

    def handle(self, *args, **options):
        try:
            rows, _ = read_styles(Path(options["source"]) / "styles.csv")
        except (OSError, ValueError) as exc:
            raise CommandError(str(exc)) from exc
        articles = {row["id"].strip(): row["articleType"] for row in rows}
        known = set(Category.objects.values_list("name", flat=True))
        changed, unknown = 0, 0
        for product in Product.objects.filter(external_id__isnull=False):
            target = category_for(product.gender, product.slot, articles.get(product.external_id, ""))
            if target is None or target == product.category:
                continue
            if target not in known:
                unknown += 1
                continue
            product.category = target
            product.save(update_fields=["category", "updated_at"])
            changed += 1
        self.stdout.write(self.style.SUCCESS(f"Recategorised {changed} products." + (f" {unknown} skipped: category missing, run seed_taxonomy." if unknown else "")))
