from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from catalog.alpha_services import import_alpha_kit
from catalog.engine.cutout import cloth_segmenter


class Command(BaseCommand):
    help = (
        "Imports the Mannequin (alpha) render kit: the base photo(s) and one garment layer per product in "
        "manifest.csv, with fair / dark skin copies when the kit has them. Layers that line up with the base "
        "are approved; the rest are listed with the reason."
    )

    def add_arguments(self, parser):
        parser.add_argument("--source", required=True, help="Kit folder with base/, renders/ and manifest.csv.")
        parser.add_argument("--gender", default="all", choices=["men", "women", "all"])
        parser.add_argument("--rebuild", action="store_true", help="Re-cut every layer even if its render did not change.")

    def handle(self, *args, **options):
        self.stdout.write("Loading the cloth segmentation model (u2net_cloth_seg)...")
        segment = cloth_segmenter(model_dir=settings.ML_MODELS_DIR / "rembg")
        genders = ["men", "women"] if options["gender"] == "all" else [options["gender"]]
        for gender in genders:
            try:
                result = import_alpha_kit(source_dir=options["source"], gender=gender, segment=segment, rebuild=options["rebuild"])
            except FileNotFoundError as exc:
                if options["gender"] == "all" and "base photo" in str(exc):
                    self.stdout.write(self.style.WARNING(f"Skipping {gender}: {exc}"))
                    continue
                raise CommandError(str(exc)) from exc
            self._report(gender, result)

    def _report(self, gender, result):
        self.stdout.write(self.style.MIGRATE_HEADING(f"\n== {gender} =="))
        if result.base_created:
            self.stdout.write(self.style.SUCCESS(f"Created the {gender} base."))
        elif result.base_changed:
            self.stdout.write(self.style.WARNING("The base photo changed: every layer was re-cut."))
        for warning in result.warnings:
            self.stdout.write(self.style.WARNING(f"  file: {warning}"))

        self.stdout.write(f"{'code':<6}{'slot':<11}{'outcome':<11}{'ecc':>7}{'shift':>8}{'keep':>8}  {'fair':<6}{'dark':<6} note")
        style = {"approved": self.style.SUCCESS, "rejected": self.style.ERROR, "skipped": self.style.WARNING}
        for row in result.rows:
            report = row.report or {}
            ecc = report.get("ecc")
            shift = max(abs(report.get("shift_x", 0)), abs(report.get("shift_y", 0))) if report else None
            keep = report.get("keep_change")
            skins = {skin: self._skin(row.skins.get(skin)) for skin in ("fair", "dark")}
            notes = [row.reason] + [f"{skin}: {text}" for skin, text in row.skins.items() if text not in ("ok", "missing", None)]
            line = (
                f"{row.code:<6}{row.slot:<11}{row.outcome:<11}"
                f"{'' if ecc is None else f'{ecc:.3f}':>7}"
                f"{'' if shift is None else f'{shift:.1f}px':>8}"
                f"{'' if keep is None else f'{keep:.2%}':>8}  {skins['fair']:<6}{skins['dark']:<6} "
                + "; ".join(note for note in notes if note)
            )
            self.stdout.write(style.get(row.outcome, str)(line))
        self.stdout.write(
            f"Approved {result.count('approved')}, unchanged {result.count('unchanged')}, "
            f"rejected {result.count('rejected')}, skipped {result.count('skipped')}."
        )
        self.stdout.write("Skin bases: " + ", ".join(f"{skin} {state}" for skin, state in result.base_skins.items()))

    @staticmethod
    def _skin(state):
        return {"ok": "yes", "missing": "-", None: "-"}.get(state, "no")
