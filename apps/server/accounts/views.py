from dj_rest_auth.jwt_auth import get_refresh_view, set_jwt_cookies
from dj_rest_auth.views import LoginView as BaseLoginView
from dj_rest_auth.views import LogoutView as BaseLogoutView
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from core.csrf import ensure_csrf_cookie

from .selectors import get_or_create_profile, get_profiles
from .serializers import (
    MeUpdateSerializer,
    RegisterSerializer,
    UserProfileSerializer,
    session_payload,
)
from .services import register_user, save_own_profile, update_account


class LoginView(BaseLoginView):
    """POST /api/auth/login/ : sets the wr-access and wr-refresh cookies."""

    def get_response(self):
        response = super().get_response()
        response.data = session_payload(self.user)
        ensure_csrf_cookie(self.request)
        return response


class LogoutView(BaseLogoutView):
    """POST /api/auth/logout/ : blacklists the refresh token and clears both cookies."""


class RefreshView(get_refresh_view()):
    """POST /api/auth/token/refresh/ : rotates the refresh cookie, never returns tokens in the body."""

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            response.data = {'detail': 'Token refreshed.'}
            ensure_csrf_cookie(request)
        return response


class RegisterView(APIView):
    """POST /api/auth/register/ : validates, creates the user + profile, logs in via cookies."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = register_user(**serializer.validated_data)

        refresh = RefreshToken.for_user(user)
        response = Response(session_payload(user), status=status.HTTP_201_CREATED)
        set_jwt_cookies(response, str(refresh.access_token), str(refresh))
        ensure_csrf_cookie(request)
        return response


class MeView(APIView):
    """GET/PATCH /api/auth/me/ : the signed-in user and their profile."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        ensure_csrf_cookie(request)
        return Response(session_payload(request.user))

    def patch(self, request):
        profile = get_or_create_profile(request.user)
        serializer = MeUpdateSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        update_account(request.user, profile, **serializer.validated_data)
        return Response(session_payload(request.user))


class UserProfileAPIView(APIView):
    """GET/POST /api/profiles/ : own profile (staff: all). POST upserts the caller's profile."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(get_profiles(request.user), many=True)
        return Response({"status": "success", "profiles": serializer.data}, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = UserProfileSerializer(data=request.data)
        if serializer.is_valid():
            profile, _ = save_own_profile(request.user, **serializer.validated_data)
            return Response({"status": "success", "message": "User profile saved successfully", "profile": UserProfileSerializer(profile).data}, status=status.HTTP_201_CREATED)
        return Response({"status": "error", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
