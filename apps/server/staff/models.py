from django.contrib.auth.models import User
from django.db import models

from core.models import TimeStampedModel

from .catalog import expand


class AdminRole(TimeStampedModel):
    """A named set of admin panel permissions (RBAC). Assigned to team members."""
    name = models.CharField(max_length=60, unique=True)
    slug = models.SlugField(max_length=70, unique=True)
    description = models.CharField(max_length=200, blank=True, default='')
    permissions = models.JSONField(default=list, blank=True)  # keys from staff.catalog.PERMISSIONS, or ['*']
    is_system = models.BooleanField(default=False)  # Super Admin: always every permission, never edited or deleted

    class Meta:
        ordering = ['-is_system', 'name']

    def permission_keys(self):
        return expand(self.permissions)

    def __str__(self):
        return self.name


class AdminMember(TimeStampedModel):
    """A person who can sign in to the admin panel. Separate from shop customers: their User is staff-only."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='admin_member')
    role = models.ForeignKey(AdminRole, on_delete=models.PROTECT, related_name='members')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['user__first_name', 'user__email']

    def __str__(self):
        return f'{self.user.email} ({self.role.name})'
