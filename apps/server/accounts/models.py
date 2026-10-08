from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.contrib.auth.models import User
from core.models import TimeStampedModel

class UserProfile(TimeStampedModel):
    STYLE_CHOICES = [('Eastern', 'Eastern'), ('Western', 'Western'), ('Formal', 'Formal'), ('Casual', 'Casual')]
    SKIN_TONE_CHOICES = [('Fair', 'Fair'), ('Medium', 'Medium'), ('Dark', 'Dark')]
    UNDERTONE_CHOICES = [('warm', 'Warm'), ('cool', 'Cool'), ('neutral', 'Neutral')]
    GENDER_CHOICES = [('male', 'Male'), ('female', 'Female'), ('unspecified', 'Unspecified')]
    PREFERRED_STYLE_CHOICES = [
        ('casual', 'Casual'), ('formal', 'Formal'), ('eastern', 'Eastern'), ('mixed', 'Mixed'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    skin_tone = models.CharField(max_length=50, choices=SKIN_TONE_CHOICES, blank=True, null=True)
    monk_tone = models.PositiveSmallIntegerField(blank=True, null=True, validators=[MinValueValidator(1), MaxValueValidator(10)])  # Monk Skin Tone swatch 1 to 10
    undertone = models.CharField(max_length=10, choices=UNDERTONE_CHOICES, blank=True, null=True)
    cultural_preference = models.CharField(max_length=50, choices=STYLE_CHOICES, default='Western')
    gender = models.CharField(max_length=20, choices=GENDER_CHOICES, default='unspecified')
    preferred_style = models.CharField(max_length=20, choices=PREFERRED_STYLE_CHOICES, default='mixed')
    top_size = models.CharField(max_length=10, blank=True, default='')
    bottom_size = models.CharField(max_length=10, blank=True, default='')
    shoe_size = models.CharField(max_length=10, blank=True, default='')

    def __str__(self):
        return self.user.username
