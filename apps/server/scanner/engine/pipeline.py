"""Skin tone v2: one frame in, depth, Monk number and undertone out. Pure Python, no Django.

What changed from v1 (bugs fixed on purpose):
- v1 ran gray-world white balance on the face crop itself, which pulls the skin average towards grey
  and erases the undertone. That is removed. Balancing from the background is available but OFF by
  default: on the one real portrait tried, a teal background moved the hue from 55 to 99 degrees, so
  it needs the labelled set (`evaluate_skin_tone --white-balance both`) to prove it helps.
- L* is never altered before measuring. v1 applied gamma and CLAHE first, which changed depth.
  Bad light is rejected with a retake prompt instead of being "corrected".
- Only the cheeks and forehead are sampled (MediaPipe landmarks), not a centre crop.
"""
import cv2
import numpy as np

from .regions import region_mask
from .skin import (
    bgr_to_lab, depth_from_ita, hue_degrees, ita_degrees, nearest_monk, trimmed_median_lab, undertone_from_hue,
)

MAX_WIDTH = 800
MIN_FACE_WIDTH_FRACTION = 0.15   # face narrower than this share of the frame: "move closer"
MIN_SKIN_PIXELS = 400
FULL_CONFIDENCE_PIXELS = 2500
WB_MIN_BACKGROUND_FRACTION = 0.15
WHITE_BALANCE_DEFAULT = False
WB_GAIN_LIMITS = (0.88, 1.14)     # keeps a coloured wall from turning the face blue or orange

# Lighting grades are judged on the face box. Starting values; tune on the labelled set.
L_P95_TOO_LOW = 15.0              # nearly black. Dim but readable faces are graded Low, not rejected
L_P95_LOW = 45.0
L_P95_NORMAL = 65.0
CLIPPED_TOO_BRIGHT = 0.15         # share of sampled pixels with a channel at 250 or more
# Lighting is judged on face luminance, so well-lit dark skin can grade "Low". The Low penalty is kept
# mild for that reason, and the evaluation report lists confidence per depth bucket to expose any bias.
LIGHTING_FACTOR = {"Good": 1.0, "Normal": 0.9, "Low": 0.85}
SINGLE_FRAME_FACTOR = 0.9         # one frame cannot show agreement, so it earns less confidence


def white_balance_gains(bgr, face_box):
    """Per-channel (B, G, R) gains from gray-world over the pixels outside the face box, or None."""
    x0, y0, x1, y1 = face_box
    keep = np.ones(bgr.shape[:2], dtype=bool)
    keep[y0:y1, x0:x1] = False
    if keep.mean() < WB_MIN_BACKGROUND_FRACTION:
        return None
    means = bgr[keep].reshape(-1, 3).mean(axis=0) + 1e-6
    gains = means.mean() / means
    return np.clip(gains, *WB_GAIN_LIMITS)


def _lighting_grade(face_lab_l, region_bgr):
    clipped = float((region_bgr.max(axis=1) >= 250).mean())
    p95 = float(np.percentile(face_lab_l, 95))
    if clipped > CLIPPED_TOO_BRIGHT:
        return "Too Bright"
    if p95 < L_P95_TOO_LOW:
        return "Too Low"
    if p95 < L_P95_LOW:
        return "Low"
    return "Normal" if p95 < L_P95_NORMAL else "Good"


def _fail(reason, message, lighting="Unknown", brightness=0.0):
    return {"ok": False, "reason": reason, "message": message, "lighting": lighting, "brightness": round(brightness, 2)}


def analyze_frame(bgr, detector, *, white_balance=WHITE_BALANCE_DEFAULT):
    """Analyse one BGR frame. Returns {"ok": True, ...measurements} or {"ok": False, "reason", "message", ...}."""
    if bgr is None:
        return _fail("unreadable", "Image could not be processed.")
    if bgr.shape[1] > MAX_WIDTH:
        scale = MAX_WIDTH / bgr.shape[1]
        bgr = cv2.resize(bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    height, width = bgr.shape[:2]

    landmarks = detector.detect(bgr)
    if landmarks is None:
        return _fail("no_face", "No face found. Face the camera, keep your face in the frame and scan again.")
    x0, y0 = np.maximum(landmarks.min(axis=0), 0).astype(int)
    x1, y1 = np.minimum(landmarks.max(axis=0), [width, height]).astype(int)
    if (x1 - x0) / width < MIN_FACE_WIDTH_FRACTION:
        return _fail("face_too_small", "Your face is too small in the frame. Move closer and scan again.")

    brightness = float(cv2.cvtColor(bgr[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY).mean())
    balanced = bgr
    if white_balance:
        gains = white_balance_gains(bgr, (x0, y0, x1, y1))
        if gains is not None:
            balanced = np.clip(bgr.astype(np.float32) * gains, 0, 255).astype(np.uint8)

    mask = region_mask(landmarks, bgr.shape)
    region = balanced[mask]
    if len(region) < MIN_SKIN_PIXELS:
        return _fail("few_pixels", "Skin area was not detected clearly. Face the camera and scan again.", brightness=brightness)

    face_l = bgr_to_lab(balanced[y0:y1, x0:x1].reshape(-1, 3))[:, 0]
    lighting = _lighting_grade(face_l, bgr[mask])
    if lighting == "Too Low":
        return _fail("too_dark", "Lighting is too low to read your skin tone. Scan again in brighter light.", lighting, brightness)
    if lighting == "Too Bright":
        return _fail("too_bright", "Your face is overexposed. Scan again in softer, normal light.", lighting, brightness)

    lab = trimmed_median_lab(bgr_to_lab(region))
    ita, hue = ita_degrees(lab), hue_degrees(lab)
    monk, monk_distance = nearest_monk(lab)
    confidence = 100.0 * min(1.0, len(region) / FULL_CONFIDENCE_PIXELS) * LIGHTING_FACTOR[lighting]
    return {
        "ok": True,
        "depth": depth_from_ita(ita),
        "undertone": undertone_from_hue(hue),
        "monk": monk,
        "monk_distance": round(monk_distance, 2),
        "ita": round(ita, 2),
        "hue": round(hue, 2),
        "lab": [round(float(v), 2) for v in lab],
        "skin_pixels": int(len(region)),
        "lighting": lighting,
        "brightness": round(brightness, 2),
        "confidence": round(confidence, 1),
        "white_balance": bool(white_balance),
    }


def consensus(results):
    """Combine per-frame results. Returns the final reading, or None when no frame was usable.

    The depth bucket chosen is the most common one. Agreement is the share of usable frames that match it,
    and the final confidence is the mean frame confidence of the matching frames times that agreement.
    ITA, hue, Lab and so Monk and undertone come from the median of the matching frames.
    """
    usable = [r for r in results if r.get("ok")]
    if not usable:
        return None
    buckets = {}
    for result in usable:
        buckets.setdefault(result["depth"], []).append(result)
    depth, agreeing = max(buckets.items(), key=lambda item: (len(item[1]), sum(r["confidence"] for r in item[1])))
    agreement = len(agreeing) / len(usable)
    if len(usable) == 1:
        agreement = SINGLE_FRAME_FACTOR

    lab = np.median([r["lab"] for r in agreeing], axis=0)
    ita, hue = ita_degrees(lab), hue_degrees(lab)
    monk, monk_distance = nearest_monk(lab)
    best = max(agreeing, key=lambda r: r["confidence"])
    confidence = float(np.mean([r["confidence"] for r in agreeing])) * agreement
    return {
        "depth": depth,
        "undertone": undertone_from_hue(hue),
        "monk": monk,
        "monk_distance": round(monk_distance, 2),
        "ita": round(ita, 2),
        "hue": round(hue, 2),
        "lab": [round(float(v), 2) for v in lab],
        "lighting": best["lighting"],
        "brightness": best["brightness"],
        "confidence": round(confidence, 1),
        "frames_used": len(usable),
        "frames_agreeing": len(agreeing),
        "agreement": round(agreement, 2),
    }
