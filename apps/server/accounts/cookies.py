"""A JS-readable hint that a session exists.

The real tokens are httpOnly, so the browser cannot tell whether it is signed in.
`wr-session` carries no secret; the web app only uses it to decide whether it is
worth calling GET /api/auth/me/ (guests would otherwise trigger needless 401s).
"""
from rest_framework_simplejwt.settings import api_settings as jwt_settings

SESSION_HINT_COOKIE = 'wr-session'


def set_session_hint(response):
    response.set_cookie(
        SESSION_HINT_COOKIE, '1',
        max_age=int(jwt_settings.REFRESH_TOKEN_LIFETIME.total_seconds()),
        samesite='Lax', httponly=False,
    )


def clear_session_hint(response):
    response.delete_cookie(SESSION_HINT_COOKIE, samesite='Lax')
