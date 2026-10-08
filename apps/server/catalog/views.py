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


# ---- categories and styles (dynamic, editable by staff) ----------------------------------------------------
from .models import Category, Style
from .selectors import get_categories, get_styles
from .serializers import CategorySerializer, StyleSerializer


class _TaxonomyListCreate(APIView):
    permission_classes = [IsStaffOrReadOnly]
    serializer_class = None
    key = ''

    def _rows(self, request):
        raise NotImplementedError

    def get(self, request):
        rows = self._rows(request)
        data = self.serializer_class(rows, many=True).data
        return Response({"status": "success", f"total_{self.key}": len(data), self.key: data})

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        if not serializer.is_valid():
            return Response({"status": "error", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response({"status": "success", self.key[:-1] if self.key.endswith('s') else self.key: serializer.data}, status=status.HTTP_201_CREATED)


class _TaxonomyDetail(APIView):
    permission_classes = [IsStaffOrReadOnly]
    model = None
    serializer_class = None
    label = ''

    def _row(self, row_id):
        return self.model.objects.filter(id=row_id).first()

    def put(self, request, row_id):
        row = self._row(row_id)
        if row is None:
            return Response({"status": "error", "message": f"{self.label} not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.serializer_class(row, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({"status": "error", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response({"status": "success", self.label.lower(): serializer.data})

    def delete(self, request, row_id):
        row = self._row(row_id)
        if row is None:
            return Response({"status": "error", "message": f"{self.label} not found"}, status=status.HTTP_404_NOT_FOUND)
        row.delete()
        return Response({"status": "success", "message": f"{self.label} deleted"})


class CategoryListCreateAPIView(_TaxonomyListCreate):
    serializer_class = CategorySerializer
    key = 'categories'

    def _rows(self, request):
        return get_categories(include_inactive=request.user.is_staff and request.query_params.get('all') == '1')


class CategoryDetailAPIView(_TaxonomyDetail):
    model, serializer_class, label = Category, CategorySerializer, 'Category'


class StyleListCreateAPIView(_TaxonomyListCreate):
    serializer_class = StyleSerializer
    key = 'styles'

    def _rows(self, request):
        return get_styles(include_inactive=request.user.is_staff and request.query_params.get('all') == '1')


class StyleDetailAPIView(_TaxonomyDetail):
    model, serializer_class, label = Style, StyleSerializer, 'Style'
