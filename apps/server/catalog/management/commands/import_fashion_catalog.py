import csv
from collections import Counter
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from PIL import Image

from catalog.engine.cutout import rembg_remover
from catalog.engine.kaggle import ARTICLE_SLOT, classify_all, find_image, read_styles, select_records
from catalog.models import Product
from catalog.services import import_style_record


class Command(BaseCommand):
    help = (
        "Imports a balanced sample of the Kaggle Fashion Product Images dataset as Draft products, "
        "with backgrounds removed and colours extracted. Needs the full-resolution images, not the Small set."
    )

    def add_arguments(self, parser):
        parser.add_argument("--source", required=True, help="Folder with styles.csv and images/ from the Kaggle download.")
        parser.add_argument("--limit", type=int, default=150, help="How many products to import (default 150).")
        parser.add_argument("--seed", type=int, default=42, help="Selection seed. The same seed picks the same products.")
        parser.add_argument(
            "--ids", default="",
            help="Comma-separated Kaggle ids to import instead of a sample, e.g. 20024,33065.",
        )
        parser.add_argument(
            "--ids-from", default="",
            help="A CSV with an external_id column (the mannequin kit's manifest.csv): import exactly those ids.",
        )
        parser.add_argument(
            "--list-article-types", action="store_true",
            help="Print the article types in styles.csv with their counts, then exit.",
        )

    def handle(self, *args, **options):
        source = Path(options["source"])
        try:
            rows, malformed = read_styles(source / "styles.csv")
        except (OSError, ValueError) as exc:
            raise CommandError(str(exc)) from exc

        if options["list_article_types"]:
            self._list_article_types(rows)
            return
        if options["limit"] < 1:
            raise CommandError("--limit must be at least 1")

        records, skipped = classify_all(rows)
        with_images = [record for record in records if find_image(source, record.image_id)]
        skipped_no_image = len(records) - len(with_images)
        wanted = self._wanted_ids(options)
        if wanted:
            # Only the listed products (the demo set): the rest of the 44k-row dataset is never touched.
            selected = [record for record in with_images if record.image_id in wanted]
            missing = sorted(wanted - {record.image_id for record in selected})
            if missing:
                self.stderr.write(self.style.WARNING(
                    f"{len(missing)} listed id(s) not importable (not in styles.csv, unmapped article type, "
                    f"or no image file): {', '.join(missing)}"
                ))
        else:
            selected = select_records(with_images, limit=options["limit"], seed=options["seed"])

        existing = set(
            Product.objects.filter(external_id__in=[record.image_id for record in selected])
            .values_list("external_id", flat=True)
        )
        todo = [record for record in selected if record.image_id not in existing]

        created, failed = [], []
        if todo:
            remover = rembg_remover(model_dir=settings.ML_MODELS_DIR / "rembg")
            for record in todo:
                try:
                    with Image.open(find_image(source, record.image_id)) as image:
                        image.load()
                        created.append(import_style_record(record=record, source_image=image, remover=remover))
                except Exception as exc:  # one unreadable photo should not stop the run
                    failed.append((record.image_id, f"{type(exc).__name__}: {exc}"))

        self._report(
            selected=len(selected), created=created, already_imported=len(selected) - len(todo),
            failed=failed, malformed=malformed, skipped=skipped, skipped_no_image=skipped_no_image,
        )

    def _wanted_ids(self, options):
        wanted = {item.strip() for item in options["ids"].split(",") if item.strip()}
        if options["ids_from"]:
            path = Path(options["ids_from"])
            try:
                with path.open(newline="", encoding="utf-8-sig") as handle:
                    wanted |= {(row.get("external_id") or "").strip() for row in csv.DictReader(handle)}
            except OSError as exc:
                raise CommandError(str(exc)) from exc
            wanted.discard("")
            if not wanted:
                raise CommandError(f"{path} has no external_id values")
        return wanted

    def _list_article_types(self, rows):
        counts = Counter(row["articleType"] for row in rows)
        self.stdout.write(f"{len(counts)} article types in styles.csv:")
        for article, count in counts.most_common():
            status = "mapped" if article in ARTICLE_SLOT else "not mapped"
            self.stdout.write(f"  {count:>6}  {article} ({status})")

    def _report(self, *, selected, created, already_imported, failed, malformed, skipped, skipped_no_image):
        self.stdout.write(f"Selected {selected} products. Malformed CSV rows skipped: {malformed}.")
        self.stdout.write(self.style.SUCCESS(f"Created {len(created)} draft products."))
        self.stdout.write(f"Already imported (left unchanged): {already_imported}.")
        if created:
            by_slot = Counter(product.slot for product in created)
            self.stdout.write("Created by slot: " + ", ".join(f"{slot} {n}" for slot, n in by_slot.most_common()))
        if failed:
            self.stderr.write(self.style.ERROR(f"Failed {len(failed)}:"))
            for image_id, reason in failed:
                self.stderr.write(f"  {image_id}: {reason}")
        self.stdout.write(
            f"Not selectable: {skipped_no_image} without an image file; "
            + (", ".join(f"{reason} {n}" for reason, n in skipped.most_common()) or "none")
            + "."
        )
