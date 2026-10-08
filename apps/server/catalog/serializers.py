from rest_framework import serializers
from .models import Product


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'

    def validate_external_id(self, value):
        # external_id is unique, so a blank string must be stored as NULL or two blanks would collide.
        return value or None

    def validate_category(self, value):
        names = active_category_names()
        if names and value not in names:
            raise serializers.ValidationError(f"Unknown category. Add it under Categories first, or use one of: {', '.join(sorted(names))}.")
        return value

    def validate_cultural_tag(self, value):
        names = active_style_names()
        if names and value.lower() not in names:
            raise serializers.ValidationError(f"Unknown style. Use one of: {', '.join(sorted(names.values()))}.")
        return names.get(value.lower(), value)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Relative URL (/media/...) so the browser loads images through the
        # Next.js rewrite on port 3000 instead of an absolute :8000 URL.
        data['image'] = instance.image.url if instance.image else None
        for name in ('mannequin_image', 'back_image'):
            data[name] = getattr(instance, name).url if getattr(instance, name) else None
        return data


from .models import Category, Style


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True, default=0)
    cover = serializers.CharField(read_only=True, default=None)

    class Meta:
        model = Category
        fields = ('id', 'name', 'gender', 'group', 'image', 'sort_order', 'is_active', 'product_count', 'cover')


class StyleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Style
        fields = ('id', 'name', 'slug', 'sort_order', 'is_active')


def active_category_names():
    return set(Category.objects.filter(is_active=True).values_list('name', flat=True))


def active_style_names():
    return {name.lower(): name for name in Style.objects.filter(is_active=True).values_list('name', flat=True)}
