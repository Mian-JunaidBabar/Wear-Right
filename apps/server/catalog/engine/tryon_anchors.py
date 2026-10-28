"""Default AR try-on anchors for a garment cut-out.

Pure Python/numpy, no Django. Anchors are stored in **cut-out pixel coordinates** on the trimmed
RGBA image, because the browser maps those pixels onto pose landmarks with a canvas transform.

The heuristics only need the alpha mask. Staff can correct any dot in the admin AR anchors editor;
these defaults are deliberately simple so a wrong photo is obvious rather than silently accepted.
"""
from __future__ import annotations

import numpy as np

# Kinds that can be drawn by the AR canvas, grouped by the anchor set they use.
TOP_KINDS = {"tshirt", "shirt", "polo", "kurta", "kameez", "dress"}
OUTERWEAR_KINDS = {"jacket", "blazer", "waistcoat", "hoodie"}
BOTTOM_KINDS = {"jeans", "trousers", "shorts", "shalwar"}
FOOTWEAR_KINDS = {"sneakers", "formal_shoes", "sandals", "boots"}
WATCH_KINDS = {"watch"}
CAP_KINDS = {"cap"}

TRYON_KINDS = TOP_KINDS | OUTERWEAR_KINDS | BOTTOM_KINDS | FOOTWEAR_KINDS | WATCH_KINDS | CAP_KINDS

ALPHA_VISIBLE = 128


def anchors_for_kind(kind: str | None) -> str:
    """The anchor set name for a garment kind: top, bottom, footwear, watch, cap, or ""."""
    if kind in TOP_KINDS or kind in OUTERWEAR_KINDS:
        return "top"
    if kind in BOTTOM_KINDS:
        return "bottom"
    if kind in FOOTWEAR_KINDS:
        return "footwear"
    if kind in WATCH_KINDS:
        return "watch"
    if kind in CAP_KINDS:
        return "cap"
    return ""


def _visible(rgba) -> np.ndarray:
    array = np.asarray(rgba)
    if array.ndim != 3 or array.shape[2] < 4:
        return np.zeros((0, 0), dtype=bool)
    return array[..., 3] >= ALPHA_VISIBLE


def _bbox(mask: np.ndarray):
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def _point(x: float, y: float) -> list[float]:
    return [round(float(x), 2), round(float(y), 2)]


def _band_extents(mask: np.ndarray, y0: int, y1: int):
    """Left/right visible extents in a horizontal band, or None when the band is empty."""
    band = mask[y0:y1]
    xs = np.nonzero(band.any(axis=0))[0]
    if len(xs) == 0:
        return None
    return int(xs.min()), int(xs.max()) + 1


def _top_anchors(mask: np.ndarray, box):
    x0, y0, x1, y1 = box
    height = max(1, y1 - y0)
    band_end = y0 + max(1, round(height * 0.12))
    extents = _band_extents(mask, y0, band_end)
    if extents is None:
        return None
    left, right = extents
    y = y0 + height * 0.07
    return {
        "l_shoulder": _point(left, y),
        "r_shoulder": _point(right, y),
        "hem_center": _point((x0 + x1) / 2, y1),
    }


def _bottom_anchors(mask: np.ndarray, box):
    x0, y0, x1, y1 = box
    height = max(1, y1 - y0)
    band_end = y0 + max(1, round(height * 0.05))
    extents = _band_extents(mask, y0, band_end)
    if extents is None:
        return None
    left, right = extents
    y = y0 + height * 0.03
    return {
        "l_waist": _point(left, y),
        "r_waist": _point(right, y),
        "hem_center": _point((x0 + x1) / 2, y1),
    }


def _widest_internal_gap(mask: np.ndarray, x0: int, x1: int):
    """(start, end) of the widest empty column run inside the garment box, or None."""
    columns = mask[:, x0:x1].any(axis=0)
    best = None
    run_start = None
    for index, used in enumerate(columns):
        if used:
            if run_start is not None:
                run = (run_start, index)
                if best is None or run[1] - run[0] > best[1] - best[0]:
                    best = run
                run_start = None
        elif run_start is None:
            run_start = index
    if run_start is not None:
        run = (run_start, len(columns))
        if best is None or run[1] - run[0] > best[1] - best[0]:
            best = run
    return (x0 + best[0], x0 + best[1]) if best else None


def _shoe_box(mask: np.ndarray, box):
    """The larger half of a pair, split at the widest gap; the whole box for a single shoe."""
    x0, y0, x1, y1 = box
    gap = _widest_internal_gap(mask, x0, x1)
    if gap and gap[1] - gap[0] >= max(2, round((x1 - x0) * 0.02)):
        halves = [(x0, gap[0]), (gap[1], x1)]
        halves = [(a, b) for a, b in halves if b - a > 0]
        if len(halves) == 2:
            def area(part):
                a, b = part
                sub = mask[y0:y1, a:b]
                ys, xs = np.nonzero(sub)
                return len(xs), (a, y0, b, y1)
            halves.sort(key=lambda part: area(part)[0], reverse=True)
            split_box = area(halves[0])[1]
            sub = mask[split_box[1]:split_box[3], split_box[0]:split_box[2]]
            ys, xs = np.nonzero(sub)
            if len(xs):
                return (
                    split_box[0] + int(xs.min()), split_box[1] + int(ys.min()),
                    split_box[0] + int(xs.max()) + 1, split_box[1] + int(ys.max()) + 1,
                )
    return x0, y0, x1, y1


def _footwear_anchors(mask: np.ndarray, box):
    sx0, sy0, sx1, sy1 = _shoe_box(mask, box)
    width, height = max(1, sx1 - sx0), max(1, sy1 - sy0)
    if width >= height:
        # A shoe sits on its side: heel at the back, toe at the front. Staff can flip the dots.
        heel = _point(sx0 + width * 0.1, sy0 + height * 0.5)
        toe = _point(sx1 - width * 0.1, sy0 + height * 0.5)
    else:
        heel = _point(sx0 + width * 0.5, sy1 - height * 0.1)
        toe = _point(sx0 + width * 0.5, sy0 + height * 0.1)
    return {"heel": heel, "toe": toe, "shoe_box": [sx0, sy0, sx1 - sx0, sy1 - sy0]}


def _watch_anchors(mask: np.ndarray, box):
    x0, y0, x1, y1 = box
    width, height = max(1, x1 - x0), max(1, y1 - y0)
    return {
        "center": _point((x0 + x1) / 2, (y0 + y1) / 2),
        "strap_width": round(float(min(width, height) * 0.55), 2),
    }


def _cap_anchors(mask: np.ndarray, box):
    x0, y0, x1, y1 = box
    return {
        "center": _point((x0 + x1) / 2, (y0 + y1) / 2),
        "width": float(x1 - x0),
    }


def compute_tryon_anchors(image, kind: str | None):
    """Default anchors for one trimmed RGBA cut-out, or None when the kind is not drawable.

    The image may be a PIL image, a numpy array, or anything numpy.asarray understands.
    """
    family = anchors_for_kind(kind)
    if not family:
        return None
    mask = _visible(image)
    if mask.size == 0 or not mask.any():
        return None
    box = _bbox(mask)
    if box is None:
        return None
    if family == "top":
        return _top_anchors(mask, box)
    if family == "bottom":
        return _bottom_anchors(mask, box)
    if family == "footwear":
        return _footwear_anchors(mask, box)
    if family == "watch":
        return _watch_anchors(mask, box)
    return _cap_anchors(mask, box)
