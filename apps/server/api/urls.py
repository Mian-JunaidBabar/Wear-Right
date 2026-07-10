from django.urls import path
from .views import (
    AdminDashboardAPIView,
    FaceScannerAPIView,
    CuratedRecommendationAPIView,
    ProductListCreateAPIView,
    ProductDetailAPIView,
    UserProfileAPIView,
    OutfitGenerationAPIView,
    OrderListCreateAPIView,
    OrderDetailAPIView,
    BookingListCreateAPIView,
    BookingDetailAPIView,
    FaceScanRecordListAPIView,
)

urlpatterns = [
    path('admin/dashboard/', AdminDashboardAPIView.as_view(), name='api-admin-dashboard'),

    path('scanner/analyze/', FaceScannerAPIView.as_view(), name='api-face-scan'),

    path('products/', ProductListCreateAPIView.as_view(), name='api-products-list-create'),
    path('products/<int:product_id>/', ProductDetailAPIView.as_view(), name='api-product-detail'),
    path('products/recommendations/', CuratedRecommendationAPIView.as_view(), name='api-curated-shop'),

    path('profiles/', UserProfileAPIView.as_view(), name='api-user-profiles'),

    path('outfit/generate/', OutfitGenerationAPIView.as_view(), name='api-outfit-generate'),

    path('orders/', OrderListCreateAPIView.as_view(), name='api-orders-list-create'),
    path('orders/<int:order_id>/', OrderDetailAPIView.as_view(), name='api-order-detail'),

    path('bookings/', BookingListCreateAPIView.as_view(), name='api-bookings-list-create'),
    path('bookings/<int:booking_id>/', BookingDetailAPIView.as_view(), name='api-booking-detail'),

    path('face-scans/', FaceScanRecordListAPIView.as_view(), name='api-face-scan-records'),
]