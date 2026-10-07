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
