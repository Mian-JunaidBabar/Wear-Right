from django.contrib import admin
from .models import FaceScanRecord

@admin.register(FaceScanRecord)
class FaceScanRecordAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'visitor_name', 'detected_skin_tone', 'confidence_score', 'lighting_quality', 'brightness', 'scan_date')
    search_fields = ('user__username', 'visitor_name', 'detected_skin_tone')
    list_filter = ('detected_skin_tone', 'lighting_quality', 'scan_date')
