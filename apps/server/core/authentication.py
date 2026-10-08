from dj_rest_auth.jwt_auth import JWTCookieAuthentication as BaseJWTCookieAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import InvalidToken


class JWTCookieAuthentication(BaseJWTCookieAuthentication):
    """dj-rest-auth's cookie JWT auth, but a stale or invalid token means "anonymous".

    Without this, a guest holding an expired cookie, or a cookie for a user who no longer exists
    (for example after `make db-reset`), would get a 401 even on public endpoints. Protected
    endpoints still answer 401 because the request is anonymous.
    """

    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except (InvalidToken, AuthenticationFailed):
            return None
