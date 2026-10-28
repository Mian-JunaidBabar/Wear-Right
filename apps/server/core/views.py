from django.conf import settings
from django.http import Http404
from django.views.static import serve


def serve_media(request, path):
    """Serves product photos from MEDIA_ROOT whenever SERVE_MEDIA is on.

    Checked per request (not at import time) so settings overrides behave predictably.
    django.views.static.serve guards against path traversal; it is a development
    convenience, which is why SERVE_MEDIA=False exists for real deployments.
    """
    if not settings.SERVE_MEDIA:
        raise Http404
    return serve(request, path, document_root=settings.MEDIA_ROOT)
