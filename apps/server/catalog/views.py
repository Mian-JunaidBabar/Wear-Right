from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsStaffOrReadOnly
from .models import Category, Color, Style
from .selectors import filter_products, get_categories, get_colors, get_product, get_products, get_styles
from .serializers import (
    CategorySerializer, ColorSerializer, MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES,
    ProductSerializer, StyleSerializer,
)
from .services import create_product, delete_product, suggest_colour, update_product


class ProductPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = 'page_size'
    max_page_size = 500
    page_query_param = 'page'


class ProductListCreateAPIView(APIView):
    permission_classes = [IsStaffOrReadOnly]

    def get(self, request):
        products = filter_products(get_products(include_drafts=request.user.is_staff), request.query_params)
        paginator = ProductPagination()
        page = paginator.paginate_queryset(products, request, view=self)
        serializer = ProductSerializer(page, many=True, context={'request': request})
        # Both the pagination contract and the original keys are returned so the shop keeps working
        # while clients move to page/count/results.
        return Response({
            "status": "success",
            "count": paginator.page.paginator.count,
            "next": paginator.get_next_link(),
            "previous": paginator.get_previous_link(),
            "page": paginator.page.number,
            "page_size": paginator.get_page_size(request),
            "total_pages": paginator.page.paginator.num_pages,
            "total_products": paginator.page.paginator.count,
            "products": serializer.data,
            "results": serializer.data,
        }, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = ProductSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            product = create_product(serializer)
            body = {
                "status": "success", "message": "Product created successfully",
                "product": ProductSerializer(product, context={'request': request}).data,
            }
            if product.image:
                try:
                    body["color_suggestion"] = suggest_colour(product.image)
                except Exception:
                    body["color_suggestion"] = None
            return Response(body, status=status.HTTP_201_CREATED)
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
            body = {
                "status": "success", "message": "Product updated successfully",
                "product": ProductSerializer(updated_product, context={'request': request}).data,
            }
            if updated_product.image and 'image' in request.FILES:
                try:
                    body["color_suggestion"] = suggest_colour(updated_product.image)
                except Exception:
                    body["color_suggestion"] = None
            return Response(body, status=status.HTTP_200_OK)
        return Response({"status": "error", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, product_id):
        product = get_product(product_id, include_drafts=True)
        if product is None:
            return Response({"status": "error", "message": "Product not found"}, status=status.HTTP_404_NOT_FOUND)
        delete_product(product)
        return Response({"status": "success", "message": "Product deleted successfully"}, status=status.HTTP_200_OK)


class ProductColourSuggestionAPIView(APIView):
    permission_classes = [IsStaffOrReadOnly]

    def post(self, request):
        image = request.FILES.get('image')
        if image is None:
            return Response({"status": "error", "message": "Upload an image first."}, status=status.HTTP_400_BAD_REQUEST)
        if image.size > MAX_IMAGE_BYTES:
            return Response({"status": "error", "message": "Image is larger than 5 MB."}, status=status.HTTP_400_BAD_REQUEST)
        if image.content_type not in ALLOWED_IMAGE_TYPES:
            return Response({"status": "error", "message": "Upload a JPEG, PNG or WebP image."}, status=status.HTTP_400_BAD_REQUEST)
        suggestion = suggest_colour(image)
        if suggestion is None:
            return Response({"status": "error", "message": "Could not read that image."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"status": "success", "suggestion": suggestion}, status=status.HTTP_200_OK)


# ---- categories, colours and styles (dynamic, editable by staff) -----------------------------------------
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

    def get(self, request, row_id):
        row = self._row(row_id)
        if row is None:
            return Response({"status": "error", "message": f"{self.label} not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"status": "success", self.label.lower(): self.serializer_class(row).data})

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


class ColourListCreateAPIView(_TaxonomyListCreate):
    serializer_class = ColorSerializer
    key = 'colors'

    def _rows(self, request):
        return get_colors()


class ColourDetailAPIView(_TaxonomyDetail):
    model, serializer_class, label = Color, ColorSerializer, 'Colour'


class StyleListCreateAPIView(_TaxonomyListCreate):
    serializer_class = StyleSerializer
    key = 'styles'

    def _rows(self, request):
        return get_styles(include_inactive=request.user.is_staff and request.query_params.get('all') == '1')


class StyleDetailAPIView(_TaxonomyDetail):
    model, serializer_class, label = Style, StyleSerializer, 'Style'
