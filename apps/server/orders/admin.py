from django.contrib import admin
from .models import Order, Booking

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'customer_name', 'product', 'quantity', 'total_amount', 'profit_amount', 'order_status', 'payment_status', 'order_date')
    search_fields = ('customer_name', 'customer_email', 'customer_phone', 'product__name')
    list_filter = ('order_status', 'payment_status', 'order_date')

@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ('id', 'customer_name', 'product', 'booking_type', 'booking_date', 'status', 'created_at')
    search_fields = ('customer_name', 'customer_email', 'customer_phone', 'product__name')
    list_filter = ('booking_type', 'status', 'booking_date')
