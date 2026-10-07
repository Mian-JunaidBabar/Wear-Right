from django.db import models
from core.models import TimeStampedModel

class Product(TimeStampedModel):
    CATEGORY_CHOICES = [
        ('Men Shirt', 'Men Shirt'), ('Men Pant', 'Men Pant'), ('Men Shoes', 'Men Shoes'), ('Men Cap', 'Men Cap'),
        ('Men Shalwar Kameez', 'Men Shalwar Kameez'), ('Men Sandals', 'Men Sandals'), ('Women Kurta', 'Women Kurta'),
        ('Women Shalwar Kameez', 'Women Shalwar Kameez'), ('Women Footwear', 'Women Footwear'),
        ('Women Pant', 'Women Pant'), ('Women Shirt', 'Women Shirt'),
    ]
    STYLE_CHOICES = [('Eastern', 'Eastern'), ('Western', 'Western'), ('Casual', 'Casual'), ('Formal', 'Formal')]
    SKIN_TONE_CHOICES = [('Fair', 'Fair'), ('Medium', 'Medium'), ('Dark', 'Dark'), ('All', 'All')]
    STATUS_CHOICES = [('Active', 'Active'), ('Inactive', 'Inactive'), ('Out of Stock', 'Out of Stock')]
    COLOR_CHOICES = [
        ('White', 'White'), ('Black', 'Black'), ('Navy Blue', 'Navy Blue'), ('Beige', 'Beige'), ('Grey', 'Grey'),
        ('Charcoal Grey', 'Charcoal Grey'), ('Tan', 'Tan'), ('Brown', 'Brown'), ('Dark Brown', 'Dark Brown'),
        ('Sky Blue', 'Sky Blue'), ('Royal Blue', 'Royal Blue'), ('Maroon', 'Maroon'), ('Wine Red', 'Wine Red'),
        ('Emerald Green', 'Emerald Green'), ('Deep Purple', 'Deep Purple'), ('Bottle Green', 'Bottle Green'),
        ('Burgundy', 'Burgundy'), ('Pastel Pink', 'Pastel Pink'), ('Soft Lavender', 'Soft Lavender'),
        ('Light Grey', 'Light Grey'), ('Denim Blue', 'Denim Blue'), ('Mustard Yellow', 'Mustard Yellow'),
        ('Olive Green', 'Olive Green'), ('Rust Orange', 'Rust Orange'), ('Teal', 'Teal'), ('Coral', 'Coral'),
        ('Camel', 'Camel'), ('Off-White', 'Off-White'), ('Peach', 'Peach'), ('Turquoise', 'Turquoise'),
        ('Khaki', 'Khaki'), ('Light Olive', 'Light Olive'), ('Deep Teal', 'Deep Teal'), ('Bright Yellow', 'Bright Yellow'),
        ('Fuchsia Pink', 'Fuchsia Pink'), ('Orange', 'Orange'), ('Bright Red', 'Bright Red'), ('Cobalt Blue', 'Cobalt Blue'),
        ('Yellow', 'Yellow'), ('Fuchsia', 'Fuchsia'), ('Bright Orange', 'Bright Orange'), ('Hot Pink', 'Hot Pink'),
        ('Lemon Yellow', 'Lemon Yellow'), ('Cream', 'Cream'), ('Charcoal', 'Charcoal'),
    ]
    GARMENT_TYPE_CHOICES = [('Top', 'Top'), ('Bottom', 'Bottom'), ('Footwear', 'Footwear'), ('Accessory', 'Accessory')]

    name = models.CharField(max_length=255)
    category = models.CharField(max_length=100, choices=CATEGORY_CHOICES)
    cultural_tag = models.CharField(max_length=100, choices=STYLE_CHOICES)
    compatible_skin_tone = models.CharField(max_length=50, choices=SKIN_TONE_CHOICES)
    color = models.CharField(max_length=50, choices=COLOR_CHOICES, blank=True, null=True)
    garment_type = models.CharField(max_length=50, choices=GARMENT_TYPE_CHOICES, blank=True, null=True)
    image = models.ImageField(upload_to='products/', blank=True, null=True)
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock_quantity = models.PositiveIntegerField(default=0)
    size_s_stock = models.PositiveIntegerField(default=0)
    size_m_stock = models.PositiveIntegerField(default=0)
    size_l_stock = models.PositiveIntegerField(default=0)
    size_xl_stock = models.PositiveIntegerField(default=0)
    size_xxl_stock = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Active')

    def profit_per_item(self):
        return self.price - self.cost_price

    def __str__(self):
        return self.name
