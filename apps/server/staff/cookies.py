"""Admin panel session cookies. They are separate from the shop's wr-access / wr-refresh cookies.

The two token cookies are scoped to /api/admin/, so the browser never sends them to shop endpoints.
`wr-admin-session` is a JS-readable hint (no secret) that the Next.js proxy and the panel use to tell
whether an admin session exists, the same way `wr-session` works for shoppers.
"""
from django.conf import settings
from rest_framework_simplejwt.settings import api_settings as jwt_settings

ADMIN_ACCESS_COOKIE = 'wr-admin-access'
ADMIN_REFRESH_COOKIE = 'wr-admin-refresh'
ADMIN_HINT_COOKIE = 'wr-admin-session'
ADMIN_COOKIE_PATH = '/api/admin/'


def _secure():
    return bool(getattr(settings, 'REST_AUTH', {}).get('JWT_AUTH_SECURE', False))


def set_admin_cookies(response, *, access, refresh):
    common = {'httponly': True, 'samesite': 'Lax', 'secure': _secure(), 'path': ADMIN_COOKIE_PATH}
    response.set_cookie(ADMIN_ACCESS_COOKIE, access,
                        max_age=int(jwt_settings.ACCESS_TOKEN_LIFETIME.total_seconds()), **common)
    response.set_cookie(ADMIN_REFRESH_COOKIE, refresh,
                        max_age=int(jwt_settings.REFRESH_TOKEN_LIFETIME.total_seconds()), **common)
    response.set_cookie(ADMIN_HINT_COOKIE, '1',
                        max_age=int(jwt_settings.REFRESH_TOKEN_LIFETIME.total_seconds()),
                        samesite='Lax', httponly=False, secure=_secure(), path='/')


def clear_admin_cookies(response):
    response.delete_cookie(ADMIN_ACCESS_COOKIE, path=ADMIN_COOKIE_PATH, samesite='Lax')
    response.delete_cookie(ADMIN_REFRESH_COOKIE, path=ADMIN_COOKIE_PATH, samesite='Lax')
    response.delete_cookie(ADMIN_HINT_COOKIE, path='/', samesite='Lax')
