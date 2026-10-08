"""Skin sampling regions on the MediaPipe 478-point face mesh. Pure Python, no Django.

Only the cheeks and the forehead are sampled, so eyes, brows, lips, nostrils, beard and hair
never reach the colour average. Indices are for the canonical MediaPipe face mesh and were
checked on a rendered landmark overlay (see docs/phases/phase-3.md).
"""
import cv2
import numpy as np

# Left and right are as seen in the image (the subject's right cheek is on the image's left).
LEFT_CHEEK = [123, 117, 118, 119, 100, 36, 203, 206, 207, 187, 147]
RIGHT_CHEEK = [352, 346, 347, 348, 329, 266, 423, 426, 427, 411, 376]
FOREHEAD = [67, 109, 10, 338, 297, 299, 337, 151, 108, 69]
REGIONS = {"left_cheek": LEFT_CHEEK, "right_cheek": RIGHT_CHEEK, "forehead": FOREHEAD}

# Landmarks that must never fall inside a sampling region (eyes, brows, mouth, nostrils).
EXCLUDED = {
    "eyes": [33, 133, 159, 145, 362, 263, 386, 374],
    "brows": [105, 66, 107, 336, 296, 334],
    "mouth": [13, 14, 61, 291, 0, 17],
    "nose_tip": [1, 4, 5, 195],
}


def _shrink(polygon, factor):
    """Pull a polygon towards its centroid so the edges (hairline, folds, shadows) are left out."""
    centre = polygon.mean(axis=0)
    return centre + (polygon - centre) * factor


def region_polygons(landmarks, shrink=0.88):
    """Region name -> polygon in pixel coordinates, from a (478, 2) array of landmark pixels."""
    return {
        name: _shrink(np.asarray([landmarks[i] for i in indices], dtype=np.float32), shrink)
        for name, indices in REGIONS.items()
    }


def region_mask(landmarks, shape, shrink=0.88):
    """Boolean (height, width) mask that is True inside any sampling region."""
    mask = np.zeros(shape[:2], dtype=np.uint8)
    for polygon in region_polygons(landmarks, shrink).values():
        cv2.fillPoly(mask, [np.round(polygon).astype(np.int32)], 1)
    return mask.astype(bool)
