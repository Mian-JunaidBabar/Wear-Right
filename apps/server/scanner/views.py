from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .selectors import get_face_scan_records
from .services import ScannerUnavailable, analyze_face_images, _record_scan
from .serializers import FaceScanRecordSerializer

class FaceScannerAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        uploaded_images = request.FILES.getlist('images')
        if not uploaded_images and 'image' in request.FILES:
            uploaded_images = [request.FILES['image']]
        if not uploaded_images:
            return Response({"error": "No image frame provided"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = analyze_face_images(uploaded_images, user=request.user)
        except ScannerUnavailable as exc:
            return Response({"status": "error", "message": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        # return same shape as original
        if not result["success"]:
            # 422 is the standard API failure for "the photo could not be read"; the legacy fields are
            # kept so the current scanner UI can still show its retry message, and the manual picker follows.
            return Response({
                "error": {"code": "no_face", "message": result["message"], "details": {"reason": result["reason"]}},
                "status": "failed",
                "detected_skin_tone": result["detected_skin_tone"],
                "confidence_score": result["confidence_score"],
                "lighting_quality": result["lighting_quality"],
                "brightness": result["brightness"],
                "message": result["message"],
                "reason": result["reason"],
                "all_frame_results": result["all_frame_results"]
            }, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        depth, undertone = result["detected_skin_tone"], result["undertone"]
        return Response({
            "status": "success",
            "depth": depth,
            "detected_skin_tone": depth,
            "undertone": undertone,
            "confidence": result["confidence_score"],
            "confidence_score": result["confidence_score"],
            "lighting_quality": result["lighting_quality"],
            "brightness": result["brightness"],
            "message": result["message"],
            "monk": result["monk"],
            "ita": result["ita"],
            "hue": result["hue"],
            "agreement": result["agreement"],
            "selected_frame_debug": result["selected_frame_debug"],
            "total_frames_analyzed": result["total_frames_analyzed"],
            "all_frame_results": result["all_frame_results"],
            "palette": _palette(depth, undertone),
        }, status=status.HTTP_200_OK)

def _palette(depth, undertone):
    """Best/avoid colours for a scan result, from the same tone rules the recommender uses."""
    from recommender.adapter import build_profile
    from recommender.services import palette_for
    palette = palette_for(build_profile(None, {'depth': depth, 'undertone': undertone}))
    return {"best": palette.best(8), "avoid": palette.avoid(3)}


class ManualToneAPIView(APIView):
    """Set a tone by hand when a camera or detection is unavailable. The flow never depends on a face."""
    permission_classes = [AllowAny]

    def post(self, request):
        depth = str(request.data.get('depth') or '').strip().capitalize()
        undertone = str(request.data.get('undertone') or '').strip().lower()
        if depth not in ('Fair', 'Medium', 'Dark'):
            return Response({"status": "error", "message": "Choose Fair, Medium or Dark."}, status=status.HTTP_400_BAD_REQUEST)
        if undertone not in ('warm', 'cool', 'neutral'):
            return Response({"status": "error", "message": "Choose a warm, cool or neutral undertone."}, status=status.HTTP_400_BAD_REQUEST)
        _record_scan(request.user, detected_skin_tone=depth, confidence_score=100, lighting_quality='Manual', brightness=0, undertone=undertone)
        if request.user is not None and request.user.is_authenticated:
            from accounts.services import save_scan_result
            save_scan_result(request.user, depth=depth, monk=0, undertone=undertone)
        return Response({
            "status": "success", "depth": depth, "detected_skin_tone": depth,
            "undertone": undertone, "confidence": 100, "confidence_score": 100,
            "palette": _palette(depth, undertone), "message": f"{depth} depth, {undertone} undertone (entered by hand).",
        })


class FaceScanRecordListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        records = get_face_scan_records(request.user)
        serializer = FaceScanRecordSerializer(records, many=True)
        return Response({"status": "success", "total_records": records.count(), "face_scan_records": serializer.data}, status=status.HTTP_200_OK)
