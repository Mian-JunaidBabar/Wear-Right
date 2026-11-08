"""Mannequin (alpha) writes: import the team's render kit into bases and garment layers.

The kit folder (extras/mannequin-alpha-kit, see its GUIDE.md) holds:
  base/<gender>.png              the fixed model photo (wheatish skin)
  base/<gender>-fair.png         optional: the same photo with fair skin (made by hand)
  base/<gender>-dark.png         optional: the same photo with dark skin
  renders/                       one edit of the base per product, only that product swapped in, plus
                                 optional fair / dark copies of it
  manifest.csv                   code,gender,external_id,product_name,slot,...

Render files are found by their code, so the team does not have to name files exactly:
"T1_20024.png", "T1_20024 Fair", "MB6.PNG", "M01 Dark.png" (zero typed for the letter O) all match. A name
containing "fair" or "dark" is that skin copy; anything else is the wheatish render.

Every render is aligned to the base and cut into a layer by catalog.engine.alpha_layers. Layers that pass
the engine's checks are approved straight away (the team already checked each render by eye); the rest are
stored as not approved with the reason, so they never show in the shop. Fair / dark copies are cut with the
wheatish layer's mask; a copy that does not line up, or where the item itself changed, is dropped and the
dressing room falls back to the wheatish layer for that skin.

When no hand-made fair / dark base photo exists, one is assembled from accepted skin copies of small items
(alpha_layers.derive_variant_base).
"""
from __future__ import annotations

import csv
import hashlib
import io
import re
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from django.core.files.base import ContentFile
from django.db import transaction
from PIL import Image, UnidentifiedImageError

from .engine import alpha_layers
from .models import MannequinBase, MannequinLayer, Product

MANIFEST_SLOTS = set(alpha_layers.SLOTS)
VARIANT_SKINS = ("fair", "dark")
IMAGE_SUFFIXES = (".png", ".jpg", ".jpeg", ".webp")
# How many accepted small-item skin copies to re-align when assembling a fair / dark base photo.
BASE_DERIVE_CANDIDATES = 6


@dataclass
class ImportRow:
    code: str
    external_id: str
    slot: str
    outcome: str  # "approved", "rejected", "unchanged", "skipped"
    reason: str = ""
    product_id: int | None = None
    report: dict = field(default_factory=dict)
    skins: dict = field(default_factory=dict)  # {"fair": "ok" | "missing" | "<why it was dropped>", "dark": ...}


@dataclass
class ImportResult:
    base_created: bool
    base_changed: bool
    rows: list[ImportRow]
    base_skins: dict = field(default_factory=dict)  # {"fair": "hand-made" | "derived" | "kept" | "missing"}
    warnings: list[str] = field(default_factory=list)

    def count(self, outcome):
        return sum(1 for row in self.rows if row.outcome == outcome)


# ---- files ----------------------------------------------------------------------------------------------

def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _png(array) -> bytes:
    buffer = io.BytesIO()
    Image.fromarray(array).save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def _jpeg(array) -> bytes:
    buffer = io.BytesIO()
    Image.fromarray(array).save(buffer, format="JPEG", quality=90)
    return buffer.getvalue()


def _load(path: Path):
    with Image.open(path) as photo:
        return alpha_layers.to_canvas(photo)


def _alpha_of(field_file):
    with Image.open(field_file.path) as cut:
        return np.asarray(cut.convert("RGBA"))[..., 3]


def read_manifest(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return [{(key or "").strip(): (value or "").strip() for key, value in row.items()} for row in csv.DictReader(handle)]


_CODE = re.compile(r"^([A-Za-z]+)(\d+)")


def _skin_of(name: str) -> str:
    low = name.lower()
    return "fair" if "fair" in low else "dark" if "dark" in low else "wheatish"


def _code_candidates(name: str) -> list[str]:
    """Codes a file name could mean: "T1_20024 Fair.png" -> ["T1"]; "M01.png" -> ["M01", "MO1"]."""
    match = _CODE.match(name)
    if not match:
        return []
    letters, digits = match.group(1).upper(), match.group(2)
    candidates = [letters + digits]
    if digits.startswith("0") and len(digits) > 1:
        candidates.append(letters + "O" + digits[1:])  # a zero typed for the letter O
    return candidates


def find_render_files(folder: Path, codes) -> tuple[dict[str, dict[str, Path]], list[str]]:
    """{code: {"wheatish"|"fair"|"dark": path}} for the manifest codes, and warnings about odd files.

    Extensions are not trusted ("M01.Fairpng", "T1_20024 Fair" with none); Pillow decides later whether the
    file is an image. Two files for the same code and skin: the one with a normal image extension wins.
    """
    codes = {code.upper() for code in codes}
    found: dict[str, dict[str, Path]] = {}
    warnings = []
    if not folder.is_dir():
        return found, [f"no renders folder at {folder}"]
    for path in sorted(folder.iterdir()):
        if not path.is_file() or path.name.startswith("."):
            continue
        code = next((candidate for candidate in _code_candidates(path.name) if candidate in codes), None)
        if code is None:
            warnings.append(f"{path.name}: no manifest code matches this file name")
            continue
        skin = _skin_of(path.name)
        current = found.setdefault(code, {}).get(skin)
        if current is not None:
            if path.suffix.lower() not in IMAGE_SUFFIXES or current.suffix.lower() in IMAGE_SUFFIXES:
                warnings.append(f"{path.name}: a second {skin} render for {code}, kept {current.name}")
                continue
            warnings.append(f"{current.name}: a second {skin} render for {code}, kept {path.name}")
        found[code][skin] = path
    return found, warnings


def _files_sha(files: dict[str, Path]) -> str:
    joined = "|".join(f"{skin}:{_sha256(files[skin])}" for skin in sorted(files))
    return hashlib.sha256(joined.encode()).hexdigest()


def _replace(field_file, name, content):
    if field_file:
        field_file.delete(save=False)  # replace the file instead of piling up renamed copies
    field_file.save(name, ContentFile(content), save=False)


def _clear(instance, attribute):
    field_file = getattr(instance, attribute)
    if field_file:
        field_file.delete(save=False)
    setattr(instance, attribute, None)


# ---- import ---------------------------------------------------------------------------------------------

def import_alpha_kit(*, source_dir, gender, segment, rebuild=False) -> ImportResult:
    """Create/refresh the gender's base and one layer per manifest row (for this gender) whose render exists.

    `segment(image) -> (upper, lower[, full])` is the cloth segmenter (catalog.engine.cutout.cloth_segmenter
    in real runs, a stand-in in tests). Unchanged renders are skipped unless `rebuild` or the base changed.
    """
    source = Path(source_dir)
    base_path = source / "base" / f"{gender}.png"
    manifest_path = source / "manifest.csv"
    if not base_path.exists():
        raise FileNotFoundError(f"no base photo at {base_path}")
    if not manifest_path.exists():
        raise FileNotFoundError(f"no manifest at {manifest_path}")

    manifest = [row for row in read_manifest(manifest_path) if row.get("gender", "").lower() in ("", gender)]
    renders, warnings = find_render_files(source / "renders", [row.get("code", "") for row in manifest])

    base_sha = _sha256(base_path)
    base = _load(base_path)
    base_cloth = segment(base)

    mannequin = MannequinBase.objects.filter(gender=gender).first()
    created = mannequin is None
    base_changed = created or mannequin.source_sha != base_sha
    if base_changed:
        mannequin = mannequin or MannequinBase(gender=gender)
        _save_base(mannequin, base, base_cloth, base_sha)
    rebuild = rebuild or base_changed

    rows, codes = [], {}
    for row in manifest:
        result = _import_row(
            row, source=source, renders=renders, mannequin=mannequin, base=base, base_cloth=base_cloth,
            segment=segment, rebuild=rebuild,
        )
        rows.append(result)
        if result.product_id:
            codes[result.product_id] = result.code
    changed = rebuild or any(row.outcome in ("approved", "rejected") for row in rows)
    base_skins = _save_skin_bases(mannequin, base, source, renders, codes, refresh=changed)
    return ImportResult(base_created=created, base_changed=base_changed, rows=rows, base_skins=base_skins, warnings=warnings)


def _save_base(mannequin, base, base_cloth, base_sha):
    width, height = alpha_layers.CANVAS
    base_top, _ = alpha_layers.build_layer(base, base, "base_top", base_cloth, base_cloth)
    base_bottom, _ = alpha_layers.build_layer(base, base, "base_bottom", base_cloth, base_cloth)
    with transaction.atomic():
        mannequin.width, mannequin.height = width, height
        mannequin.source_sha = base_sha
        mannequin.is_active = True
        _replace(mannequin.image, f"{mannequin.gender}.jpg", _jpeg(base))
        _replace(mannequin.base_top, f"{mannequin.gender}-top.png", _png(base_top))
        _replace(mannequin.base_bottom, f"{mannequin.gender}-bottom.png", _png(base_bottom))
        mannequin.save()


def _find_product(row, gender):
    """(product, reason). By external_id when the manifest has one, else by exact name for this gender."""
    external_id, name = row.get("external_id", ""), row.get("product_name", "")
    if external_id:
        product = Product.objects.filter(external_id=external_id).first()
        return (product, "") if product else (None, f"no product with external_id {external_id!r}")
    if not name:
        return None, "the manifest row has neither external_id nor product_name"
    matches = list(Product.objects.filter(name__iexact=name, gender__in=(gender, "unisex"))[:2])
    if not matches:
        return None, f"no {gender} product named {name!r}: add it in the admin first, or put its external_id in the manifest"
    if len(matches) > 1:
        return None, f"more than one product named {name!r}: put its external_id in the manifest"
    return matches[0], ""


def _import_row(row, *, source, renders, mannequin, base, base_cloth, segment, rebuild, product=None) -> ImportRow:
    code, slot = row.get("code", "").upper(), row.get("slot", "").lower()
    result = ImportRow(code=code, external_id=row.get("external_id", ""), slot=slot, outcome="skipped")
    if slot not in MANIFEST_SLOTS:
        result.reason = f"unknown slot {slot!r}"
        return result

    files = dict(renders.get(code, {}))
    listed = row.get("render_file", "")
    if listed and (source / listed).is_file():
        files["wheatish"] = source / listed  # an explicit file name in the manifest wins
    if "wheatish" not in files:
        result.reason = f"render not found for {code}" + (" (only fair/dark copies)" if files else "")
        return result

    reason = ""
    if product is None:
        product, reason = _find_product(row, mannequin.gender)
    if product is None:
        result.reason = reason
        return result
    result.product_id = product.id
    if product.gender and product.gender not in (mannequin.gender, "unisex"):
        result.reason = f"product is {product.gender}, base is {mannequin.gender}"
        return result

    render_sha = _files_sha(files)
    existing = MannequinLayer.objects.filter(base=mannequin, product=product).first()
    if existing and existing.source_sha == render_sha and existing.slot == slot and not rebuild:
        result.outcome = "unchanged" if existing.approved else "rejected"
        result.reason = existing.note
        result.report = existing.report
        result.skins = {skin: ("ok" if getattr(existing, f"image_{skin}") else "missing") for skin in VARIANT_SKINS}
        return result

    try:
        render = _load(files["wheatish"])
    except (UnidentifiedImageError, OSError):
        result.reason = f"{files['wheatish'].name} is not an image"
        return result
    layer, report = alpha_layers.make_layer(base, render, slot, base_cloth, segment)
    reasons = alpha_layers.problems(report)
    variants = _cut_variants(base, layer, files, reasons, result)

    stem = f"{mannequin.gender}-{product.external_id or product.id}"
    with transaction.atomic():
        layer_row = existing or MannequinLayer(base=mannequin, product=product)
        layer_row.slot = slot
        layer_row.source_sha = render_sha
        layer_row.report = {**report.as_dict(), "skins": result.skins}
        layer_row.approved = not reasons
        layer_row.note = "; ".join(reasons)[:255]
        _replace(layer_row.image, f"{stem}.png", _png(layer))
        for skin in VARIANT_SKINS:
            if skin in variants:
                _replace(getattr(layer_row, f"image_{skin}"), f"{stem}-{skin}.png", _png(variants[skin]))
            else:
                _clear(layer_row, f"image_{skin}")
        layer_row.save()

    result.outcome = "approved" if not reasons else "rejected"
    result.reason = layer_row.note
    result.report = layer_row.report
    if not reasons and (product.status == "Draft" or not product.is_active):
        result.reason = "approved, but the product is hidden from shoppers (Draft or inactive)"
    return result


def _cut_variants(base, layer, files, reasons, result) -> dict:
    """Fair / dark layers that pass the variant checks; the outcome per skin goes into `result.skins`."""
    variants = {}
    for skin in VARIANT_SKINS:
        if skin not in files:
            result.skins[skin] = "missing"
            continue
        if reasons:
            result.skins[skin] = "skipped: the wheatish layer was rejected"
            continue
        try:
            aligned, alignment = alpha_layers.align(base, _load(files[skin]))
        except (UnidentifiedImageError, OSError):
            result.skins[skin] = f"{files[skin].name} is not an image"
            continue
        variant = alpha_layers.mask_variant(aligned, layer)
        why = alpha_layers.variant_problems(alignment, alpha_layers.variant_item_change(layer, variant))
        result.skins[skin] = "; ".join(why) if why else "ok"
        if not why:
            variants[skin] = variant
    return variants


# ---- fair / dark base photos ----------------------------------------------------------------------------

def _save_skin_bases(mannequin, base, source, renders, codes, *, refresh) -> dict:
    """Fill MannequinBase.image_fair / image_dark: a hand-made base/<gender>-<skin>.png when it lines up,
    else assembled from accepted skin copies of the smallest items. Kept as is when nothing changed."""
    status = {}
    for skin in VARIANT_SKINS:
        attribute = f"image_{skin}"
        if getattr(mannequin, attribute) and not refresh:
            status[skin] = "kept"
            continue
        photo = _hand_made_base(base, source / "base" / f"{mannequin.gender}-{skin}.png")
        status[skin] = "hand-made"
        if photo is None:
            photo = _derived_base(mannequin, base, renders, codes, skin)
            status[skin] = "derived"
        if photo is None:
            _clear(mannequin, attribute)
            status[skin] = "missing"
        else:
            _replace(getattr(mannequin, attribute), f"{mannequin.gender}-{skin}.jpg", _jpeg(photo))
    mannequin.save()
    return status


def _hand_made_base(base, path: Path):
    if not path.is_file():
        return None
    try:
        aligned, alignment = alpha_layers.align(base, _load(path))
    except (UnidentifiedImageError, OSError):
        return None
    return None if alpha_layers.variant_problems(alignment) else aligned


def _derived_base(mannequin, base, renders, codes, skin):
    """Re-align the accepted skin copies of the smallest items and let the engine stitch a base from them."""
    attribute = f"image_{skin}"
    candidates = []
    for layer in MannequinLayer.objects.filter(base=mannequin, approved=True).exclude(**{attribute: ""}):
        if not getattr(layer, attribute):
            continue
        path = renders.get(codes.get(layer.product_id, ""), {}).get(skin)
        if path is None:
            continue
        alpha = _alpha_of(layer.image)
        candidates.append((int((alpha > 0).sum()), path, alpha))
    candidates.sort(key=lambda item: item[0])
    pieces = []
    for _, path, alpha in candidates[:BASE_DERIVE_CANDIDATES]:
        aligned, _ = alpha_layers.align(base, _load(path))
        pieces.append((aligned, alpha))
    return alpha_layers.derive_variant_base(base, pieces)


def add_layer_from_upload(*, product, slot, uploads: dict, segment, gender=None) -> ImportRow:
    """Admin upload: cut one product's render (and optional fair / dark copies) onto an imported base.

    `uploads` maps "wheatish" (required), "fair", "dark" to uploaded files. The same checks as the kit import
    run, so a render that does not line up is stored as rejected with the reason.
    """
    import tempfile

    gender = gender or (product.gender if product.gender in ("men", "women") else None)
    if gender not in ("men", "women"):
        raise ValueError("Pick the mannequin (men or women) for this product.")
    mannequin = MannequinBase.objects.filter(gender=gender).first()
    if mannequin is None:
        raise ValueError(f"There is no {gender} mannequin yet: import the render kit first.")
    if "wheatish" not in uploads:
        raise ValueError("The main render (wheatish skin) is required.")
    base = _load(Path(mannequin.image.path))
    base_cloth = segment(base)
    with tempfile.TemporaryDirectory() as folder:
        files = {}
        for skin, upload in uploads.items():
            path = Path(folder) / f"{skin}.img"
            with path.open("wb") as handle:
                for chunk in upload.chunks():
                    handle.write(chunk)
            files[skin] = path
        row = {"code": f"P{product.id}", "slot": slot, "external_id": product.external_id or ""}
        return _import_row(
            row, source=Path(folder), renders={row["code"]: files}, mannequin=mannequin, base=base,
            base_cloth=base_cloth, segment=segment, rebuild=True, product=product,
        )


def set_layer_approved(*, layer: MannequinLayer, approved: bool) -> MannequinLayer:
    layer.approved = approved
    layer.save(update_fields=["approved", "updated_at"])
    return layer


# ---- demo catalog ---------------------------------------------------------------------------------------

DEMO_PRICES = {  # PKR, only used when a product has no price yet
    "top": 2499, "kurta": 3499, "outerwear": 5999, "bottom": 2299,
    "shoes": 3999, "watch": 4999, "eyewear": 1499, "headwear": 999,
}
SIZED_SLOTS = ("top", "kurta", "outerwear", "bottom")
DEMO_STOCK_PER_SIZE = 10


def publish_demo_products() -> list[Product]:
    """Make every product with an approved mannequin layer buyable for the demo: Active, a price when it has
    none, and stock when it has none (10 per size S-XXL for clothes, 10 in total for shoes and accessories,
    which the cart treats as one size). Products that already have a price or stock keep them."""
    changed = []
    layers = MannequinLayer.objects.filter(approved=True).select_related("product")
    with transaction.atomic():
        for layer in layers:
            product = layer.product
            product.status = "Active"
            product.is_active = True
            if not product.price:
                product.price = DEMO_PRICES.get(layer.slot, 1999)
            if not product.stock_quantity:
                if layer.slot in SIZED_SLOTS:
                    for size in ("s", "m", "l", "xl", "xxl"):
                        setattr(product, f"size_{size}_stock", DEMO_STOCK_PER_SIZE)
                    product.sizes = []  # re-derived from the per-size stock on save
                    product.stock_quantity = DEMO_STOCK_PER_SIZE * 5
                else:
                    product.stock_quantity = DEMO_STOCK_PER_SIZE
            product.save()
            changed.append(product)
    return changed
