from django.urls import path
from .views import UserProfileAPIView

urlpatterns = [
    path('profiles/', UserProfileAPIView.as_view(), name='api-user-profiles'),
]
