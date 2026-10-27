from dj_rest_auth.jwt_auth import JWTCookieAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import InvalidToken

from .cookies import ADMIN_ACCESS_COOKIE
from .selectors import is_admin_account

ADMIN_SCOPE = 'admin'


class AdminJWTCookieAuthentication(JWTCookieAuthentication):
    """Authenticates admin panel requests from the wr-admin-access cookie only.

    The token must carry scope=admin (only the admin login issues those) and the user must still be an
    active team member. Anything else is treated as anonymous, so admin endpoints answer 401 and the
    panel tries one refresh. A shopper's wr-access cookie is never read here.
    """

    def authenticate(self, request):
        raw_token = request.COOKIES.get(ADMIN_ACCESS_COOKIE)
        if raw_token is None:
            return None
        self.enforce_csrf(request)
        try:
            token = self.get_validated_token(raw_token)
            user = self.get_user(token)
        except (InvalidToken, AuthenticationFailed):
            return None
        if token.get('scope') != ADMIN_SCOPE or not is_admin_account(user):
            return None
        return user, token
