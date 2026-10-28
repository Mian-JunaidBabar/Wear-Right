from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import UserProfile
from .selectors import email_is_taken, get_or_create_profile, get_password_reset_target
from .services import authenticate_credentials, request_password_reset, reset_password


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = '__all__'
        read_only_fields = ('user', 'created_at', 'updated_at')


class AuthUserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'name', 'is_staff', 'is_superuser')
        read_only_fields = fields

    def get_name(self, user):
        return user.get_full_name() or user.email or user.username


def session_payload(user):
    """The shape returned by login, register and me: the user and their profile together."""
    profile = get_or_create_profile(user)
    return {
        'user': AuthUserSerializer(user).data,
        'profile': UserProfileSerializer(profile).data,
    }


class LoginSerializer(serializers.Serializer):
    email = serializers.CharField(required=False, allow_blank=True)
    username = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        identifier = attrs.get('email') or attrs.get('username')
        if not identifier:
            raise serializers.ValidationError('Enter your email and password.')
        user = authenticate_credentials(identifier=identifier, password=attrs['password'])
        if user is None:
            raise serializers.ValidationError('Incorrect email or password.')
        if user.is_staff or user.is_superuser:
            # Team accounts have their own login and session (see staff/); they never shop as customers.
            raise serializers.ValidationError('This is a team account. Sign in to the admin panel at /admin/login instead.')
        attrs['user'] = user
        return attrs


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    email = serializers.EmailField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    # Optional so older clients keep working; the web form always sends it.
    password_confirm = serializers.CharField(write_only=True, required=False, allow_blank=True, trim_whitespace=False)

    def validate_email(self, value):
        if email_is_taken(value):
            raise serializers.ValidationError('An account with this email already exists.')
        return value.lower()

    def validate(self, attrs):
        confirm = attrs.pop('password_confirm', None)
        if confirm is not None and confirm != attrs['password']:
            raise serializers.ValidationError({'password_confirm': ['Passwords do not match.']})
        candidate = User(username=attrs['email'], email=attrs['email'], first_name=attrs['name'])
        try:
            validate_password(attrs['password'], user=candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)})
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    """Ask for a reset link. The response is the same whether or not the address exists."""

    email = serializers.EmailField()
    audience = 'shop'

    def save(self):
        return request_password_reset(email=self.validated_data['email'], audience=self.audience)


class AdminPasswordResetRequestSerializer(PasswordResetRequestSerializer):
    audience = 'admin'


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Check a reset link and the new password, then let the service write it."""

    uid = serializers.CharField()
    token = serializers.CharField()
    new_password1 = serializers.CharField(max_length=128, trim_whitespace=False)
    new_password2 = serializers.CharField(max_length=128, trim_whitespace=False)
    audience = 'shop'

    def validate(self, attrs):
        user = get_password_reset_target(uid=attrs['uid'], audience=self.audience)
        if user is None or not default_token_generator.check_token(user, attrs['token']):
            # One message for a bad uid, a bad token and an ineligible account: no hints.
            raise serializers.ValidationError({'token': ['This reset link is invalid or has expired.']})
        if attrs['new_password1'] != attrs['new_password2']:
            raise serializers.ValidationError({'new_password2': ['Passwords do not match.']})
        try:
            validate_password(attrs['new_password1'], user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'new_password1': list(exc.messages)})
        attrs['user'] = user
        return attrs

    def save(self):
        return reset_password(
            user=self.validated_data['user'],
            new_password=self.validated_data['new_password1'],
        )


class AdminPasswordResetConfirmSerializer(PasswordResetConfirmSerializer):
    audience = 'admin'


class MeUpdateSerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=150, required=False)

    def validate_cultural_preference(self, value):
        from catalog.models import Style
        names = {n.lower(): n for n in Style.objects.filter(is_active=True).values_list('name', flat=True)}
        if names and value.lower() not in names:
            raise serializers.ValidationError(f"Unknown style. Use one of: {', '.join(sorted(names.values()))}.")
        return names.get(value.lower(), value)

    def validate_preferred_style(self, value):
        from catalog.models import Style
        slugs = set(Style.objects.filter(is_active=True).values_list('slug', flat=True)) | {'mixed'}
        if value.lower() not in slugs:
            raise serializers.ValidationError(f"Unknown style. Use one of: {', '.join(sorted(slugs))}.")
        return value.lower()

    class Meta:
        model = UserProfile
        fields = (
            'name', 'skin_tone', 'monk_tone', 'undertone', 'favorite_colors', 'avoided_colors', 'body_preset', 'cultural_preference', 'gender', 'preferred_style',
            'top_size', 'bottom_size', 'shoe_size',
        )
