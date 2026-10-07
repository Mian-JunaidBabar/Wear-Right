from django.urls import path
from .views import FaceScannerAPIView, FaceScanRecordListAPIView

urlpatterns = [
    path('analyze/', FaceScannerAPIView.as_view(), name='analyze-skin-tone'),
    path('history/', FaceScanRecordListAPIView.as_view(), name='scan-history'),
]
