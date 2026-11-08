"""Photo quality gate for the skin-tone scan: is this photo good enough to read skin colour from?

The colour maths (skin.py) is only as good as the light. A yellow bulb, a blurry frame, light from one side or
a turned head gives a confident but wrong tone, so these checks run before measuring:

    cast        colour of the light, from near-neutral pixels around the face (white wall, white shirt, paper)
    blur        Laplacian variance of the face crop (warning only by default)
    side_light  brightness of the left cheek against the right cheek
    pose        head turn, from where the nose tip sits between the face edges

Each check is pass / warn / fail. Any fail rejects the photo with that check's message. Each warn lowers the
confidence. Exposure (too dark / too bright) is graded in pipeline.py and is not repeated here.

All thresholds are in THRESHOLDS (starting values, to be tuned on the labelled set with
`evaluate_skin_tone`). A caller can pass overrides, e.g. from Django settings. Pure: NumPy and OpenCV only.
"""
from __future__ import annotations

import cv2
import numpy as np

from .regions import region_polygons
from .skin import bgr_to_lab

THRESHOLDS = {
    # cast: median a*/b* of near-neutral reference pixels (OpenCV-independent CIELAB, a*/b* centred on 0)
    "neutral_min_l": 60.0,          # reference pixels must be at least this light
    "neutral_max_chroma": 35.0,     # ... and this close to grey (a white wall under a yellow bulb is ~b* 20-30)
    "neutral_min_share": 0.02,      # need at least this share of the frame as reference, else "unknown"
    "cast_b_warm_warn": 12.0, "cast_b_warm_fail": 20.0,     # yellow/orange light (bulbs)
    "cast_b_cool_warn": -8.0, "cast_b_cool_fail": -14.0,    # blue light (screens, shade)
    "cast_a_warn": 10.0, "cast_a_fail": 16.0,               # pink or green light
    # blur: Laplacian variance of the grey face crop resized to 256 px wide. A sharp real face scored ~210 and
    # the same face blurred ~2 in our check, so 20 separates them. Blur barely moves a median cheek colour, so it
    # only warns (lowers confidence); set blur_fail above 0 to make it reject.
    "blur_fail": 0.0, "blur_warn": 20.0,
    # side light: difference in median L* between the two cheeks
    "side_warn": 12.0, "side_fail": 20.0,
    # pose: nose tip offset from the middle of the face, as a share of face width
    "yaw_warn": 0.12, "yaw_fail": 0.20,
    # confidence multiplier per warning
    "warn_factor": 0.85,
}

MESSAGES = {
    "cast_warm": "Your light looks yellow. Face a window in daylight, away from bulbs, and scan again.",
    "cast_cool": "Your light looks blue. Move to daylight away from screens and scan again.",
    "cast_tint": "Your light has a colour tint. Use plain daylight and scan again.",
    "cast_unknown": "We could not check the colour of your light. Daylight in front of a plain light wall works best.",
    "blur": "The photo is blurry. Hold the phone still and scan again.",
    "side_light": "Light is coming from one side. Face the window so both cheeks are evenly lit.",
    "pose": "Look straight at the camera and scan again.",
}

NOSE_TIP, FACE_LEFT, FACE_RIGHT = 1, 234, 454


def _check(key, status, value, message=""):
    return {"key": key, "status": status, "value": None if value is None else round(float(value), 2), "message": message}


def colour_cast(bgr, face_box, t):
    """(a*, b*, share) of near-neutral pixels outside the face box, or (None, None, share) when too few."""
    x0, y0, x1, y1 = face_box
    keep = np.ones(bgr.shape[:2], dtype=bool)
    keep[max(0, y0):y1, max(0, x0):x1] = False
    lab = bgr_to_lab(bgr[keep].reshape(-1, 3))
    chroma = np.sqrt(lab[:, 1] ** 2 + lab[:, 2] ** 2)
    neutral = (lab[:, 0] > t["neutral_min_l"]) & (chroma < t["neutral_max_chroma"])
    share = float(neutral.sum()) / max(1, bgr.shape[0] * bgr.shape[1])
    if share < t["neutral_min_share"]:
        return None, None, share
    return float(np.median(lab[neutral, 1])), float(np.median(lab[neutral, 2])), share


def blur_score(bgr, face_box):
    x0, y0, x1, y1 = face_box
    crop = cv2.cvtColor(bgr[max(0, y0):y1, max(0, x0):x1], cv2.COLOR_BGR2GRAY)
    if crop.size == 0:
        return 0.0
    scale = 256 / max(1, crop.shape[1])
    crop = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    return float(cv2.Laplacian(crop, cv2.CV_64F).var())


def cheek_difference(bgr, landmarks):
    """Absolute difference in median L* between the left and right cheek regions."""
    polygons = region_polygons(landmarks)
    medians = []
    for name in ("left_cheek", "right_cheek"):
        mask = np.zeros(bgr.shape[:2], dtype=np.uint8)
        cv2.fillPoly(mask, [np.round(polygons[name]).astype(np.int32)], 1)
        pixels = bgr[mask.astype(bool)]
        if len(pixels) < 20:
            return None
        medians.append(float(np.median(bgr_to_lab(pixels)[:, 0])))
    return abs(medians[0] - medians[1])


def yaw_ratio(landmarks):
    left, right, nose = landmarks[FACE_LEFT], landmarks[FACE_RIGHT], landmarks[NOSE_TIP]
    width = abs(right[0] - left[0])
    if width < 1:
        return None
    return abs(nose[0] - (left[0] + right[0]) / 2) / width


def _grade(value, warn, fail, higher_is_worse=True):
    if value is None:
        return "pass"
    if higher_is_worse:
        return "fail" if value > fail else "warn" if value > warn else "pass"
    return "fail" if value < fail else "warn" if value < warn else "pass"


def check_quality(bgr, landmarks, face_box, thresholds=None):
    """Run every check. Returns {"ok", "checks", "confidence_factor", "failed"}; `failed` is the first fail or None."""
    t = {**THRESHOLDS, **(thresholds or {})}
    checks = []

    a, b, share = colour_cast(bgr, face_box, t)
    if b is None:
        checks.append(_check("cast", "warn", share, MESSAGES["cast_unknown"]))
    else:
        if b > t["cast_b_warm_warn"]:
            status, message = ("fail" if b > t["cast_b_warm_fail"] else "warn"), MESSAGES["cast_warm"]
        elif b < t["cast_b_cool_warn"]:
            status, message = ("fail" if b < t["cast_b_cool_fail"] else "warn"), MESSAGES["cast_cool"]
        elif abs(a) > t["cast_a_warn"]:
            status, message = ("fail" if abs(a) > t["cast_a_fail"] else "warn"), MESSAGES["cast_tint"]
        else:
            status, message = "pass", ""
        checks.append(_check("cast", status, b if abs(b) >= abs(a) else a, message))

    blur = blur_score(bgr, face_box)
    status = _grade(blur, t["blur_warn"], t["blur_fail"], higher_is_worse=False)
    checks.append(_check("blur", status, blur, MESSAGES["blur"] if status != "pass" else ""))

    side = cheek_difference(bgr, landmarks)
    status = _grade(side, t["side_warn"], t["side_fail"])
    checks.append(_check("side_light", status, side, MESSAGES["side_light"] if status != "pass" else ""))

    yaw = yaw_ratio(landmarks)
    status = _grade(yaw, t["yaw_warn"], t["yaw_fail"])
    checks.append(_check("pose", status, yaw, MESSAGES["pose"] if status != "pass" else ""))

    failed = next((check for check in checks if check["status"] == "fail"), None)
    warnings = sum(1 for check in checks if check["status"] == "warn")
    return {
        "ok": failed is None,
        "checks": checks,
        "confidence_factor": round(t["warn_factor"] ** warnings, 3),
        "failed": failed,
    }
