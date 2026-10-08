from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from catalog.models import Product
from catalog.serializers import ProductSerializer
from .selectors import get_curated_recommendations
from .services import generate_outfit_for_product

class CuratedRecommendationAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        target_tone = request.query_params.get('tone', 'Medium')
        target_culture = request.query_params.get('style', 'Western')
        filtered_products = get_curated_recommendations(target_tone, target_culture)
        serializer = ProductSerializer(filtered_products, many=True, context={'request': request})
        return Response({
            "status": "success",
            "target_tone": target_tone,
            "target_style": target_culture,
            "total_items": len(serializer.data),
            "curated_items": serializer.data
        }, status=status.HTTP_200_OK)

class OutfitGenerationAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        product_id = request.query_params.get('product_id')
        if not product_id:
            return Response({"status": "error", "message": "product_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            main_product = Product.objects.get(id=product_id)
        except Product.DoesNotExist:
            return Response({"status": "error", "message": "Main product not found"}, status=status.HTTP_404_NOT_FOUND)

        outfit = generate_outfit_for_product(main_product)

        return Response({
            "status": "success",
            "message": "Smart outfit generated successfully",
            "main_item": ProductSerializer(main_product, context={'request': request}).data,
            "outfit": {
                "shirt": ProductSerializer(outfit["shirt"], context={'request': request}).data if outfit["shirt"] else None,
                "pant": ProductSerializer(outfit["pant"], context={'request': request}).data if outfit["pant"] else None,
                "shoes": ProductSerializer(outfit["shoes"], context={'request': request}).data if outfit["shoes"] else None,
                "accessory": ProductSerializer(outfit["accessory"], context={'request': request}).data if outfit["accessory"] else None,
                "coat_or_jacket": ProductSerializer(outfit["coat_or_jacket"], context={'request': request}).data if outfit["coat_or_jacket"] else None,
            }
        }, status=status.HTTP_200_OK)


# ---- phase 4 --------------------------------------------------------------------------------------------
from rest_framework.permissions import AllowAny as _AllowAny

from core.permissions import IsStaffOrReadOnly
from .models import ToneColorRule
from .selectors import get_palette_rules
from .serializers import ToneColorRuleSerializer
from .services import build_look, palette_for, top_picks
from .adapter import build_profile


def _context(profile):
    return {"depth": profile.depth, "undertone": profile.undertone, "gender": profile.gender, "styles": list(profile.styles)}


def _palette_body(palette):
    return {"best": palette.best(8), "avoid": palette.avoid(3)}


def _product_json(product, request):
    return ProductSerializer(product, context={'request': request}).data


class TopPicksAPIView(APIView):
    """Ranked picks (up to 15) for a shopper: query parameters depth, undertone, gender, style, size, limit."""
    permission_classes = [_AllowAny]

    def get(self, request):
        limit = min(max(int(request.query_params.get('limit', 15) or 15), 1), 30)
        profile, palette, results = top_picks(request.user, request.query_params, limit=limit)
        items = [
            {**_product_json(row['product'], request), "score": row["score"], "match": row["match"],
             "reason": row["reason"], "matched_colour": row["colour"]}
            for row in results
        ]
        return Response({
            "status": "success", "context": _context(profile), "palette": _palette_body(palette),
            "total_items": len(items), "items": items,
        })


class CompleteLookAPIView(APIView):
    """A full look around product_id: one pick and two swaps per slot."""
    permission_classes = [_AllowAny]

    def get(self, request):
        product_id = request.query_params.get('product_id')
        if not product_id or not product_id.isdigit():
            return Response({"status": "error", "message": "product_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        product = Product.objects.exclude(status='Draft').filter(id=int(product_id)).first()
        if product is None:
            return Response({"status": "error", "message": "Main product not found"}, status=status.HTTP_404_NOT_FOUND)

        profile, palette, look = build_look(request.user, request.query_params, product)

        def entry(row):
            return {**_product_json(row['product'], request), "score": row["score"], "why": row["why"]}

        slots = [
            {"slot": s["slot"], "kind": s["kind"], "required": s["required"],
             "pick": entry(s["pick"]) if s["pick"] else None, "swaps": [entry(w) for w in s["swaps"]]}
            for s in look["slots"]
        ]
        return Response({
            "status": "success", "look_type": look["look_type"], "gender": look["gender"],
            "complete": look["complete"], "missing": look["missing"],
            "context": _context(profile), "anchor": _product_json(product, request), "slots": slots,
        })


class PaletteAPIView(APIView):
    """Best and avoid colours for a depth and undertone (used by the scan result card)."""
    permission_classes = [_AllowAny]

    def get(self, request):
        profile = build_profile(request.user, request.query_params)
        return Response({"status": "success", "context": _context(profile), **_palette_body(palette_for(profile))})


class ToneRuleListCreateAPIView(APIView):
    permission_classes = [IsStaffOrReadOnly]

    def get(self, request):
        rules = ToneColorRule.objects.all()
        for field in ('depth', 'undertone'):
            if request.query_params.get(field):
                rules = rules.filter(**{field: request.query_params[field]})
        return Response({"status": "success", "total_rules": rules.count(), "rules": ToneColorRuleSerializer(rules, many=True).data})

    def post(self, request):
        serializer = ToneColorRuleSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"status": "error", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response({"status": "success", "rule": serializer.data}, status=status.HTTP_201_CREATED)


class ToneRuleDetailAPIView(APIView):
    permission_classes = [IsStaffOrReadOnly]

    def _rule(self, rule_id):
        return ToneColorRule.objects.filter(id=rule_id).first()

    def get(self, request, rule_id):
        rule = self._rule(rule_id)
        if rule is None:
            return Response({"status": "error", "message": "Rule not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"status": "success", "rule": ToneColorRuleSerializer(rule).data})

    def put(self, request, rule_id):
        rule = self._rule(rule_id)
        if rule is None:
            return Response({"status": "error", "message": "Rule not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = ToneColorRuleSerializer(rule, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({"status": "error", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response({"status": "success", "rule": serializer.data})

    def delete(self, request, rule_id):
        rule = self._rule(rule_id)
        if rule is None:
            return Response({"status": "error", "message": "Rule not found"}, status=status.HTTP_404_NOT_FOUND)
        rule.delete()
        return Response({"status": "success", "message": "Rule deleted"})
