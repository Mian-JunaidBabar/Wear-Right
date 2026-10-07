import factory
from django.contrib.auth.models import User

from accounts.models import UserProfile
from catalog.models import Product
from orders.models import Booking, Order
from scanner.models import FaceScanRecord

DEFAULT_PASSWORD = "S3cure-Pass!word"


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    username = factory.Sequence(lambda n: f"user{n}@example.com")
    email = factory.LazyAttribute(lambda o: o.username)

    @factory.post_generation
    def password(self, create, extracted, **kwargs):
        self.set_password(extracted or DEFAULT_PASSWORD)
        if create:
            self.save()


class StaffFactory(UserFactory):
    username = factory.Sequence(lambda n: f"staff{n}@example.com")
    is_staff = True


class UserProfileFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = UserProfile

    user = factory.SubFactory(UserFactory)


class ProductFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Product

    name = factory.Sequence(lambda n: f"Product {n}")
    category = "Men Shirt"
    cultural_tag = "Casual"
    compatible_skin_tone = "All"
    color = "Black"
    garment_type = "Top"
    cost_price = 1000
    price = 2000
    stock_quantity = 10
    status = "Active"


class OrderFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Order

    customer_name = "Test Customer"
    customer_email = "customer@example.com"
    product = factory.SubFactory(ProductFactory)
    quantity = 1


class BookingFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Booking

    customer_name = "Test Customer"
    customer_email = "customer@example.com"
    booking_type = "Styling Consultation"
    booking_date = "2030-01-01T10:00:00Z"


class FaceScanRecordFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = FaceScanRecord

    detected_skin_tone = "Medium"
    confidence_score = 80
    lighting_quality = "Good"
    brightness = 150
