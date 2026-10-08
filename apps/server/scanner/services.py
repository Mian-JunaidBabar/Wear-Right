from django.conf import settings

from accounts.services import save_scan_result

from .engine.landmarks import FaceDetector
from .engine.pipeline import consensus
from .engine.skin_tone import analyze_upload, legacy_view
from .models import FaceScanRecord

_detector = None


class ScannerUnavailable(Exception):
    """The face model file is missing. Run `make models`."""


def get_detector():
    """One shared MediaPipe detector per process (loading the model per request would be slow)."""
    global _detector
    if _detector is None:
        model_path = settings.ML_MODELS_DIR / "face_landmarker.task"
        if not model_path.exists():
            raise ScannerUnavailable(f"Face model not found at {model_path}. Run `make models`.")
        _detector = FaceDetector(model_path)
    return _detector


def _record_scan(user, **fields):
    """Store a scan only for signed-in users; guests may scan but nothing is saved. The photo is never stored."""
    if user is None or not user.is_authenticated:
        return None
    return FaceScanRecord.objects.create(
        user=user,
        visitor_name=user.get_full_name() or user.email or user.username,
        **fields,
    )


def analyze_face_images(uploaded_images, user=None, detector=None):
    detector = detector or get_detector()
    frames = [analyze_upload(image, detector) for image in uploaded_images]
    all_frame_results = [legacy_view(frame) for frame in frames]
    final = consensus(frames)

    if final is None:
        failure = frames[0]
        _record_scan(
            user,
            detected_skin_tone="Rescan Required",
            confidence_score=0,
            lighting_quality=failure["lighting"],
            brightness=failure["brightness"],
        )
        return {
            "success": False,
            "detected_skin_tone": "Rescan Required",
            "confidence_score": 0,
            "lighting_quality": failure["lighting"],
            "brightness": failure["brightness"],
            "message": failure["message"],
            "reason": failure["reason"],
            "all_frame_results": all_frame_results,
        }

    _record_scan(
        user,
        detected_skin_tone=final["depth"],
        confidence_score=final["confidence"],
        lighting_quality=final["lighting"],
        brightness=final["brightness"],
        monk=final["monk"],
        undertone=final["undertone"],
        ita=final["ita"],
        hue=final["hue"],
    )
    if user is not None and user.is_authenticated:
        save_scan_result(user, depth=final["depth"], monk=final["monk"], undertone=final["undertone"])

    return {
        "success": True,
        "detected_skin_tone": final["depth"],
        "confidence_score": final["confidence"],
        "lighting_quality": final["lighting"],
        "brightness": final["brightness"],
        "message": f"{final['depth']} depth, {final['undertone']} undertone (Monk {final['monk']}).",
        "monk": final["monk"],
        "undertone": final["undertone"],
        "ita": final["ita"],
        "hue": final["hue"],
        "agreement": final["agreement"],
        "selected_frame_debug": {
            "frames_used": final["frames_used"],
            "frames_agreeing": final["frames_agreeing"],
            "lab": final["lab"],
            "monk_distance": final["monk_distance"],
        },
        "total_frames_analyzed": len(frames),
        "all_frame_results": all_frame_results,
    }
