from rest_framework import serializers
from .models import Product


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Relative URL (/media/...) so the browser loads images through the
        # Next.js rewrite on port 3000 instead of an absolute :8000 URL.
        data['image'] = instance.image.url if instance.image else None
        return data
