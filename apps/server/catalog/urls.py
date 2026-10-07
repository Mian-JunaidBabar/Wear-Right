from django.urls import path
from .views import ProductListCreateAPIView, ProductDetailAPIView

urlpatterns = [
    path('products/', ProductListCreateAPIView.as_view(), name='api-products-list-create'),
    path('products/<int:product_id>/', ProductDetailAPIView.as_view(), name='api-product-detail'),
]
