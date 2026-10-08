from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .selectors import get_products, get_product
from .services import create_product, update_product, delete_product
from .serializers import ProductSerializer
from core.permissions import IsStaffOrReadOnly

class ProductListCreateAPIView(APIView):
    permission_classes = [IsStaffOrReadOnly]

    def get(self, request):
        products = get_products(include_drafts=request.user.is_staff)
        serializer = ProductSerializer(products, many=True, context={'request': request})
        return Response({"status": "success", "total_products": products.count(), "products": serializer.data}, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = ProductSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            product = create_product(serializer)
            return Response({"status": "success", "message": "Product created successfully", "product": ProductSerializer(product, context={'request': request}).data}, status=status.HTTP_201_CREATED)
        return Response({"status": "error", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

class ProductDetailAPIView(APIView):
    permission_classes = [IsStaffOrReadOnly]

    def get(self, request, product_id):
        product = get_product(product_id, include_drafts=request.user.is_staff)
        if product is None:
            return Response({"status": "error", "message": "Product not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = ProductSerializer(product, context={'request': request})
        return Response({"status": "success", "product": serializer.data}, status=status.HTTP_200_OK)

    def put(self, request, product_id):
        product = get_product(product_id, include_drafts=True)
        if product is None:
            return Response({"status": "error", "message": "Product not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = ProductSerializer(product, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            updated_product = update_product(serializer)
            return Response({"status": "success", "message": "Product updated successfully", "product": ProductSerializer(updated_product, context={'request': request}).data}, status=status.HTTP_200_OK)
        return Response({"status": "error", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, product_id):
        product = get_product(product_id, include_drafts=True)
        if product is None:
            return Response({"status": "error", "message": "Product not found"}, status=status.HTTP_404_NOT_FOUND)
        delete_product(product)
        return Response({"status": "success", "message": "Product deleted successfully"}, status=status.HTTP_200_OK)
