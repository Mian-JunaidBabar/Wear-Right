from rest_framework.permissions import BasePermission

from .selectors import has_permission, permissions_for

DEFAULT_METHOD_PERMISSION = {'HEAD': 'GET', 'OPTIONS': 'GET'}


class HasAdminPermission(BasePermission):
    """RBAC check for admin endpoints. The view lists the permission each method needs:

        admin_permissions = {'GET': 'products.view', 'POST': 'products.manage'}

    A method that is not listed is refused. Anonymous -> 401, signed in without the permission -> 403.
    """

    message = 'Your role does not allow this action.'

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        needed = getattr(view, 'admin_permissions', {})
        method = DEFAULT_METHOD_PERMISSION.get(request.method, request.method)
        key = needed.get(method)
        if key is None:
            return False
        return has_permission(user, key)


class IsAdminMember(BasePermission):
    """Any signed-in team member (used by the admin's own session endpoints)."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and permissions_for(user))
