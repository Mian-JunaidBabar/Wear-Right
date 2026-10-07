from django.contrib import admin
from .models import Product

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'cultural_tag', 'compatible_skin_tone', 'price', 'cost_price', 'stock_quantity', 'status', 'created_at')
    search_fields = ('name', 'category', 'cultural_tag', 'compatible_skin_tone')
    list_filter = ('category', 'cultural_tag', 'compatible_skin_tone', 'status')
