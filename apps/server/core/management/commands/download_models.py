import hashlib
import urllib.request

from django.conf import settings
from django.core.management.base import BaseCommand

from catalog.engine.cutout import CLOTH_MODEL, DEFAULT_MODEL, rembg_remover

# Google's published MediaPipe Face Landmarker bundle, and a portrait Google ships as a MediaPipe test asset.
FILES = {
    "face_landmarker.task": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    "test_assets/portrait.jpg": "https://storage.googleapis.com/mediapipe-assets/portrait.jpg",
}


class Command(BaseCommand):
    help = "Downloads the AI model weights (rembg, MediaPipe Face Landmarker) into ML_MODELS_DIR. Skips files already there."

    def handle(self, *args, **options):
        root = settings.ML_MODELS_DIR
        for name, url in FILES.items():
            target = root / name
            if target.exists():
                self.stdout.write(f"have  {name} ({target.stat().st_size} bytes)")
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            part = target.with_suffix(target.suffix + ".part")
            urllib.request.urlretrieve(url, part)
            part.rename(target)
            self.stdout.write(self.style.SUCCESS(f"got   {name} ({target.stat().st_size} bytes)"))

        rembg_dir = root / "rembg"
        rembg_remover(model_dir=rembg_dir)  # downloads the weights if missing
        rembg_remover(CLOTH_MODEL, rembg_dir)  # garment segmentation for model photos (phase 5)
        for weights in sorted(rembg_dir.glob("*.onnx")):
            self.stdout.write(f"have  rembg/{weights.name} ({weights.stat().st_size} bytes)")
        for path in sorted(root.rglob("*")):
            if path.is_file() and path.suffix in {".task", ".onnx"}:
                digest = hashlib.sha256(path.read_bytes()).hexdigest()[:16]
                self.stdout.write(f"sha256 {path.relative_to(root)} {digest}")
        self.stdout.write(f"Default rembg model: {DEFAULT_MODEL}")
