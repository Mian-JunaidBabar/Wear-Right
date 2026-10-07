from django.urls import path
from .views import CuratedRecommendationAPIView, OutfitGenerationAPIView

urlpatterns = [
    path('products/recommendations/', CuratedRecommendationAPIView.as_view(), name='api-curated-shop'),
    path('outfit/generate/', OutfitGenerationAPIView.as_view(), name='api-outfit-generate'),
]
