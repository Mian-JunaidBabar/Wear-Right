from django.db import models
from django.contrib.auth.models import User
from core.models import TimeStampedModel

class UserProfile(TimeStampedModel):
    STYLE_CHOICES = [('Eastern', 'Eastern'), ('Western', 'Western'), ('Formal', 'Formal'), ('Casual', 'Casual')]
    SKIN_TONE_CHOICES = [('Fair', 'Fair'), ('Medium', 'Medium'), ('Dark', 'Dark')]
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    skin_tone = models.CharField(max_length=50, choices=SKIN_TONE_CHOICES, blank=True, null=True)
    cultural_preference = models.CharField(max_length=50, choices=STYLE_CHOICES, default='Western')

    def __str__(self):
        return self.user.username
