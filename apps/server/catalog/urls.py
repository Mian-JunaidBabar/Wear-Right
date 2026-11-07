from django.urls import path

from .alpha_views import AlphaWardrobeAPIView
from .views import (
    CategoryDetailAPIView, CategoryListCreateAPIView, ColourDetailAPIView, ColourListCreateAPIView,
    ProductColourSuggestionAPIView, ProductDetailAPIView, ProductListCreateAPIView,
    StyleDetailAPIView, StyleListCreateAPIView,
)

urlpatterns = [
    path('products/', ProductListCreateAPIView.as_view(), name='api-products-list-create'),
    path('products/color-suggestion/', ProductColourSuggestionAPIView.as_view(), name='api-product-colour-suggestion'),
    path('products/<int:product_id>/', ProductDetailAPIView.as_view(), name='api-product-detail'),
    path('categories/', CategoryListCreateAPIView.as_view(), name='api-categories'),
    path('categories/<int:row_id>/', CategoryDetailAPIView.as_view(), name='api-category-detail'),
    path('colors/', ColourListCreateAPIView.as_view(), name='api-colors'),
    path('colors/<int:row_id>/', ColourDetailAPIView.as_view(), name='api-color-detail'),
    path('styles/', StyleListCreateAPIView.as_view(), name='api-styles'),
    path('styles/<int:row_id>/', StyleDetailAPIView.as_view(), name='api-style-detail'),
    path('mannequin/alpha/', AlphaWardrobeAPIView.as_view(), name='api-mannequin-alpha'),
]
