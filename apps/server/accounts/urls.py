from django.urls import path

from .views import (
    LoginView,
    LogoutView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RefreshView,
    RegisterView,
    UserProfileAPIView,
)

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='api-auth-login'),
    path('auth/logout/', LogoutView.as_view(), name='api-auth-logout'),
    path('auth/token/refresh/', RefreshView.as_view(), name='api-auth-token-refresh'),
    path('auth/register/', RegisterView.as_view(), name='api-auth-register'),
    path('auth/password/reset/', PasswordResetRequestView.as_view(), name='api-auth-password-reset'),
    path('auth/password/reset/confirm/', PasswordResetConfirmView.as_view(), name='api-auth-password-reset-confirm'),
    path('auth/me/', MeView.as_view(), name='api-auth-me'),
    path('profiles/', UserProfileAPIView.as_view(), name='api-user-profiles'),
]
