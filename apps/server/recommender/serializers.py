from rest_framework import serializers

from catalog.engine.color import REFERENCE_COLORS

from .models import ToneColorRule

COLOUR_NAMES = {name for name, _ in REFERENCE_COLORS}


class ToneColorRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ToneColorRule
        fields = ('id', 'depth', 'undertone', 'color_name', 'score')

    def validate_color_name(self, value):
        if value not in COLOUR_NAMES:
            raise serializers.ValidationError(f"Unknown colour. Use one of: {', '.join(sorted(COLOUR_NAMES))}.")
        return value
