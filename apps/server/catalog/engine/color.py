"""Colour extraction for product images: dominant colours and their nearest names.

Pure Python, no Django imports. Clustering runs in CIELAB (D65) and distances use CIEDE2000.
"""
import cv2
import numpy as np
from coloraide import Color

# Names for extracted colours. These hex values are common web colour anchors, not
# measurements. Tune them on the labelled set in phase 3 if naming drifts.
REFERENCE_COLORS = [
    ("White", "#ffffff"), ("Off-White", "#faf9f6"), ("Cream", "#fffdd0"), ("Beige", "#f5f5dc"),
    ("Khaki", "#c3b091"), ("Camel", "#c19a6b"), ("Tan", "#d2b48c"), ("Peach", "#ffcba4"),
    ("Mustard Yellow", "#ffdb58"), ("Yellow", "#ffff00"), ("Orange", "#ffa500"), ("Rust Orange", "#b7410e"),
    ("Coral", "#ff7f50"), ("Bright Red", "#e31e24"), ("Maroon", "#800000"), ("Burgundy", "#800020"),
    ("Wine Red", "#722f37"), ("Pastel Pink", "#f4c2c2"), ("Hot Pink", "#ff69b4"), ("Soft Lavender", "#e6e6fa"),
    ("Deep Purple", "#4b0082"), ("Royal Blue", "#4169e1"), ("Sky Blue", "#87ceeb"), ("Denim Blue", "#1560bd"),
    ("Navy Blue", "#000080"), ("Teal", "#008080"), ("Turquoise", "#40e0d0"), ("Emerald Green", "#50c878"),
    ("Bottle Green", "#006a4e"), ("Olive Green", "#808000"), ("Brown", "#7b4a2d"), ("Dark Brown", "#4a2c1a"),
    ("Light Grey", "#d3d3d3"), ("Grey", "#808080"), ("Charcoal Grey", "#36454f"), ("Black", "#000000"),
]

_REFERENCE_LAB = [(name, Color(hex_value).convert("lab-d65")) for name, hex_value in REFERENCE_COLORS]


def nearest_color(hex_value):
    """Return (name, CIEDE2000 distance) of the reference colour closest to hex_value."""
    target = Color(hex_value).convert("lab-d65")
    return min(
        ((name, target.delta_e(reference, method="2000")) for name, reference in _REFERENCE_LAB),
        key=lambda item: item[1],
    )


def _hex_from_cv_lab(lab):
    """Convert one CIELAB triple (as returned by OpenCV) to a hex colour inside the sRGB gamut."""
    return Color("lab-d65", [float(value) for value in lab]).convert("srgb").fit().to_string(hex=True)


def dominant_palette(rgb, visible=None, *, k=3, max_samples=20000, seed=0):
    """Return up to k dominant colours of the visible pixels, largest share first.

    rgb: uint8 array shaped (height, width, 3).
    visible: optional bool array shaped (height, width). Only True pixels are used.
    Each entry is {"hex", "name", "share"}; shares sum to 1 over the sampled pixels.
    """
    pixels = rgb[visible] if visible is not None else rgb.reshape(-1, 3)
    if pixels.size == 0:
        return []
    if len(pixels) > max_samples:
        rng = np.random.default_rng(seed)
        pixels = pixels[rng.choice(len(pixels), size=max_samples, replace=False)]

    lab = cv2.cvtColor(pixels.reshape(-1, 1, 3).astype(np.float32) / 255.0, cv2.COLOR_RGB2LAB).reshape(-1, 3)
    clusters = min(k, len(np.unique(lab, axis=0)))
    cv2.setRNGSeed(seed)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 0.5)
    _, labels, centers = cv2.kmeans(lab, clusters, None, criteria, 3, cv2.KMEANS_PP_CENTERS)

    counts = np.bincount(labels.ravel(), minlength=clusters)
    palette = []
    for index in np.argsort(-counts):
        if counts[index] == 0:
            continue
        hex_value = _hex_from_cv_lab(centers[index])
        name, _ = nearest_color(hex_value)
        palette.append({"hex": hex_value, "name": name, "share": round(float(counts[index]) / len(labels), 3)})
    return palette


def palette_from_image(image, *, k=3):
    """Dominant colours of an image. Pixels with alpha below 128 are ignored (background of a cut-out)."""
    rgba = np.asarray(image.convert("RGBA"))
    return dominant_palette(rgba[..., :3], rgba[..., 3] >= 128, k=k)
