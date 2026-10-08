"""Entry point used by the scanner service. The algorithm lives in pipeline.py (skin tone v2)."""
import cv2
import numpy as np

from .pipeline import analyze_frame


def analyze_upload(image_buffer, detector, **options):
    """Decode an uploaded image and run the v2 pipeline on it (see pipeline.analyze_frame)."""
    data = np.frombuffer(image_buffer.read(), np.uint8)
    return analyze_frame(cv2.imdecode(data, cv2.IMREAD_COLOR), detector, **options)


def classify_skin_tone(image_buffer, detector):
    """Classify one uploaded frame. Keeps the v1 response keys and adds monk, undertone, ita, hue and lab."""
    return legacy_view(analyze_upload(image_buffer, detector))


def legacy_view(result):
    """Shape a pipeline result like the v1 per-frame dict that the API returns in all_frame_results."""
    if not result["ok"]:
        return {
            "tone": "Unknown" if result["reason"] == "unreadable" else "Rescan Required",
            "confidence": 0,
            "lighting_quality": result["lighting"],
            "brightness": result["brightness"],
            "message": result["message"],
            "reason": result["reason"],
        }

    return {
        "tone": result["depth"],
        "undertone": result["undertone"],
        "monk": result["monk"],
        "ita": result["ita"],
        "hue": result["hue"],
        "lab": result["lab"],
        "confidence": result["confidence"],
        "lighting_quality": result["lighting"],
        "brightness": result["brightness"],
        "message": f"{result['depth']} depth, {result['undertone']} undertone (Monk {result['monk']}).",
        "debug": {
            "skin_pixels": result["skin_pixels"],
            "monk_distance": result["monk_distance"],
            "white_balance": result["white_balance"],
        },
    }
