from .catalog import PERMISSION_KEYS
from .models import AdminMember, AdminRole


def get_member(user):
    """The user's admin panel membership, or None."""
    if user is None or not getattr(user, 'is_authenticated', False):
        return None
    try:
        return user.admin_member
    except AdminMember.DoesNotExist:
        return None


def is_admin_account(user):
    """May this user sign in to the admin panel? Members follow their own switch; a Django superuser
    without a membership row (createsuperuser) is let in so the panel can always be reached."""
    if user is None or not user.is_active:
        return False
    member = get_member(user)
    if member is not None:
        return member.is_active
    return user.is_superuser


def permissions_for(user):
    """Permission keys the user holds in the admin panel."""
    if user is None or not getattr(user, 'is_authenticated', False) or not user.is_active:
        return []
    member = get_member(user)
    if member is not None:
        if not member.is_active:
            return []
        return list(PERMISSION_KEYS) if user.is_superuser else member.role.permission_keys()
    # Staff created outside the panel (createsuperuser, the Django admin, test factories) keep full access.
    # They cannot sign in to the panel unless they are superusers, see is_admin_account().
    if user.is_superuser or user.is_staff:
        return list(PERMISSION_KEYS)
    return []


def has_permission(user, key):
    return key in permissions_for(user)


def get_members():
    return AdminMember.objects.select_related('user', 'role').order_by('user__first_name', 'user__email')


def get_member_by_id(member_id):
    return get_members().filter(id=member_id).first()


def get_roles():
    from django.db.models import Count
    return AdminRole.objects.annotate(member_count=Count('members')).order_by('-is_system', 'name')


def get_role_by_id(role_id):
    return get_roles().filter(id=role_id).first()


def active_super_admins():
    return AdminMember.objects.filter(role__is_system=True, is_active=True, user__is_active=True)
