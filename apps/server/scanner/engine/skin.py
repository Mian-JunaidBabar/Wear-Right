"""Skin colour maths: CIELAB, ITA depth, hue-angle undertone, Monk Skin Tone swatch. No Django imports."""
import cv2
import numpy as np
from coloraide import Color

# Thresholds from the PRD. They are starting points, not calibrated: tune them with
# `manage.py evaluate_skin_tone` on the labelled photo set before quoting accuracy.
ITA_FAIR_ABOVE = 41.0      # ITA above this: Fair
ITA_MEDIUM_FROM = 10.0     # ITA from here up to the Fair limit: Medium; below: Dark
HUE_WARM_FROM = 58.0       # hue angle (degrees) at or above this: warm
HUE_COOL_BELOW = 50.0      # below this: cool; in between: neutral
TRIM_PERCENTILES = (10, 90)  # L* percentile band kept before taking the median

# Google's Monk Skin Tone scale, swatches 1 (lightest) to 10 (darkest). Check Google's attribution terms.
MONK_SWATCHES = [
    "#f6ede4", "#f3e7db", "#f7ead0", "#eadaba", "#d7bd96",
    "#a07e56", "#825c43", "#604134", "#3a312a", "#292420",
]
_MONK_LAB = [Color(hex_value).convert("lab-d65") for hex_value in MONK_SWATCHES]


def bgr_to_lab(pixels_bgr):
    """(N, 3) uint8 BGR pixels to (N, 3) float CIELAB (D65): L* 0..100, a* and b* roughly -128..127."""
    rgb = pixels_bgr[:, ::-1].astype(np.float32).reshape(-1, 1, 3) / 255.0
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).reshape(-1, 3)


def trimmed_median_lab(lab, percentiles=TRIM_PERCENTILES):
    """Median Lab of the pixels whose L* lies between the given percentiles (drops highlights and shadows)."""
    low, high = np.percentile(lab[:, 0], percentiles)
    kept = lab[(lab[:, 0] >= low) & (lab[:, 0] <= high)]
    return np.median(kept, axis=0)


def ita_degrees(lab):
    """Individual Typology Angle from L* and b*. b* is floored at 1 so the angle stays defined."""
    return float(np.degrees(np.arctan((lab[0] - 50.0) / max(float(lab[2]), 1.0))))


def hue_degrees(lab):
    return float(np.degrees(np.arctan2(lab[2], lab[1])))


def depth_from_ita(ita):
    if ita > ITA_FAIR_ABOVE:
        return "Fair"
    return "Medium" if ita >= ITA_MEDIUM_FROM else "Dark"


def undertone_from_hue(hue):
    if hue >= HUE_WARM_FROM:
        return "warm"
    return "cool" if hue < HUE_COOL_BELOW else "neutral"


def nearest_monk(lab):
    """Monk Skin Tone number (1 to 10) of the swatch closest by CIEDE2000, and that distance."""
    target = Color("lab-d65", [float(v) for v in lab])
    distances = [target.delta_e(swatch, method="2000") for swatch in _MONK_LAB]
    best = int(np.argmin(distances))
    return best + 1, float(distances[best])
