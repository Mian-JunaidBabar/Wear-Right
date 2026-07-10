from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):
    STYLE_CHOICES = [
        ('Eastern', 'Eastern'),
        ('Western', 'Western'),
        ('Formal', 'Formal'),
        ('Casual', 'Casual'),
    ]

    SKIN_TONE_CHOICES = [
        ('Fair', 'Fair'),
        ('Medium', 'Medium'),
        ('Dark', 'Dark'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE)
    skin_tone = models.CharField(max_length=50, choices=SKIN_TONE_CHOICES, blank=True, null=True)
    cultural_preference = models.CharField(max_length=50, choices=STYLE_CHOICES, default='Western')

    def __str__(self):
        return self.user.username


class Product(models.Model):
    CATEGORY_CHOICES = [
        ('Men Shirt', 'Men Shirt'),
        ('Men Pant', 'Men Pant'),
        ('Men Shoes', 'Men Shoes'),
        ('Men Cap', 'Men Cap'),
        ('Men Shalwar Kameez', 'Men Shalwar Kameez'),
        ('Men Sandals', 'Men Sandals'),
        ('Women Kurta', 'Women Kurta'),
        ('Women Shalwar Kameez', 'Women Shalwar Kameez'),
        ('Women Footwear', 'Women Footwear'),
        ('Women Pant', 'Women Pant'),
        ('Women Shirt', 'Women Shirt'),
    ]

    STYLE_CHOICES = [
        ('Eastern', 'Eastern'),
        ('Western', 'Western'),
        ('Casual', 'Casual'),
        ('Formal', 'Formal'),
    ]

    SKIN_TONE_CHOICES = [
        ('Fair', 'Fair'),
        ('Medium', 'Medium'),
        ('Dark', 'Dark'),
        ('All', 'All'),
    ]

    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
        ('Out of Stock', 'Out of Stock'),
    ]

    # NEW: Color choices for outfit matching system
    COLOR_CHOICES = [
        ('White', 'White'),
        ('Black', 'Black'),
        ('Navy Blue', 'Navy Blue'),
        ('Beige', 'Beige'),
        ('Grey', 'Grey'),
        ('Charcoal Grey', 'Charcoal Grey'),
        ('Tan', 'Tan'),
        ('Brown', 'Brown'),
        ('Dark Brown', 'Dark Brown'),
        ('Sky Blue', 'Sky Blue'),
        ('Royal Blue', 'Royal Blue'),
        ('Maroon', 'Maroon'),
        ('Wine Red', 'Wine Red'),
        ('Emerald Green', 'Emerald Green'),
        ('Deep Purple', 'Deep Purple'),
        ('Bottle Green', 'Bottle Green'),
        ('Burgundy', 'Burgundy'),
        ('Pastel Pink', 'Pastel Pink'),
        ('Soft Lavender', 'Soft Lavender'),
        ('Light Grey', 'Light Grey'),
        ('Denim Blue', 'Denim Blue'),
        ('Mustard Yellow', 'Mustard Yellow'),
        ('Olive Green', 'Olive Green'),
        ('Rust Orange', 'Rust Orange'),
        ('Teal', 'Teal'),
        ('Coral', 'Coral'),
        ('Camel', 'Camel'),
        ('Off-White', 'Off-White'),
        ('Peach', 'Peach'),
        ('Turquoise', 'Turquoise'),
        ('Khaki', 'Khaki'),
        ('Light Olive', 'Light Olive'),
        ('Deep Teal', 'Deep Teal'),
        ('Bright Yellow', 'Bright Yellow'),
        ('Fuchsia Pink', 'Fuchsia Pink'),
        ('Orange', 'Orange'),
        ('Bright Red', 'Bright Red'),
        ('Cobalt Blue', 'Cobalt Blue'),
        ('Yellow', 'Yellow'),
        ('Fuchsia', 'Fuchsia'),
        ('Bright Orange', 'Bright Orange'),
        ('Hot Pink', 'Hot Pink'),
        ('Lemon Yellow', 'Lemon Yellow'),
        ('Cream', 'Cream'),
        ('Charcoal', 'Charcoal'),
    ]

    # NEW: Garment type - tells system if item is Top/Bottom/Footwear/Accessory
    GARMENT_TYPE_CHOICES = [
        ('Top', 'Top'),
        ('Bottom', 'Bottom'),
        ('Footwear', 'Footwear'),
        ('Accessory', 'Accessory'),
    ]

    name = models.CharField(max_length=255)
    category = models.CharField(max_length=100, choices=CATEGORY_CHOICES)
    cultural_tag = models.CharField(max_length=100, choices=STYLE_CHOICES)
    compatible_skin_tone = models.CharField(max_length=50, choices=SKIN_TONE_CHOICES)

    # NEW FIELDS
    color = models.CharField(max_length=50, choices=COLOR_CHOICES, blank=True, null=True)
    garment_type = models.CharField(max_length=50, choices=GARMENT_TYPE_CHOICES, blank=True, null=True)

    image = models.ImageField(upload_to='products/', blank=True, null=True)

    cost_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock_quantity = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Active')

    created_at = models.DateTimeField(auto_now_add=True)

    def profit_per_item(self):
        return self.price - self.cost_price

    def __str__(self):
        return self.name


class Order(models.Model):
    ORDER_STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Confirmed', 'Confirmed'),
        ('Shipped', 'Shipped'),
        ('Delivered', 'Delivered'),
        ('Cancelled', 'Cancelled'),
    ]

    PAYMENT_STATUS_CHOICES = [
        ('Unpaid', 'Unpaid'),
        ('Paid', 'Paid'),
        ('Cash on Delivery', 'Cash on Delivery'),
    ]

    order_code = models.CharField(max_length=100, blank=True, null=True)
    customer_name = models.CharField(max_length=255)
    customer_email = models.EmailField(blank=True, null=True)
    customer_phone = models.CharField(max_length=30, blank=True, null=True)
    customer_address = models.TextField(blank=True, null=True)

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='orders')
    quantity = models.PositiveIntegerField(default=1)

    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    profit_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    order_status = models.CharField(max_length=50, choices=ORDER_STATUS_CHOICES, default='Pending')
    payment_status = models.CharField(max_length=50, choices=PAYMENT_STATUS_CHOICES, default='Cash on Delivery')

    order_date = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        self.total_amount = self.product.price * self.quantity
        self.profit_amount = (self.product.price - self.product.cost_price) * self.quantity
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Order #{self.id} - {self.customer_name}"


class Booking(models.Model):
    BOOKING_TYPE_CHOICES = [
        ('Virtual Mannequin Preview', 'Virtual Mannequin Preview'),
        ('Styling Consultation', 'Styling Consultation'),
        ('Outfit Trial Request', 'Outfit Trial Request'),
    ]

    BOOKING_STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Confirmed', 'Confirmed'),
        ('Completed', 'Completed'),
        ('Cancelled', 'Cancelled'),
    ]

    customer_name = models.CharField(max_length=255)
    customer_email = models.EmailField(blank=True, null=True)
    customer_phone = models.CharField(max_length=30, blank=True, null=True)

    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True, related_name='bookings')
    booking_type = models.CharField(max_length=100, choices=BOOKING_TYPE_CHOICES)
    booking_date = models.DateTimeField()
    status = models.CharField(max_length=50, choices=BOOKING_STATUS_CHOICES, default='Pending')

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.booking_type} - {self.customer_name}"


class FaceScanRecord(models.Model):
    SKIN_TONE_CHOICES = [
        ('Fair', 'Fair'),
        ('Medium', 'Medium'),
        ('Dark', 'Dark'),
        ('Rescan Required', 'Rescan Required'),
        ('Unknown', 'Unknown'),
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