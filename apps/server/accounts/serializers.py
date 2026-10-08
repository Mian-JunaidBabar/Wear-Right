from django.contrib.auth.models import User
from django.core.exceptions import ValidationError as DjangoValidationError
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import UserProfile
from .selectors import email_is_taken, get_or_create_profile
from .services import authenticate_credentials


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
        attrs['user'] = user
        return attrs


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    email = serializers.EmailField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_email(self, value):
        if email_is_taken(value):
            raise serializers.ValidationError('An account with this email already exists.')
        return value.lower()

    def validate(self, attrs):
        candidate = User(username=attrs['email'], email=attrs['email'], first_name=attrs['name'])
        try:
            validate_password(attrs['password'], user=candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)})
        return attrs


class MeUpdateSerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=150, required=False)

    class Meta:
        model = UserProfile
        fields = (
            'name', 'skin_tone', 'monk_tone', 'undertone', 'cultural_preference', 'gender', 'preferred_style',
            'top_size', 'bottom_size', 'shoe_size',
        )
