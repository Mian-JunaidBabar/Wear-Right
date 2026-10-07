from .engine.skin_tone import classify_skin_tone
from .models import FaceScanRecord

def _record_scan(user, **fields):
    """Store a scan only for signed-in users; guests may scan but nothing is saved."""
    if user is None or not user.is_authenticated:
        return None
    return FaceScanRecord.objects.create(
        user=user,
        visitor_name=user.get_full_name() or user.email or user.username,
        **fields,
    )


def analyze_face_images(uploaded_images, user=None):
    analysis_results = []
    for uploaded_image in uploaded_images:
        result = classify_skin_tone(uploaded_image)
        analysis_results.append(result)

    reliable_results = [
        result for result in analysis_results
        if result.get("tone") not in ["Rescan Required", "Unknown"]
        and result.get("confidence", 0) > 0
    ]

    if not reliable_results:
        best_failed_result = analysis_results[0]
        _record_scan(
            user,
            detected_skin_tone="Rescan Required",
            confidence_score=0,
            lighting_quality=best_failed_result.get("lighting_quality", "Unknown"),
            brightness=best_failed_result.get("brightness", 0),
        )
        return {
            "success": False,
            "detected_skin_tone": "Rescan Required",
            "confidence_score": 0,
            "lighting_quality": best_failed_result.get("lighting_quality", "Unknown"),
            "brightness": best_failed_result.get("brightness", 0),
            "message": "All captured frames had unsuitable lighting. Please scan again in better light and keep your face centered.",
            "all_frame_results": analysis_results
        }

    def result_score(result):
        confidence = result.get("confidence", 0)
        lighting = result.get("lighting_quality", "")
        lighting_bonus = {"Good": 20, "Normal": 12, "Low": 2}.get(lighting, 0)
        return confidence + lighting_bonus

    best_result = max(reliable_results, key=result_score)

    _record_scan(
        user,
        detected_skin_tone=best_result["tone"],
        confidence_score=best_result["confidence"],
        lighting_quality=best_result["lighting_quality"],
        brightness=best_result["brightness"],
    )

    return {
        "success": True,
        "detected_skin_tone": best_result["tone"],
        "confidence_score": best_result["confidence"],
        "lighting_quality": best_result["lighting_quality"],
        "brightness": best_result["brightness"],
        "message": best_result["message"],
        "selected_frame_debug": best_result.get("debug", {}),
        "total_frames_analyzed": len(analysis_results),
        "all_frame_results": analysis_results
    }
