from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from catalog.alpha_services import import_alpha_kit
from catalog.engine.cutout import cloth_segmenter


class Command(BaseCommand):
    help = (
        "Imports the Mannequin (alpha) render kit: the base photo and one garment layer per product in "
        "manifest.csv. Layers that line up with the base are approved; the rest are listed with the reason."
    )

    def add_arguments(self, parser):
        parser.add_argument("--source", required=True, help="Kit folder with base/, renders/ and manifest.csv.")
        parser.add_argument("--gender", default="men", choices=["men", "women"])
        parser.add_argument("--rebuild", action="store_true", help="Re-cut every layer even if its render did not change.")

    def handle(self, *args, **options):
        self.stdout.write("Loading the cloth segmentation model (u2net_cloth_seg)...")
        segment = cloth_segmenter(model_dir=settings.ML_MODELS_DIR / "rembg")
        try:
            result = import_alpha_kit(
                source_dir=options["source"], gender=options["gender"], segment=segment, rebuild=options["rebuild"],
            )
        except FileNotFoundError as exc:
            raise CommandError(str(exc)) from exc

        if result.base_created:
            self.stdout.write(self.style.SUCCESS(f"Created the {options['gender']} base."))
        elif result.base_changed:
            self.stdout.write(self.style.WARNING("The base photo changed: every layer was re-cut."))

        self.stdout.write(f"{'code':<6}{'slot':<8}{'outcome':<11}{'ecc':>7}{'shift':>8}{'keep':>8}  note")
        for row in result.rows:
            report = row.report or {}
            ecc = report.get("ecc")
            shift = max(abs(report.get("shift_x", 0)), abs(report.get("shift_y", 0))) if report else None
            keep = report.get("keep_change")
            line = (
                f"{row.code:<6}{row.slot:<8}{row.outcome:<11}"
                f"{'' if ecc is None else f'{ecc:.3f}':>7}"
                f"{'' if shift is None else f'{shift:.1f}px':>8}"
                f"{'' if keep is None else f'{keep:.2%}':>8}  {row.reason}"
            )
            style = {"approved": self.style.SUCCESS, "rejected": self.style.ERROR, "skipped": self.style.WARNING}
            self.stdout.write(style.get(row.outcome, str)(line))
        self.stdout.write(
            f"Approved {result.count('approved')}, unchanged {result.count('unchanged')}, "
            f"rejected {result.count('rejected')}, skipped {result.count('skipped')}."
        )
