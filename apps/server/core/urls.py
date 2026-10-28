from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path

from core.views import serve_media

urlpatterns = [
    path('admin/', admin.site.urls),
    # Admin panel API first: its own login, cookies and RBAC (see staff/).
    path('api/admin/', include('staff.urls')),
    path('api/', include('accounts.urls')),
    path('api/', include('catalog.urls')),
    path('api/', include('scanner.urls')),
    path('api/', include('recommender.urls')),
    path('api/', include('orders.urls')),
    # Product photos. static() only serves with DEBUG=True, which broke the production
    # demo build; this serves whenever SERVE_MEDIA is on (see core.views.serve_media).
    re_path(r'^media/(?P<path>.*)$', serve_media),
]
