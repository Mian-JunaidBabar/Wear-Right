from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .alpha_selectors import get_alpha_wardrobe


class AlphaWardrobeAPIView(APIView):
    """GET /api/mannequin/alpha/?gender=men: base photo and approved garment layers for the dressing room."""
    permission_classes = [AllowAny]

    def get(self, request):
        gender = (request.query_params.get('gender') or 'men').strip().lower()
        if gender not in ('men', 'women'):
            return Response({"status": "error", "message": "gender must be men or women"}, status=400)
        return Response({"status": "success", **get_alpha_wardrobe(gender=gender)})
