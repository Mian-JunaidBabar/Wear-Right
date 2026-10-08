from django.contrib import admin

from .models import ToneColorRule


@admin.register(ToneColorRule)
class ToneColorRuleAdmin(admin.ModelAdmin):
    list_display = ('depth', 'undertone', 'color_name', 'score')
    list_filter = ('depth', 'undertone', 'score')
    search_fields = ('color_name',)
