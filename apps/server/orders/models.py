from django.contrib.auth.models import User
from django.db import models
from core.models import TimeStampedModel
from catalog.models import Product

class Order(TimeStampedModel):
    ORDER_STATUS_CHOICES = [
        ('Pending', 'Pending'), ('Confirmed', 'Confirmed'), ('Shipped', 'Shipped'),
        ('Delivered', 'Delivered'), ('Cancelled', 'Cancelled'),
    ]
    PAYMENT_STATUS_CHOICES = [
        ('Unpaid', 'Unpaid'), ('Paid', 'Paid'), ('Cash on Delivery', 'Cash on Delivery'),
    ]
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
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

class Booking(TimeStampedModel):
    BOOKING_TYPE_CHOICES = [
        ('Virtual Mannequin Preview', 'Virtual Mannequin Preview'),
        ('Styling Consultation', 'Styling Consultation'),
        ('Outfit Trial Request', 'Outfit Trial Request'),
    ]
    BOOKING_STATUS_CHOICES = [
        ('Pending', 'Pending'), ('Confirmed', 'Confirmed'), ('Completed', 'Completed'), ('Cancelled', 'Cancelled'),
    ]
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='bookings')
    customer_name = models.CharField(max_length=255)
    customer_email = models.EmailField(blank=True, null=True)
    customer_phone = models.CharField(max_length=30, blank=True, null=True)
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True, related_name='bookings')
    booking_type = models.CharField(max_length=100, choices=BOOKING_TYPE_CHOICES)
    booking_date = models.DateTimeField()
    status = models.CharField(max_length=50, choices=BOOKING_STATUS_CHOICES, default='Pending')

    def __str__(self):
        return f"{self.booking_type} - {self.customer_name}"
