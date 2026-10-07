from django.contrib import admin
from .models import UserProfile

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'skin_tone', 'cultural_preference')
    search_fields = ('user__username', 'user__email', 'skin_tone', 'cultural_preference')
    list_filter = ('skin_tone', 'cultural_preference')
