from django.urls import path
from .views import (
    OrderListCreateAPIView, OrderDetailAPIView,
    BookingListCreateAPIView, BookingDetailAPIView,
    AdminDashboardAPIView,
)

urlpatterns = [
    path('admin/dashboard/', AdminDashboardAPIView.as_view(), name='api-admin-dashboard'),
    path('orders/', OrderListCreateAPIView.as_view(), name='api-orders-list-create'),
    path('orders/<int:order_id>/', OrderDetailAPIView.as_view(), name='api-order-detail'),
    path('bookings/', BookingListCreateAPIView.as_view(), name='api-bookings-list-create'),
    path('bookings/<int:booking_id>/', BookingDetailAPIView.as_view(), name='api-booking-detail'),
]
