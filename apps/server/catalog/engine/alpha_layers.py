"""Mannequin (alpha): turn one-item-swapped renders of a fixed base photo into stackable garment layers.

The team makes one AI base photo (a model in a plain white tee, grey trousers, white sneakers) and,
for every alpha product, one edit of that same photo where only that product is swapped in (Gemini /
Nano Banana Pro, by hand; see extras/mannequin-alpha-kit/GUIDE.md). This module:

1. puts every image on one canvas (CANVAS),
2. aligns each render to the base (ECC, affine), because the generator moves the picture by a pixel or so,
3. cuts the swapped item out as a transparent layer on that same canvas,
4. stacks layers in a fixed order, so any shirt + trousers + shoes + watch combination shows on the body.

Tops and bottoms are cut with the cloth segmentation masks (upper/lower body clothes) passed in by the
caller, so a shirt layer never carries a strip of trousers and the other way round. Shoes and watches are
cut from the colour difference against the base inside their band of the picture.

Trouser layers are extended a little upwards under where the base tee ends (mirrored trouser texture), so a
shirt that is shorter than the base tee shows trousers below its hem instead of the old white tee.

v2 adds kurtas (long tops that cover the top of the trousers), outerwear (blazers, waistcoats: only the
pixels that changed, so the shirt underneath shows through an open blazer), sunglasses and caps (cut inside
their band of the picture), and skin-tone variants: a "fair" or "dark" copy of a render (the same edit with only
the skin colour changed) is aligned to the base and cut with the wheatish layer's mask, and a variant base photo
is assembled from two variant renders whose items do not overlap (see derive_variant_base).

Pure: NumPy, OpenCV and Pillow only. No Django, no model loading.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

import cv2
import numpy as np
from PIL import Image

CANVAS = (960, 1280)  # width, height (3:4)
SLOTS = ("top", "kurta", "outerwear", "bottom", "shoes", "watch", "eyewear", "headwear")
SLOT_LABELS = {
    "top": "Shirts & tops", "kurta": "Kurtas", "outerwear": "Blazers & waistcoats", "bottom": "Trousers & shalwar",
    "shoes": "Shoes", "watch": "Watches", "eyewear": "Sunglasses", "headwear": "Caps",
}
# Accessories are separate slots, so a watch, sunglasses and a cap can all be worn together.
ACCESSORY_SLOTS = ("watch", "eyewear", "headwear")
SKINS = ("wheatish", "fair", "dark")
# Drawing order, lowest first. "base_bottom" / "base_top" are the base's own trousers (with the waist
# extension) and tee, cut from the base itself. The web app draws base_bottom when a top is worn without a
# chosen bottom (so a short shirt shows trousers under its hem), and base_top when a bottom is worn without a
# chosen top (so the trousers' waist extension does not crop the tee).
Z_ORDER = {
    "shoes": 1, "bottom": 2, "base_bottom": 2, "top": 3, "kurta": 3, "base_top": 3,
    "outerwear": 4, "watch": 5, "eyewear": 6, "headwear": 7,
}

# Vertical bands (fractions of the canvas height) for the slots cut by colour difference only.
BANDS = {"shoes": (0.80, 1.0), "watch": (0.36, 0.66), "eyewear": (0.0, 0.25), "headwear": (0.0, 0.20)}
# Slots whose quality check only looks at the upper body: the item cannot change anything below the hips, so a
# render where the generator also changed the trousers can still give a clean layer.
UPPER_ONLY_SLOTS = ("top", "outerwear", "watch", "eyewear", "headwear")
KURTA_BOTTOM = 0.82  # a kurta layer never reaches below this share of the height

# Starting values, checked on the first men's pilot (10 renders): ECC correlation 0.993 to 0.999, shifts
# under 1 px, 0.0 to 0.5 % of pixels outside the layer changed. A render that fails these moved the person.
MIN_ECC = 0.90
MAX_SHIFT_PX = 25.0
MAX_SCALE_DELTA = 0.04
MAX_KEEP_CHANGE = 0.05

DIFF_THRESHOLD = 14.0  # colour difference (Lab, after a light blur) that counts as "changed"
WAIST_EXTENSION_PX = 60  # how far trouser layers reach up under the base tee's hem


@dataclass
class AlignReport:
    ecc: float | None
    shift_x: float
    shift_y: float
    scale: float
    method: str


@dataclass
class LayerReport:
    slot: str
    ecc: float | None
    shift_x: float
    shift_y: float
    scale: float
    layer_share: float  # share of the canvas the layer covers
    keep_change: float  # share of pixels outside the layer that changed (pose / framing moved)
    components: int

    def as_dict(self):
        return asdict(self)


def to_canvas(image: Image.Image) -> np.ndarray:
    """RGB uint8 array on the canvas. A 3:4 image is resized; other shapes are padded with the corner colour."""
    image = image.convert("RGB")
    width, height = CANVAS
    scale = min(width / image.width, height / image.height)
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    resized = np.asarray(image.resize(size, Image.LANCZOS))
    if size == CANVAS:
        return resized.copy()
    corner = resized[0, 0]
    canvas = np.empty((height, width, 3), np.uint8)
    canvas[:] = corner
    x0, y0 = (width - size[0]) // 2, (height - size[1]) // 2
    canvas[y0:y0 + size[1], x0:x0 + size[0]] = resized
    return canvas


def _lab(image: np.ndarray, sigma: float) -> np.ndarray:
    lab = cv2.cvtColor(image, cv2.COLOR_RGB2LAB).astype(np.float32)
    return cv2.GaussianBlur(lab, (0, 0), sigma) if sigma else lab


def delta_e(a: np.ndarray, b: np.ndarray, sigma: float = 1.5) -> np.ndarray:
    """Per-pixel colour difference (Euclidean distance in OpenCV's 8-bit Lab) after a light blur."""
    return np.sqrt(((_lab(a, sigma) - _lab(b, sigma)) ** 2).sum(axis=2))


def _disk(size: int) -> np.ndarray:
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (size, size))


def align(base: np.ndarray, render: np.ndarray) -> tuple[np.ndarray, AlignReport]:
    """Warp the render onto the base. The changed region is masked out so only unchanged parts drive it."""
    changed = cv2.dilate((delta_e(base, render) > 12).astype(np.uint8), _disk(25))
    keep = ((1 - changed) * 255).astype(np.uint8)
    gray_base = cv2.cvtColor(base, cv2.COLOR_RGB2GRAY).astype(np.float32)
    gray_render = cv2.cvtColor(render, cv2.COLOR_RGB2GRAY).astype(np.float32)
    warp = np.eye(2, 3, dtype=np.float32)
    ecc, method = None, "ecc"
    try:
        ecc, warp = cv2.findTransformECC(
            gray_base, gray_render, warp, cv2.MOTION_AFFINE,
            (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 100, 1e-5), keep, 5,
        )
    except cv2.error:
        warp, method = np.eye(2, 3, dtype=np.float32), "none"
    height, width = base.shape[:2]
    aligned = cv2.warpAffine(
        render, warp, (width, height), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE,
    )
    scale = float(np.sqrt(abs(np.linalg.det(warp[:, :2]))))
    report = AlignReport(
        ecc=None if ecc is None else float(ecc), shift_x=float(warp[0, 2]), shift_y=float(warp[1, 2]),
        scale=scale, method=method,
    )
    return aligned, report


def _largest(mask: np.ndarray, keep: int = 1) -> tuple[np.ndarray, int]:
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    order = sorted(range(1, count), key=lambda i: -stats[i, cv2.CC_STAT_AREA])[:keep]
    return np.isin(labels, order), len(order)


def _fill_holes(mask: np.ndarray) -> np.ndarray:
    filled = mask.astype(np.uint8) * 255
    flood = filled.copy()
    height, width = filled.shape
    cv2.floodFill(flood, np.zeros((height + 2, width + 2), np.uint8), (0, 0), 255)
    return (filled | cv2.bitwise_not(flood)) > 0


def _fill_small_holes(mask: np.ndarray, max_share: float) -> np.ndarray:
    """Fill enclosed holes smaller than `max_share` of the mask's area; keep bigger ones open."""
    filled = _fill_holes(mask)
    holes = filled & ~mask
    if not holes.any():
        return mask
    count, labels, stats, _ = cv2.connectedComponentsWithStats(holes.astype(np.uint8), 8)
    limit = max_share * max(1, int(mask.sum()))
    small = [i for i in range(1, count) if stats[i, cv2.CC_STAT_AREA] <= limit]
    return mask | np.isin(labels, small)


def _open(mask: np.ndarray, size: int) -> np.ndarray:
    return cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_OPEN, _disk(size)).astype(bool)


def _close(mask: np.ndarray, size: int) -> np.ndarray:
    return cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_CLOSE, _disk(size)).astype(bool)


def _alpha(mask: np.ndarray, sigma: float = 1.0) -> np.ndarray:
    soft = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), sigma) * 1.2
    return (np.clip(soft, 0, 1) * 255).astype(np.uint8)


def hem_zone(base_upper: np.ndarray, lower: np.ndarray, extension: int = WAIST_EXTENSION_PX) -> np.ndarray:
    """The lowest `extension` rows of the base top, in the columns where trousers start right under it."""
    zone = np.zeros_like(base_upper, dtype=bool)
    columns = np.nonzero(base_upper.any(axis=0))[0]
    for x in columns:
        bottom = int(np.nonzero(base_upper[:, x])[0].max())
        if lower[bottom + 1:bottom + 15, x].any():
            zone[max(0, bottom - extension):bottom + 1, x] = True
    return zone


def mirror_fill(image: np.ndarray, zone: np.ndarray, lower: np.ndarray) -> np.ndarray:
    """Fill the zone column by column with the trouser pixels just below it, mirrored upwards."""
    out = image.copy()
    height = image.shape[0]
    for x in np.nonzero(zone.any(axis=0))[0]:
        rows = np.nonzero(zone[:, x])[0]
        top, bottom = int(rows.min()), int(rows.max())
        below = np.nonzero(lower[bottom + 1:, x])[0]
        if not len(below):
            continue
        start = bottom + 1 + int(below.min())
        ys = np.arange(top, start)
        sources = np.minimum(height - 1, start + (start - ys))
        out[ys, x] = image[sources, x]
    return out


def build_layer(
    base: np.ndarray,
    aligned: np.ndarray,
    slot: str,
    base_cloth: tuple[np.ndarray, np.ndarray],
    render_cloth: tuple[np.ndarray, np.ndarray],
) -> tuple[np.ndarray, int]:
    """RGBA layer (canvas size) for one slot, and how many parts it has. Cloth masks are (upper, lower[, full])."""
    base_upper, base_lower = base_cloth[0], base_cloth[1]
    upper, lower = render_cloth[0], render_cloth[1]
    full = render_cloth[2] if len(render_cloth) > 2 else np.zeros_like(upper)
    changed = delta_e(base, aligned) > DIFF_THRESHOLD
    rgb = aligned
    if slot in ("top", "base_top"):
        near_base_top = cv2.dilate(base_upper.astype(np.uint8), _disk(31)).astype(bool)
        mask = (upper | (changed & near_base_top)) & ~lower
        mask, parts = _largest(_open(mask, 5))
        mask = _fill_holes(mask) & ~lower
    elif slot == "kurta":
        mask = _kurta_mask(base, aligned, base_upper, base_lower, upper, lower, full, changed)
        mask, parts = _largest(_close(_open(mask, 5), 9))
        mask = _fill_holes(_close(mask, 11))
    elif slot == "outerwear":
        near_top = cv2.dilate(base_upper.astype(np.uint8), _disk(25)).astype(bool)
        mask = changed & (upper | full | near_top) & ~lower
        mask, parts = _largest(_close(_open(mask, 5), 7), 2)
        # Only small enclosed holes are filled (a pocket or button the generator left alone). The open front of a
        # blazer is not enclosed (it runs out at the hem), so the shirt underneath still shows through.
        mask = _fill_small_holes(mask, max_share=0.25)
    elif slot in ("bottom", "base_bottom"):
        near_base_bottom = cv2.dilate(base_lower.astype(np.uint8), _disk(81)).astype(bool)
        # Upper-body pixels are only removed where the base tee is (the tee hanging over the waistband). The cloth
        # model sometimes calls a white shalwar "upper body"; removing those everywhere punched holes in it.
        near_base_top = cv2.dilate(base_upper.astype(np.uint8), _disk(15)).astype(bool)
        mask = (lower | (changed & near_base_bottom)) & ~(upper & near_base_top)
        mask, parts = _largest(_open(mask, 5))
        zone = hem_zone(base_upper, lower) & ~mask
        rgb = mirror_fill(aligned, zone, lower)
        mask = _fill_holes(mask | zone)
    elif slot in BANDS:
        top, bottom = (int(fraction * base.shape[0]) for fraction in BANDS[slot])
        mask = changed.copy()
        mask[:top] = False
        mask[bottom:] = False
        mask = _close(_open(mask, 3 if slot in ("watch", "eyewear") else 5), 7)
        mask, parts = _largest(mask, 2 if slot == "shoes" else 1)
        mask = _fill_holes(mask)
    else:
        raise ValueError(f"unknown slot {slot!r}")
    alpha = _alpha(mask)
    rgb = rgb.copy()
    rgb[alpha == 0] = 0  # transparent pixels carry no colour, so the PNG stays small
    return np.dstack([rgb, alpha]), parts


def _kurta_mask(base, aligned, base_upper, base_lower, upper, lower, full, changed) -> np.ndarray:
    """Kurta pixels. The cloth model labels a kurta (and a kurta with dupatta) as "full body" clothing and the
    trousers under it as "lower body", which is exactly the split we need; colour difference alone fails on a
    white kurta over the white base tee and on trousers the generator re-shaded under the hem. Changed pixels
    right next to that mask are added (dupatta edges, sleeves the model missed), never trouser pixels."""
    cloth = (full | upper) & ~lower
    if cloth.sum() < 0.03 * cloth.size:  # the model missed the kurta: fall back to what changed
        near_body = cv2.dilate((base_upper | base_lower).astype(np.uint8), _disk(91)).astype(bool)
        cloth = changed & near_body & ~lower
        cloth[int(KURTA_BOTTOM * changed.shape[0]):] = False
        return cloth
    next_to = cv2.dilate(cloth.astype(np.uint8), _disk(41)).astype(bool)
    return cloth | (changed & next_to & ~lower)


def check_zone(slot: str, base_cloth, height: int, width: int) -> np.ndarray:
    """Where the 'did anything else change' check looks. Upper-body items: only above the hips."""
    zone = np.ones((height, width), bool)
    if slot in ("eyewear", "headwear"):
        zone[int(0.35 * height):] = False
    elif slot in UPPER_ONLY_SLOTS and base_cloth is not None and base_cloth[0].any():
        hip = int(np.nonzero(base_cloth[0].any(axis=1))[0].max()) + 20
        zone[hip:] = False
    return zone


def keep_change(base: np.ndarray, aligned: np.ndarray, layer_alpha: np.ndarray, zone: np.ndarray | None = None) -> float:
    """Share of pixels away from the layer (inside `zone`) that still changed: high means the person moved."""
    outside = cv2.dilate((layer_alpha > 0).astype(np.uint8), _disk(31)) == 0
    if zone is not None:
        outside &= zone
    if not outside.any():
        return 0.0
    return float(((delta_e(base, aligned) > 12) & outside).sum() / outside.sum())


def make_layer(
    base: np.ndarray,
    render: np.ndarray,
    slot: str,
    base_cloth: tuple[np.ndarray, np.ndarray],
    segment,
) -> tuple[np.ndarray, LayerReport]:
    """Align a render, segment it with `segment(aligned) -> (upper, lower)`, cut the layer and report."""
    aligned, alignment = align(base, render)
    render_cloth = segment(aligned) if slot in ("top", "kurta", "outerwear", "bottom") else base_cloth
    layer, parts = build_layer(base, aligned, slot, base_cloth, render_cloth)
    zone = check_zone(slot, base_cloth, *base.shape[:2])
    report = LayerReport(
        slot=slot, ecc=alignment.ecc, shift_x=alignment.shift_x, shift_y=alignment.shift_y,
        scale=alignment.scale, layer_share=float((layer[..., 3] > 0).mean()),
        keep_change=keep_change(base, aligned, layer[..., 3], zone), components=parts,
    )
    return layer, report


def problems(report: LayerReport) -> list[str]:
    """Why a layer should not be shown. Empty means it passed."""
    reasons = []
    if report.ecc is None:
        reasons.append("could not align the render to the base")
    elif report.ecc < MIN_ECC:
        reasons.append(f"render does not line up with the base (ECC {report.ecc:.3f} < {MIN_ECC})")
    if max(abs(report.shift_x), abs(report.shift_y)) > MAX_SHIFT_PX:
        reasons.append(f"person moved {max(abs(report.shift_x), abs(report.shift_y)):.0f} px")
    if abs(report.scale - 1) > MAX_SCALE_DELTA:
        reasons.append(f"person was resized (scale {report.scale:.3f})")
    if report.keep_change > MAX_KEEP_CHANGE:
        reasons.append(f"{report.keep_change:.1%} of the picture outside the item changed (pose or framing moved)")
    if report.layer_share < 0.0002:
        reasons.append("no change found for this item")
    expected = 1  # shoes may be one part when the feet touch (heels), a blazer two (open front)
    if report.components < expected:
        reasons.append(f"found {report.components} part(s), expected {expected}")
    return reasons


def composite(base: np.ndarray, layers: list[tuple[str, np.ndarray]]) -> np.ndarray:
    """Stack layers on the base in Z_ORDER (previews and tests; the web app stacks <img> tags the same way)."""
    out = base.astype(np.float32)
    for slot, rgba in sorted(layers, key=lambda pair: Z_ORDER[pair[0]]):
        alpha = rgba[..., 3:4].astype(np.float32) / 255
        out = out * (1 - alpha) + rgba[..., :3].astype(np.float32) * alpha
    return out.round().astype(np.uint8)


# ---- skin-tone variants ---------------------------------------------------------------------------------

def mask_variant(aligned_variant: np.ndarray, wheatish_layer: np.ndarray) -> np.ndarray:
    """Cut an already aligned fair/dark render with the wheatish layer's alpha."""
    alpha = wheatish_layer[..., 3]
    rgb = aligned_variant.copy()
    rgb[alpha == 0] = 0
    return np.dstack([rgb, alpha])


def variant_layer(base: np.ndarray, variant_render: np.ndarray, wheatish_layer: np.ndarray) -> tuple[np.ndarray, AlignReport]:
    """The same item on a fair/dark copy of the render: align it to the base, reuse the wheatish layer's mask."""
    aligned, alignment = align(base, variant_render)
    return mask_variant(aligned, wheatish_layer), alignment


VARIANT_MAX_ITEM_CHANGE = 30.0  # mean colour difference inside the item between the wheatish and variant layer


def variant_item_change(wheatish_layer: np.ndarray, variant: np.ndarray) -> float:
    """How much the item itself differs between the wheatish layer and its fair/dark copy (should be ~0: only
    skin changed). Large means the generator dropped or redrew the item (e.g. heels turned back into sneakers)."""
    inside = wheatish_layer[..., 3] > 200
    if not inside.any():
        return 0.0
    return float(delta_e(wheatish_layer[..., :3], variant[..., :3], sigma=3.0)[inside].mean())


def variant_problems(alignment: AlignReport, item_change: float | None = None) -> list[str]:
    reasons = []
    if item_change is not None and item_change > VARIANT_MAX_ITEM_CHANGE:
        reasons.append(f"the item changed in the skin variant (difference {item_change:.0f})")
    if alignment.ecc is None or alignment.ecc < MIN_ECC:
        reasons.append("skin variant does not line up with the base")
    if max(abs(alignment.shift_x), abs(alignment.shift_y)) > MAX_SHIFT_PX or abs(alignment.scale - 1) > MAX_SCALE_DELTA:
        reasons.append("skin variant moved or was resized")
    return reasons


def derive_variant_base(base: np.ndarray, pieces: list[tuple[np.ndarray, np.ndarray]]) -> np.ndarray | None:
    """A fair/dark base photo from variant renders, when nobody made one by hand.

    `pieces` are (aligned variant render, wheatish layer alpha). The render whose item is smallest (a watch,
    shoes, sunglasses) becomes the base; the area of its item is filled from another variant render whose
    own item does not touch that area. Returns None when no such pair exists.
    """
    if len(pieces) < 2:
        return None
    pieces = sorted(pieces, key=lambda piece: int((piece[1] > 0).sum()))
    for index, (render, alpha) in enumerate(pieces):
        hole = cv2.dilate((alpha > 0).astype(np.uint8), _disk(25)) > 0
        for other_index, (other, other_alpha) in enumerate(pieces):
            if other_index == index:
                continue
            other_area = cv2.dilate((other_alpha > 0).astype(np.uint8), _disk(25)) > 0
            if (hole & other_area).any():
                continue
            soft = cv2.GaussianBlur(hole.astype(np.float32), (0, 0), 4)[..., None]
            mixed = render.astype(np.float32) * (1 - soft) + other.astype(np.float32) * soft
            return mixed.round().astype(np.uint8)
    return None

