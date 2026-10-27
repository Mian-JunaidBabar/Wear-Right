from django.contrib import admin

from .models import AdminMember, AdminRole


@admin.register(AdminRole)
class AdminRoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_system', 'description')


@admin.register(AdminMember)
class AdminMemberAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'is_active', 'created_at')
    list_filter = ('role', 'is_active')
    search_fields = ('user__email', 'user__first_name', 'user__last_name')
