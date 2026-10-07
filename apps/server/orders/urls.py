from django.urls import path
from .views import (
    OrderListCreateAPIView, OrderDetailAPIView,
    BookingListCreateAPIView, BookingDetailAPIView,
    AdminDashboardAPIView
)

urlpatterns = [
    path('', OrderListCreateAPIView.as_view(), name='order-list'),
    path('<int:order_id>/', OrderDetailAPIView.as_view(), name='order-detail'),
    path('bookings/', BookingListCreateAPIView.as_view(), name='booking-list'),
    path('bookings/<int:booking_id>/', BookingDetailAPIView.as_view(), name='booking-detail'),
    path('dashboard/', AdminDashboardAPIView.as_view(), name='admin-dashboard'),
]
