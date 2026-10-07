from django.middleware.csrf import get_token


def ensure_csrf_cookie(request):
    """Make Django send the csrftoken cookie with this response.

    The web app reads that cookie and echoes it in the X-CSRFToken header on every
    unsafe request (see apps/web/src/lib/api.ts).
    """
    get_token(getattr(request, "_request", request))
