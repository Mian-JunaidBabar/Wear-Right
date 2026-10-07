from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsStaff(BasePermission):
    """Authenticated staff only (anonymous -> 401, regular user -> 403)."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


class IsStaffOrReadOnly(BasePermission):
    """Anyone may read; only staff may write."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)
