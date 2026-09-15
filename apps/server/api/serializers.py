from rest_framework import serializers
from .models import Product, UserProfile, Order, Booking, FaceScanRecord


class ProductSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    profit_per_item = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id',
            'name',
            'category',
            'cultural_tag',
            'compatible_skin_tone',
            'color',
            'garment_type',
            'image',
            'image_url',
            'cost_price',
            'price',
            'profit_per_item',
            'stock_quantity',
            'size_s_stock',
            'size_m_stock',
            'size_l_stock',
            'size_xl_stock',
            'size_xxl_stock',
            'status',
            'created_at',
        ]

    def get_image_url(self, obj):
        request = self.context.get('request')

        if obj.image:
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url

        return None

    def get_profit_per_item(self, obj):
        return obj.price - obj.cost_price


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            'id',
            'user',
            'username',
            'email',
            'skin_tone',
            'cultural_preference',
        ]


class OrderSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id',
            'order_code',
            'customer_name',
            'customer_email',
            'customer_phone',
            'customer_address',
            'product',
            'product_name',
            'product_image_url',
            'quantity',
            'total_amount',
            'profit_amount',
            'order_status',
            'payment_status',
            'order_date',
        ]

        read_only_fields = [
            'total_amount',
            'profit_amount',
            'order_date',
        ]

    def get_product_image_url(self, obj):
        request = self.context.get('request')

        if obj.product and obj.product.image:
            if request:
                return request.build_absolute_uri(obj.product.image.url)
            return obj.product.image.url

        return None


class BookingSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            'id',
            'customer_name',
            'customer_email',
            'customer_phone',
            'product',
            'product_name',
            'product_image_url',
            'booking_type',
            'booking_date',
            'status',
            'created_at',
        ]

    def get_product_image_url(self, obj):
        request = self.context.get('request')

        if obj.product and obj.product.image:
            if request:
                return request.build_absolute_uri(obj.product.image.url)
            return obj.product.image.url

        return None


class FaceScanRecordSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = FaceScanRecord
        fields = [
            'id',
            'user',
            'username',
            'visitor_name',
            'detected_skin_tone',
            'confidence_score',
            'lighting_quality',
            'brightness',
            'scan_date',
        ]