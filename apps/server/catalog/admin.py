from django.contrib import admin
from .models import Category, Product, Style

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'cultural_tag', 'compatible_skin_tone', 'price', 'cost_price', 'stock_quantity', 'status', 'created_at')
    search_fields = ('name', 'category', 'cultural_tag', 'compatible_skin_tone')
    list_filter = ('category', 'cultural_tag', 'compatible_skin_tone', 'status', 'slot', 'gender')


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'gender', 'group', 'sort_order', 'is_active')
    list_filter = ('gender', 'group', 'is_active')
    search_fields = ('name',)


@admin.register(Style)
class StyleAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'sort_order', 'is_active')
