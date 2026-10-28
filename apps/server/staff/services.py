from django.contrib.auth import authenticate
from django.contrib.auth.models import User, update_last_login
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils.text import slugify
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.services import send_password_reset_email, split_name

from .authentication import ADMIN_SCOPE
from .catalog import ALL, DEFAULT_ROLES
from .models import AdminMember, AdminRole
from .selectors import active_super_admins, get_member, is_admin_account


# ---- sign in ---------------------------------------------------------------------------------------------
def authenticate_admin(*, identifier, password):
    """Email or username + password -> a user allowed into the admin panel, or None."""
    identifier = (identifier or '').strip()
    username = identifier
    if '@' in identifier:
        match = User.objects.filter(email__iexact=identifier).first()
        username = match.username if match else identifier
    user = authenticate(username=username, password=password)
    if user is None or not is_admin_account(user):
        return None
    return user


def issue_admin_tokens(user):
    """Refresh + access JWTs marked scope=admin. Only these open the admin endpoints."""
    refresh = RefreshToken.for_user(user)
    refresh['scope'] = ADMIN_SCOPE
    update_last_login(None, user)
    return str(refresh.access_token), str(refresh)


def change_password(user, *, current_password, new_password):
    if not user.check_password(current_password or ''):
        return 'Your current password is incorrect.'
    try:
        validate_password(new_password, user=user)
    except DjangoValidationError as exc:
        return ' '.join(exc.messages)
    user.set_password(new_password)
    user.save(update_fields=['password'])
    return None


def update_own_name(user, name):
    user.first_name, user.last_name = split_name(name)
    user.save(update_fields=['first_name', 'last_name'])
    return user


# ---- roles -----------------------------------------------------------------------------------------------
def ensure_default_roles():
    for spec in DEFAULT_ROLES:
        AdminRole.objects.get_or_create(slug=spec['slug'], defaults={
            'name': spec['name'], 'description': spec['description'],
            'permissions': spec['permissions'], 'is_system': spec['is_system'],
        })
    return AdminRole.objects.get(slug='super-admin')


def _unique_role_slug(name, exclude_id=None):
    base = slugify(name)[:60] or 'role'
    slug, n = base, 2
    while AdminRole.objects.exclude(id=exclude_id).filter(slug=slug).exists():
        slug, n = f'{base}-{n}', n + 1
    return slug


def create_role(*, name, description='', permissions=()):
    if AdminRole.objects.filter(name__iexact=name.strip()).exists():
        return None, 'A role with this name already exists.'
    role = AdminRole.objects.create(
        name=name.strip(), slug=_unique_role_slug(name), description=description or '',
        permissions=list(permissions),
    )
    return role, None


def update_role(role, **data):
    if role.is_system:
        return None, 'The Super Admin role always has full access and cannot be changed.'
    if 'name' in data:
        name = data['name'].strip()
        if AdminRole.objects.exclude(id=role.id).filter(name__iexact=name).exists():
            return None, 'A role with this name already exists.'
        role.name = name
        role.slug = _unique_role_slug(name, exclude_id=role.id)
    if 'description' in data:
        role.description = data['description'] or ''
    if 'permissions' in data:
        role.permissions = list(data['permissions'])
    role.save()
    return role, None


def delete_role(role):
    if role.is_system:
        return 'The Super Admin role cannot be deleted.'
    if role.members.exists():
        return 'Move this role\'s members to another role before deleting it.'
    role.delete()
    return None


# ---- members ---------------------------------------------------------------------------------------------
def _is_last_super_admin(member):
    if not (member.role.is_system and member.is_active):
        return False
    return not active_super_admins().exclude(id=member.id).exists()


@transaction.atomic
def create_member(*, name, email, password=None, role, is_active=True, email_invite=False):
    email = email.strip().lower()
    if User.objects.filter(email__iexact=email).exists() or User.objects.filter(username__iexact=email).exists():
        return None, 'An account with this email already exists.'
    if not email_invite and not password:
        return None, 'Set a password or send the member an email link.'
    candidate = User(username=email, email=email, first_name=name)
    if not email_invite:
        try:
            validate_password(password, user=candidate)
        except DjangoValidationError as exc:
            return None, ' '.join(exc.messages)
    first_name, last_name = split_name(name)
    # Team accounts are staff-only: the shop login refuses them and they never get a shopper profile.
    user = User.objects.create_user(
        username=email, email=email, password=None if email_invite else password,
        first_name=first_name, last_name=last_name, is_staff=True,
    )
    member = AdminMember.objects.create(user=user, role=role, is_active=is_active)
    if email_invite and is_active:
        # After the member row is committed, and never allowed to fail the creation.
        transaction.on_commit(lambda: send_password_reset_email(
            user, audience='admin', template='team_invite',
            subject='You have been added to the Wear Right team',
        ))
    return member, None


@transaction.atomic
def update_member(actor, member, *, name=None, role=None, is_active=None, password=None):
    is_self = member.user_id == actor.id
    if is_self and role is not None and role.id != member.role_id:
        return None, 'You cannot change your own role.'
    if is_self and is_active is False:
        return None, 'You cannot deactivate your own account.'
    losing_super = (role is not None and not role.is_system) or is_active is False
    if losing_super and _is_last_super_admin(member):
        return None, 'Keep at least one active Super Admin.'
    if password:
        try:
            validate_password(password, user=member.user)
        except DjangoValidationError as exc:
            return None, ' '.join(exc.messages)
        member.user.set_password(password)
    if name is not None:
        member.user.first_name, member.user.last_name = split_name(name)
    member.user.save()
    if role is not None:
        member.role = role
    if is_active is not None:
        member.is_active = is_active
    member.save()
    return member, None


@transaction.atomic
def delete_member(actor, member):
    if member.user_id == actor.id:
        return 'You cannot remove your own account.'
    if _is_last_super_admin(member):
        return 'Keep at least one active Super Admin.'
    member.user.delete()  # team accounts exist only for the panel; orders keep their rows (user is SET_NULL)
    return None


def ensure_member(user, role_slug='super-admin'):
    """Give an existing staff user a panel membership (used by the demo seed)."""
    if get_member(user) is not None:
        return get_member(user)
    ensure_default_roles()
    role = AdminRole.objects.get(slug=role_slug)
    if not user.is_staff:
        user.is_staff = True
        user.save(update_fields=['is_staff'])
    return AdminMember.objects.create(user=user, role=role)


__all__ = [
    'ALL', 'authenticate_admin', 'issue_admin_tokens', 'change_password', 'update_own_name',
    'ensure_default_roles', 'create_role', 'update_role', 'delete_role',
    'create_member', 'update_member', 'delete_member', 'ensure_member',
]
