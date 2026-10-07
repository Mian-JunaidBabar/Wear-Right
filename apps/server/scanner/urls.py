from django.urls import path
from .views import FaceScannerAPIView, FaceScanRecordListAPIView

urlpatterns = [
    path('scanner/analyze/', FaceScannerAPIView.as_view(), name='api-face-scan'),
    path('face-scans/', FaceScanRecordListAPIView.as_view(), name='api-face-scan-records'),
]
