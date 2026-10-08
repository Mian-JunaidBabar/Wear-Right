from django.urls import path
from .views import (
    CategoryDetailAPIView, CategoryListCreateAPIView, ProductDetailAPIView, ProductListCreateAPIView,
    StyleDetailAPIView, StyleListCreateAPIView,
)

urlpatterns = [
    path('products/', ProductListCreateAPIView.as_view(), name='api-products-list-create'),
    path('products/<int:product_id>/', ProductDetailAPIView.as_view(), name='api-product-detail'),
    path('categories/', CategoryListCreateAPIView.as_view(), name='api-categories'),
    path('categories/<int:row_id>/', CategoryDetailAPIView.as_view(), name='api-category-detail'),
    path('styles/', StyleListCreateAPIView.as_view(), name='api-styles'),
    path('styles/<int:row_id>/', StyleDetailAPIView.as_view(), name='api-style-detail'),
]
