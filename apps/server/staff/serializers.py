from rest_framework import serializers

from .catalog import PERMISSION_KEYS, PERMISSIONS
from .models import AdminMember, AdminRole
from .selectors import get_member, permissions_for


class AdminLoginSerializer(serializers.Serializer):
    email = serializers.CharField()
    password = serializers.CharField(trim_whitespace=False)


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(trim_whitespace=False)
    new_password = serializers.CharField(trim_whitespace=False)


class OwnAccountSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)


class RoleBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdminRole
        fields = ('id', 'name', 'slug', 'is_system')


def admin_session_payload(user):
    """What the panel needs about the signed-in admin: who they are, their role and what they may do."""
    member = get_member(user)
    role = RoleBriefSerializer(member.role).data if member else {
        'id': None, 'name': 'Super Admin' if user.is_superuser else 'Staff', 'slug': 'superuser', 'is_system': True,
    }
    return {
        'user': {
            'id': user.id,
            'name': user.get_full_name() or user.email or user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'last_login': user.last_login,
        },
        'role': role,
        'permissions': permissions_for(user),
    }


class RoleSerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(read_only=True, default=0)
    permissions = serializers.ListField(child=serializers.CharField(), required=False)

    class Meta:
        model = AdminRole
        fields = ('id', 'name', 'slug', 'description', 'permissions', 'is_system', 'member_count', 'created_at')
        read_only_fields = ('id', 'slug', 'is_system', 'member_count', 'created_at')

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Role name is required.')
        return value

    def validate_permissions(self, value):
        unknown = [key for key in value if key not in PERMISSION_KEYS]
        if unknown:
            raise serializers.ValidationError(f"Unknown permission: {', '.join(unknown)}.")
        return [key for key in PERMISSION_KEYS if key in value]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['permissions'] = instance.permission_keys()
        return data


def permission_catalog():
    return [{'key': key, 'group': group, 'label': label} for key, group, label in PERMISSIONS]


class MemberSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    email = serializers.EmailField(source='user.email', read_only=True)
    last_login = serializers.DateTimeField(source='user.last_login', read_only=True)
    role = RoleBriefSerializer(read_only=True)

    class Meta:
        model = AdminMember
        fields = ('id', 'name', 'email', 'role', 'is_active', 'last_login', 'created_at')

    def get_name(self, member):
        return member.user.get_full_name() or member.user.email


class MemberCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    email = serializers.EmailField(max_length=150)
    password = serializers.CharField(trim_whitespace=False)
    role = serializers.PrimaryKeyRelatedField(queryset=AdminRole.objects.all())
    is_active = serializers.BooleanField(default=True)


class MemberUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150, required=False)
    role = serializers.PrimaryKeyRelatedField(queryset=AdminRole.objects.all(), required=False)
    is_active = serializers.BooleanField(required=False)
    password = serializers.CharField(trim_whitespace=False, required=False, allow_blank=True)
