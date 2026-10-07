from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .selectors import get_face_scan_records
from .services import analyze_face_images
from .serializers import FaceScanRecordSerializer

class FaceScannerAPIView(APIView):
    def post(self, request, *args, **kwargs):
        uploaded_images = request.FILES.getlist('images')
        if not uploaded_images and 'image' in request.FILES:
            uploaded_images = [request.FILES['image']]
        if not uploaded_images:
            return Response({"error": "No image frame provided"}, status=status.HTTP_400_BAD_REQUEST)

        result = analyze_face_images(uploaded_images)
        # return same shape as original
        if not result["success"]:
            return Response({
                "status": "failed",
                "detected_skin_tone": result["detected_skin_tone"],
                "confidence_score": result["confidence_score"],
                "lighting_quality": result["lighting_quality"],
                "brightness": result["brightness"],
                "message": result["message"],
                "all_frame_results": result["all_frame_results"]
            }, status=status.HTTP_200_OK)
        
        return Response({
            "status": "success",
            "detected_skin_tone": result["detected_skin_tone"],
            "confidence_score": result["confidence_score"],
            "lighting_quality": result["lighting_quality"],
            "brightness": result["brightness"],
            "message": result["message"],
            "selected_frame_debug": result["selected_frame_debug"],
            "total_frames_analyzed": result["total_frames_analyzed"],
            "all_frame_results": result["all_frame_results"]
        }, status=status.HTTP_200_OK)

class FaceScanRecordListAPIView(APIView):
    def get(self, request):
        records = get_face_scan_records()
        serializer = FaceScanRecordSerializer(records, many=True)
        return Response({"status": "success", "total_records": records.count(), "face_scan_records": serializer.data}, status=status.HTTP_200_OK)
