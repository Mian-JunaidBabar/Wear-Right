from django.db import models
from django.contrib.auth.models import User
from core.models import TimeStampedModel

class FaceScanRecord(TimeStampedModel):
    SKIN_TONE_CHOICES = [
        ('Fair', 'Fair'), ('Medium', 'Medium'), ('Dark', 'Dark'),
        ('Rescan Required', 'Rescan Required'), ('Unknown', 'Unknown'),
    ]
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    visitor_name = models.CharField(max_length=255, blank=True, null=True)
    detected_skin_tone = models.CharField(max_length=50, choices=SKIN_TONE_CHOICES)
    confidence_score = models.FloatField(default=0)
    lighting_quality = models.CharField(max_length=100, blank=True, null=True)
    brightness = models.FloatField(default=0)
    scan_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.detected_skin_tone} - {self.confidence_score}%"
