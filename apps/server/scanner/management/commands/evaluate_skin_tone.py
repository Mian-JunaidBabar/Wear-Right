from pathlib import Path

import cv2
from django.core.management.base import BaseCommand, CommandError

from scanner.engine.evaluation import evaluate, image_path, load_labels, to_markdown
from scanner.engine.pipeline import analyze_frame
from scanner.services import ScannerUnavailable, get_detector


class Command(BaseCommand):
    help = (
        "Runs the skin tone pipeline on labelled photos and prints accuracy, a depth confusion matrix, "
        "results per lighting group and confidence per depth. Needs labels.csv (file, depth, monk, undertone, lighting)."
    )

    def add_arguments(self, parser):
        parser.add_argument("--dir", required=True, help="Folder with the photos and labels.csv.")
        parser.add_argument("--labels", help="Labels file (default: labels.csv inside --dir).")
        parser.add_argument("--white-balance", choices=["off", "on", "both"], default="off",
                            help="Balance colour from the background before measuring. 'both' prints a report for each.")
        parser.add_argument("--out", help="Also write the report to this markdown file.")

    def handle(self, *args, **options):
        directory = Path(options["dir"])
        try:
            rows = load_labels(options["labels"] or directory / "labels.csv")
            detector = get_detector()
        except (OSError, ValueError, ScannerUnavailable) as exc:
            raise CommandError(str(exc)) from exc
        if not rows:
            raise CommandError("The labels file has no rows.")

        settings_to_run = {"off": [False], "on": [True], "both": [False, True]}[options["white_balance"]]
        reports = []
        for white_balance in settings_to_run:
            def analyze(row, white_balance=white_balance):
                image = cv2.imread(str(image_path(directory, row)))
                return analyze_frame(image, detector, white_balance=white_balance)

            title = f"Skin tone evaluation (background white balance {'on' if white_balance else 'off'})"
            reports.append(to_markdown(evaluate(rows, analyze), title=title))
        text = "\n\n".join(reports)
        self.stdout.write(text)
        if options["out"]:
            Path(options["out"]).write_text(text, encoding="utf-8")
            self.stdout.write(self.style.SUCCESS(f"Wrote {options['out']}"))
