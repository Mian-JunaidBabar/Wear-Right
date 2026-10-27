from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.utils.text import slugify
from core.models import TimeStampedModel


class Category(TimeStampedModel):
    """A shop category. Staff add, rename, reorder or switch these off; the shop and admin read them from the API."""
    GENDER_CHOICES = [('men', 'Men'), ('women', 'Women'), ('unisex', 'Unisex')]
    SLOT_CHOICES = [
        ('top', 'Top'), ('bottom', 'Bottom'), ('outerwear', 'Outerwear'), ('footwear', 'Footwear'),
        ('accessory', 'Accessory'), ('fullbody', 'Full body'),
    ]
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True, blank=True)
    slot = models.CharField(max_length=20, choices=SLOT_CHOICES, blank=True, default='')
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, default='unisex')  # which shop tab(s) it appears under
    group = models.CharField(max_length=40, blank=True, default='')  # "Regional" for eastern and regional wear
    image = models.CharField(max_length=255, blank=True, default='')  # tile image path; blank uses a product photo
    sort_order = models.PositiveSmallIntegerField(default=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['sort_order', 'name']
        verbose_name_plural = 'categories'

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name)[:100] or 'category'
            slug, suffix = base, 2
            while Category.objects.exclude(pk=self.pk).filter(slug=slug).exists():
                slug, suffix = f'{base}-{suffix}', suffix + 1
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Color(TimeStampedModel):
    """A named colour staff can attach to products. The hex value is the shop/admin swatch."""
    FAMILY_CHOICES = [
        ('white', 'White'), ('black', 'Black'), ('grey', 'Grey'), ('brown', 'Brown'),
        ('blue', 'Blue'), ('green', 'Green'), ('red', 'Red'), ('pink/purple', 'Pink / purple'),
        ('yellow/orange', 'Yellow / orange'),
    ]
    name = models.CharField(max_length=60, unique=True)
    hex = models.CharField(
        max_length=7, default='#000000',
        validators=[RegexValidator(r'^#[0-9A-Fa-f]{6}$', 'Use a hex colour such as #1a2b3c.')],
    )
    family = models.CharField(max_length=20, choices=FAMILY_CHOICES, blank=True, default='')

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Style(TimeStampedModel):
    """A style a product can have and a shopper can prefer (Casual, Formal, Eastern, ...)."""
    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(max_length=50, unique=True)
    sort_order = models.PositiveSmallIntegerField(default=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name


class Product(TimeStampedModel):
    SKIN_TONE_CHOICES = [('Fair', 'Fair'), ('Medium', 'Medium'), ('Dark', 'Dark'), ('All', 'All')]
    # Draft: imported and not yet priced by an admin. Hidden from shoppers, visible to staff.
    STATUS_CHOICES = [('Active', 'Active'), ('Inactive', 'Inactive'), ('Out of Stock', 'Out of Stock'), ('Draft', 'Draft')]
    SLOT_CHOICES = [
        ('top', 'Top'), ('bottom', 'Bottom'), ('kurta', 'Kurta / kameez'), ('outerwear', 'Outerwear'),
        ('footwear', 'Footwear'), ('accessory', 'Accessory'), ('dupatta', 'Dupatta'),
    ]
    GENDER_CHOICES = [('men', 'Men'), ('women', 'Women'), ('unisex', 'Unisex')]
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
    slug = models.SlugField(max_length=280, unique=True, blank=True)
    description = models.TextField(blank=True, default='')
    category = models.CharField(max_length=100)    # a Category name; checked against the table by the serializer
    # Proper relation for filtering and admin; the CharField above is kept as the denormalised name for
    # existing imports and API clients (a compatibility layer, see docs/phases/phase-2.md).
    category_ref = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='products',
    )
    cultural_tag = models.CharField(max_length=100)  # a Style name
    style = models.CharField(
        max_length=20, choices=[('casual', 'Casual'), ('formal', 'Formal'), ('eastern', 'Eastern')],
        blank=True, default='',
    )
    compatible_skin_tone = models.CharField(max_length=50, choices=SKIN_TONE_CHOICES)
    color = models.CharField(max_length=50, choices=COLOR_CHOICES, blank=True, null=True)
    primary_color = models.ForeignKey(Color, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
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
    sizes = models.JSONField(default=list, blank=True)  # ["S", "M", "L"]; derived from the per-size stock on save
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Active')
    is_active = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name)[:240] or 'product'
            slug, suffix = base, 2
            while Product.objects.exclude(pk=self.pk).filter(slug=slug).exists():
                slug, suffix = f'{base}-{suffix}', suffix + 1
            self.slug = slug
        if not self.style:
            tag = (self.cultural_tag or '').lower()
            self.style = {'eastern': 'eastern', 'regional': 'eastern', 'formal': 'formal'}.get(tag, 'casual')
        if not self.sizes:
            sizes = ['S', 'M', 'L', 'XL', 'XXL']
            stock = [self.size_s_stock, self.size_m_stock, self.size_l_stock, self.size_xl_stock, self.size_xxl_stock]
            self.sizes = [size for size, quantity in zip(sizes, stock) if quantity > 0]
        super().save(*args, **kwargs)

    # Catalog fields (phase 2). Used by the look rules in phase 4; blank for hand-made products until tagged.
    external_id = models.CharField(max_length=32, unique=True, null=True, blank=True)  # Kaggle image id for imports
    slot = models.CharField(max_length=20, choices=SLOT_CHOICES, blank=True, null=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, null=True)
    formality = models.PositiveSmallIntegerField(
        blank=True, null=True, validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    style_tags = models.JSONField(default=list, blank=True)
    color_name = models.CharField(max_length=60, blank=True, null=True)
    color_hex = models.CharField(
        max_length=7, blank=True, null=True,
        validators=[RegexValidator(r'^#[0-9A-Fa-f]{6}$', 'Use a hex colour such as #1a2b3c.')],
    )
    # Dominant colours from k-means on the cut-out pixels: [{"hex", "name", "share"}], largest first.
    color_palette = models.JSONField(default=list, blank=True)

    # Mannequin (phase 5). mannequin_image is the cut-out trimmed to the garment; back_image is optional.
    mannequin_image = models.ImageField(upload_to='products/mannequin/', blank=True, null=True)
    back_image = models.ImageField(upload_to='products/back/', blank=True, null=True)
    mannequin_ready = models.BooleanField(default=False)
    mannequin_note = models.CharField(max_length=120, blank=True, default='')  # why a photo cannot be placed

    def profit_per_item(self):
        return self.price - self.cost_price

    def __str__(self):
        return self.name
