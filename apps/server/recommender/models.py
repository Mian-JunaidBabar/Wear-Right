from django.db import models

from core.models import TimeStampedModel


class ToneColorRule(TimeStampedModel):
    """Which colours suit a skin depth and undertone. Editable by staff (FR-14); the web app reads them from here."""
    DEPTH_CHOICES = [('Fair', 'Fair'), ('Medium', 'Medium'), ('Dark', 'Dark')]
    UNDERTONE_CHOICES = [('warm', 'Warm'), ('cool', 'Cool'), ('neutral', 'Neutral')]
    SCORE_CHOICES = [(2, 'Best'), (1, 'Good'), (-2, 'Avoid')]

    depth = models.CharField(max_length=10, choices=DEPTH_CHOICES)
    undertone = models.CharField(max_length=10, choices=UNDERTONE_CHOICES)
    color_name = models.CharField(max_length=60)  # a name from catalog.engine.color.REFERENCE_COLORS
    score = models.SmallIntegerField(choices=SCORE_CHOICES)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['depth', 'undertone', 'color_name'], name='unique_tone_color_rule'),
        ]
        ordering = ['depth', 'undertone', '-score', 'color_name']

    def __str__(self):
        return f"{self.depth}/{self.undertone}: {self.color_name} ({self.score:+d})"
