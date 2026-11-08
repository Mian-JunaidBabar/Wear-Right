from functools import lru_cache

from django.conf import settings
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .alpha_selectors import get_alpha_wardrobe, get_staff_layers
from .alpha_services import MANIFEST_SLOTS, add_layer_from_upload, set_layer_approved
from .models import MannequinLayer, Product


class AlphaWardrobeAPIView(APIView):
    """GET /api/mannequin/alpha/?gender=men: base photo and approved garment layers for the dressing room."""
    permission_classes = [AllowAny]

    def get(self, request):
        gender = (request.query_params.get('gender') or 'men').strip().lower()
        if gender not in ('men', 'women'):
            return Response({"status": "error", "message": "gender must be men or women"}, status=400)
        return Response({"status": "success", **get_alpha_wardrobe(gender=gender)})


@lru_cache(maxsize=1)
def get_segmenter():
    """The cloth model, loaded once per process (a few seconds the first time)."""
    from .engine.cutout import cloth_segmenter
    return cloth_segmenter(model_dir=settings.ML_MODELS_DIR / "rembg")


class MannequinLayerListAPIView(APIView):
    """Admin Mannequin page.

    Mounted for the admin panel at /api/admin/mannequin/layers/ (staff/views.py adds the admin cookie and RBAC).
    GET  ?gender=   every layer with its checks, and the base photos
    POST            multipart: product_id, slot, render, [render_fair], [render_dark],
                                                [gender]; cuts the render(s) onto the base like the kit import
    """
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        gender = (request.query_params.get('gender') or '').strip().lower() or None
        return Response({"status": "success", **get_staff_layers(gender=gender)})

    def post(self, request):
        data, files = request.data, request.FILES
        slot = (data.get('slot') or '').strip().lower()
        if slot not in MANIFEST_SLOTS:
            return Response({"status": "error", "message": f"slot must be one of {', '.join(sorted(MANIFEST_SLOTS))}"}, status=400)
        product = Product.objects.filter(pk=data.get('product_id') or 0).first()
        if product is None:
            return Response({"status": "error", "message": "product not found"}, status=404)
        uploads = {skin: files[key] for skin, key in (("wheatish", "render"), ("fair", "render_fair"), ("dark", "render_dark")) if key in files}
        try:
            row = add_layer_from_upload(
                product=product, slot=slot, uploads=uploads, segment=get_segmenter(),
                gender=(data.get('gender') or '').strip().lower() or None,
            )
        except ValueError as exc:
            return Response({"status": "error", "message": str(exc)}, status=400)
        code = 201 if row.outcome == "approved" else 422
        return Response({
            "status": "success" if code == 201 else "rejected",
            "outcome": row.outcome, "reason": row.reason, "skins": row.skins, "report": row.report,
        }, status=code)


class MannequinLayerDetailAPIView(APIView):
    """PATCH {approved} to show / hide a layer in the dressing room; DELETE to remove it."""
    permission_classes = [IsAdminUser]

    def patch(self, request, layer_id):
        layer = MannequinLayer.objects.filter(pk=layer_id).first()
        if layer is None:
            return Response({"status": "error", "message": "layer not found"}, status=404)
        approved = request.data.get('approved')
        if not isinstance(approved, bool):
            return Response({"status": "error", "message": "approved must be true or false"}, status=400)
        set_layer_approved(layer=layer, approved=approved)
        return Response({"status": "success", "id": layer.id, "approved": layer.approved})

    def delete(self, request, layer_id):
        layer = MannequinLayer.objects.filter(pk=layer_id).first()
        if layer is None:
            return Response({"status": "error", "message": "layer not found"}, status=404)
        for field in (layer.image, layer.image_fair, layer.image_dark):
            if field:
                field.delete(save=False)
        layer.delete()
        return Response(status=204)
