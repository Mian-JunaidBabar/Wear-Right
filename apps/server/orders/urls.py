from django.urls import path
from .views import (
    BookingDetailAPIView, BookingListCreateAPIView, CartAPIView, CartItemAPIView,
    CartMergeAPIView, CheckoutAPIView, OrderCancelAPIView, OrderDetailAPIView, OrderListCreateAPIView,
    OrderStatusAPIView,
)

urlpatterns = [
    path('orders/', OrderListCreateAPIView.as_view(), name='api-orders-list-create'),
    path('orders/<int:order_id>/', OrderDetailAPIView.as_view(), name='api-order-detail'),
    path('orders/<int:order_id>/cancel/', OrderCancelAPIView.as_view(), name='api-order-cancel'),
    path('orders/<int:order_id>/status/', OrderStatusAPIView.as_view(), name='api-order-status'),
    path('cart/', CartAPIView.as_view(), name='api-cart'),
    path('cart/items/<int:item_id>/', CartItemAPIView.as_view(), name='api-cart-item'),
    path('cart/merge/', CartMergeAPIView.as_view(), name='api-cart-merge'),
    path('checkout/', CheckoutAPIView.as_view(), name='api-checkout'),
    path('bookings/', BookingListCreateAPIView.as_view(), name='api-bookings-list-create'),
    path('bookings/<int:booking_id>/', BookingDetailAPIView.as_view(), name='api-booking-detail'),
]
