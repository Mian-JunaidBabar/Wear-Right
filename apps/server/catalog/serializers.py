from rest_framework import serializers
from .engine.color import display_hex
from .engine.kinds import KINDS, infer_kind, is_kids_name, slot_of_kind
from .models import Category, Color, Product, Style

MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/webp'}


class ColorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Color
        fields = ('id', 'name', 'hex', 'family')
        read_only_fields = ('id',)

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Colour name is required.')
        return value

    def _fill_family(self, validated_data):
        if not validated_data.get('family') and validated_data.get('hex'):
            from .engine.families import family_of_hex
            try:
                validated_data['family'] = family_of_hex(validated_data['hex'])
            except Exception:
                pass
        return validated_data

    def create(self, validated_data):
        return super().create(self._fill_family(validated_data))

    def update(self, instance, validated_data):
        return super().update(instance, self._fill_family(validated_data))


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True, default=0)
    cover = serializers.CharField(read_only=True, default=None)

    class Meta:
        model = Category
        fields = ('id', 'name', 'slug', 'slot', 'gender', 'group', 'image', 'sort_order', 'is_active', 'product_count', 'cover')
        read_only_fields = ('id',)


class StyleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Style
        fields = ('id', 'name', 'slug', 'sort_order', 'is_active')


class ProductSerializer(serializers.ModelSerializer):
    category_slug = serializers.SerializerMethodField()
    primary_color_name = serializers.CharField(source='primary_color.name', read_only=True, default=None)
    primary_color_hex = serializers.CharField(source='primary_color.hex', read_only=True, default=None)

    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields = ('category_ref',)

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

    def validate_kind(self, value):
        """A garment kind must be one of the catalog kinds (or blank, to let the words decide)."""
        if value and value not in KINDS:
            raise serializers.ValidationError(f"Unknown kind. Use one of: {', '.join(KINDS)}.")
        return value or None

    def validate_image(self, value):
        if value is None:
            return value
        size = getattr(value, 'size', 0)
        if size and size > MAX_IMAGE_BYTES:
            raise serializers.ValidationError('Image is larger than 5 MB. Please upload a smaller photo.')
        content_type = getattr(value, 'content_type', '')
        # Uploaded files carry a content type. Existing files edited via JSON do not, so only check when present.
        if content_type and content_type not in ALLOWED_IMAGE_TYPES:
            raise serializers.ValidationError('Upload a JPEG, PNG or WebP image.')
        return value

    def validate_sizes(self, value):
        allowed = {'S', 'M', 'L', 'XL', 'XXL'}
        if not isinstance(value, list) or any(size not in allowed for size in value):
            raise serializers.ValidationError('Sizes must be a list containing only S, M, L, XL, XXL.')
        return [size for size in ('S', 'M', 'L', 'XL', 'XXL') if size in value]

    def validate_price(self, value):
        if value < 0:
            raise serializers.ValidationError('Price cannot be negative.')
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Relative URL (/media/...) so the browser loads images through the
        # Next.js rewrite on port 3000 instead of an absolute :8000 URL.
        data['image'] = instance.image.url if instance.image else None
        for name in ('mannequin_image', 'back_image'):
            data[name] = getattr(instance, name).url if getattr(instance, name) else None
        # One hex the mannequin SVG can always paint with: hex field, primary colour, name lookup, grey.
        data['display_hex'] = display_hex(
            instance.color_hex,
            instance.primary_color.hex if instance.primary_color_id else '',
            instance.color_name,
            instance.color,
        ) or '#9CA3AF'
        return data

    def get_category_slug(self, instance):
        if instance.category_ref_id:
            return instance.category_ref.slug
        row = Category.objects.filter(name=instance.category).first()
        return row.slug if row else None

    SIZE_FIELDS = (('S', 'size_s_stock'), ('M', 'size_m_stock'), ('L', 'size_l_stock'),
                   ('XL', 'size_xl_stock'), ('XXL', 'size_xxl_stock'))

    def _sync_sizes(self, validated_data, instance=None):
        """When per-size stock is edited, the offered sizes and the total follow it.

        Product.save() only fills `sizes` when it is empty, so without this a size restocked from 0
        stayed unbuyable and a size sold out stayed on offer. Products without per-size stock
        (accessories) keep their own total.
        """
        if not any(field in validated_data for _, field in self.SIZE_FIELDS):
            return validated_data
        stock = {
            size: validated_data.get(field, getattr(instance, field, 0) if instance else 0) or 0
            for size, field in self.SIZE_FIELDS
        }
        if sum(stock.values()) > 0:
            validated_data['sizes'] = [size for size, quantity in stock.items() if quantity > 0]
            validated_data['stock_quantity'] = sum(stock.values())
        elif 'sizes' not in validated_data:
            validated_data['sizes'] = []
        return validated_data

    def _sync_relations(self, validated_data, instance=None):
        """Fill the relations and the derived tagging (kind / slot / gender) around one write.

        `instance` is passed on updates, where the payload may be partial (an eye toggle sends only
        `is_active`): words then come from the merged product, so nothing already set is clobbered.
        """
        def current(field):
            """The merged value for a field: the payload wins, then whatever the product already has."""
            if field in validated_data:
                return validated_data[field]
            return getattr(instance, field, '') if instance is not None else ''

        category = validated_data.get('category') or current('category')
        if category:
            validated_data['category_ref'] = Category.objects.filter(name=category).first()

        style = (validated_data.get('style') or '').lower() or (getattr(instance, 'style', '') if instance else '')
        tag = (validated_data.get('cultural_tag') or current('cultural_tag') or '').lower()
        if not style and tag:
            validated_data['style'] = {'eastern': 'eastern', 'regional': 'eastern', 'formal': 'formal'}.get(tag, 'casual')

        name = validated_data.get('name') or current('name')
        garment_type = validated_data.get('garment_type') if 'garment_type' in validated_data else (instance.garment_type if instance else '')
        slot = validated_data.get('slot') if 'slot' in validated_data else (instance.slot if instance else None)

        # The kind: commanded when given, else guessed from the words we can see.
        kind = validated_data.get('kind') if 'kind' in validated_data else (instance.kind if instance else None)
        if not kind:
            guessed = infer_kind(name or '', category or '', garment_type or '', slot or '')
            if guessed:
                validated_data['kind'] = guessed
                kind = guessed

        # The slot: keep what is set; else the kind's slot; else the category's slot ('fullbody' maps to kurta).
        if not slot and kind:
            slot = slot_of_kind(kind)
        if not slot:
            category_row = validated_data.get('category_ref')
            if category_row is None and instance is not None:
                category_row = instance.category_ref
            category_slot = getattr(category_row, 'slot', '')
            if category_slot:
                slot = 'kurta' if category_slot == 'fullbody' else category_slot
        if slot and (instance is None or instance.slot != slot):
            validated_data['slot'] = slot

        # The shop section: keep what is set; else the category's section (Men/Women/Unisex).
        gender = validated_data.get('gender') if 'gender' in validated_data else (instance.gender if instance else None)
        if not gender:
            category_row = validated_data.get('category_ref')
            if category_row is None and instance is not None:
                category_row = instance.category_ref
            gender = getattr(category_row, 'gender', '') or ''
        if gender and (instance is None or instance.gender != gender):
            validated_data['gender'] = gender

        return validated_data

    def create(self, validated_data):
        validated_data = self._sync_sizes(self._sync_relations(validated_data))
        product = super().create(validated_data)
        self._sync_colour(product)
        return product

    def update(self, instance, validated_data):
        validated_data = self._sync_sizes(self._sync_relations(validated_data, instance), instance)
        product = super().update(instance, validated_data)
        self._sync_colour(product)
        return product

    @staticmethod
    def _sync_colour(product):
        colour = product.primary_color
        if colour:
            changed = []
            if product.color_name != colour.name:
                product.color_name = colour.name
                changed.append('color_name')
            if product.color_hex != colour.hex:
                product.color_hex = colour.hex
                changed.append('color_hex')
            if changed:
                product.save(update_fields=changed + ['updated_at'])


def active_category_names():
    return set(Category.objects.filter(is_active=True).values_list('name', flat=True))


def active_style_names():
    return {name.lower(): name for name in Style.objects.filter(is_active=True).values_list('name', flat=True)}
