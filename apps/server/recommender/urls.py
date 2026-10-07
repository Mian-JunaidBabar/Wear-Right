from django.urls import path
from .views import CuratedRecommendationAPIView, OutfitGenerationAPIView

urlpatterns = [
    path('curated/', CuratedRecommendationAPIView.as_view(), name='curated-recommendations'),
    path('outfit/', OutfitGenerationAPIView.as_view(), name='outfit-generation'),
]
