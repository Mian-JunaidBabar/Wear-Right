from dj_rest_auth.jwt_auth import JWTCookieAuthentication as BaseJWTCookieAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import InvalidToken


class JWTCookieAuthentication(BaseJWTCookieAuthentication):
    """The shop's auth: dj-rest-auth's cookie JWT, but a stale or invalid token means "anonymous".

    Without this, a guest holding an expired cookie, or a cookie for a user who no longer exists
    (for example after `make db-reset`), would get a 401 even on public endpoints. Protected
    endpoints still answer 401 because the request is anonymous.

    Shop sessions and admin sessions are separate: admin-scoped tokens and staff accounts are never
    accepted here. Team members sign in at /admin/login and use the /api/admin/ endpoints instead.
    """

    def authenticate(self, request):
        try:
            result = super().authenticate(request)
        except (InvalidToken, AuthenticationFailed):
            return None
        if result is None:
            return None
        user, token = result
        if token.get('scope') == 'admin' or user.is_staff or user.is_superuser:
            return None
        return user, token
