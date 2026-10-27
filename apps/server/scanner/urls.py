from django.urls import path
from .views import FaceScannerAPIView, FaceScanRecordListAPIView, ManualToneAPIView

urlpatterns = [
    path('scanner/analyze/', FaceScannerAPIView.as_view(), name='api-face-scan'),
    path('scanner/manual/', ManualToneAPIView.as_view(), name='api-manual-tone'),
    path('face-scans/', FaceScanRecordListAPIView.as_view(), name='api-face-scan-records'),
]
