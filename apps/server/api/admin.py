from django.contrib import admin
from .models import UserProfile, Product, Order, Booking, FaceScanRecord


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'skin_tone', 'cultural_preference')
    search_fields = ('user__username', 'user__email', 'skin_tone', 'cultural_preference')
    list_filter = ('skin_tone', 'cultural_preference')


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'category',
        'cultural_tag',
        'compatible_skin_tone',
        'price',
        'cost_price',
        'stock_quantity',
        'status',
        'created_at',
    )
    search_fields = ('name', 'category', 'cultural_tag', 'compatible_skin_tone')
    list_filter = ('category', 'cultural_tag', 'compatible_skin_tone', 'status')


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'customer_name',
        'product',
        'quantity',
        'total_amount',
        'profit_amount',
        'order_status',
        'payment_status',
        'order_date',
    )
    search_fields = ('customer_name', 'customer_email', 'customer_phone', 'product__name')
    list_filter = ('order_status', 'payment_status', 'order_date')


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'customer_name',
        'product',
        'booking_type',
        'booking_date',
        'status',
        'created_at',
    )
    search_fields = ('customer_name', 'customer_email', 'customer_phone', 'product__name')
    list_filter = ('booking_type', 'status', 'booking_date')


@admin.register(FaceScanRecord)
class FaceScanRecordAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'user',
        'visitor_name',
        'detected_skin_tone',
        'confidence_score',
        'lighting_quality',
        'brightness',
        'scan_date',
    )
    search_fields = ('user__username', 'visitor_name', 'detected_skin_tone')
    list_filter = ('detected_skin_tone', 'lighting_quality', 'scan_date')