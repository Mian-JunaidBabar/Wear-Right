from django.urls import path
from .views import (
    CompleteLookAPIView, CuratedRecommendationAPIView, OutfitGenerationAPIView, PaletteAPIView,
    ToneRuleDetailAPIView, ToneRuleListCreateAPIView, TopPicksAPIView,
)

urlpatterns = [
    path('products/recommendations/', CuratedRecommendationAPIView.as_view(), name='api-curated-shop'),
    path('outfit/generate/', OutfitGenerationAPIView.as_view(), name='api-outfit-generate'),
    path('recommendations/top/', TopPicksAPIView.as_view(), name='api-top-picks'),
    path('looks/complete/', CompleteLookAPIView.as_view(), name='api-complete-look'),
    path('tone-rules/palette/', PaletteAPIView.as_view(), name='api-tone-palette'),
    path('tone-rules/', ToneRuleListCreateAPIView.as_view(), name='api-tone-rules'),
    path('tone-rules/<int:rule_id>/', ToneRuleDetailAPIView.as_view(), name='api-tone-rule-detail'),
]
