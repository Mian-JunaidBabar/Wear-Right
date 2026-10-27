from rest_framework import serializers

from catalog.serializers import ProductSerializer

from .models import Booking, Cart, CartItem, Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ('id', 'product', 'name', 'price', 'size', 'quantity', 'line_total', 'image')

    def get_image(self, item):
        product = item.product
        if product is None:
            return None
        photo = product.mannequin_image or product.image
        return photo.url if photo else None


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    # Legacy single-product orders name their product here; checkout orders list theirs in `items`.
    product_name = serializers.CharField(source='product.name', read_only=True, default=None)

    class Meta:
        model = Order
        fields = '__all__'
        read_only_fields = ('user', 'total_amount', 'profit_amount', 'order_code', 'order_status', 'payment_method')


class CartItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = CartItem
        fields = ('id', 'product', 'product_id', 'size', 'quantity')
        read_only_fields = ('id',)


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    subtotal = serializers.SerializerMethodField()
    count = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ('id', 'items', 'subtotal', 'count')

    def get_subtotal(self, cart):
        return sum((item.product.price * item.quantity for item in cart.items.all()), 0)

    def get_count(self, cart):
        return sum(item.quantity for item in cart.items.all())


class CheckoutSerializer(serializers.Serializer):
    customer_name = serializers.CharField(max_length=255)
    customer_email = serializers.EmailField(required=False, allow_blank=True)
    customer_phone = serializers.CharField(max_length=30)
    customer_address = serializers.CharField()
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    payment_method = serializers.ChoiceField(choices=['cod', 'card_demo'], default='cod')

    def validate(self, data):
        # card_demo is deliberately fake: the UI says so, and no card number is ever accepted.
        forbidden = {'card_number', 'cvv', 'cvc', 'expiry', 'card_expiry'}
        if forbidden & set(self.initial_data):
            raise serializers.ValidationError('This demo does not accept card numbers. Choose cash on delivery or the demo card option.')
        return data


class BookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = '__all__'
        read_only_fields = ('user',)
