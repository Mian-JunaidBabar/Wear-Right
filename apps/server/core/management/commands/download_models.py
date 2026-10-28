import hashlib
import shutil
import urllib.request

from django.conf import settings
from django.core.management.base import BaseCommand

from catalog.engine.cutout import CLOTH_MODEL, DEFAULT_MODEL, rembg_remover

# Google's published MediaPipe Face Landmarker bundle, and a portrait Google ships as a MediaPipe test asset.
FILES = {
    "face_landmarker.task": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    "test_assets/portrait.jpg": "https://storage.googleapis.com/mediapipe-assets/portrait.jpg",
}

# AR try-on runs pose tracking in the browser, so these files are served by Next.js, not Django.
POSE_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
POSE_ASSET_DIR = settings.BASE_DIR.parent / "web" / "public" / "mediapipe"
POSE_WASM_SOURCE = settings.BASE_DIR.parent / "web" / "node_modules" / "@mediapipe" / "tasks-vision" / "wasm"


def download_pose_assets():
    """Copy tasks-vision wasm from the installed package and fetch the lite pose model.

    The files are gitignored: they are build assets, a few MB, and `make models` is the one
    documented way to fetch them. Loading them locally keeps the demo working without a CDN.
    """
    wasm_target = POSE_ASSET_DIR / "wasm"
    if not POSE_WASM_SOURCE.exists():
        raise FileNotFoundError(
            f"{POSE_WASM_SOURCE} is missing. Run `npm --prefix apps/web install` before `make models`."
        )
    wasm_target.mkdir(parents=True, exist_ok=True)
    for source in POSE_WASM_SOURCE.iterdir():
        if source.is_file():
            shutil.copy2(source, wasm_target / source.name)
    target = POSE_ASSET_DIR / "pose_landmarker_lite.task"
    if target.exists():
        return target, [wasm_target]
    target.parent.mkdir(parents=True, exist_ok=True)
    part = target.with_suffix(target.suffix + ".part")
    urllib.request.urlretrieve(POSE_MODEL_URL, part)
    part.rename(target)
    return target, [wasm_target]


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

        pose, wasm_dirs = download_pose_assets()
        self.stdout.write(self.style.SUCCESS(
            f"got   web/public/mediapipe/{pose.name} ({pose.stat().st_size} bytes) + wasm in {wasm_dirs[0]}"
        ))
        self.stdout.write(f"Default rembg model: {DEFAULT_MODEL}")
