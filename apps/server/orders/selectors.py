from django.db.models import Sum
from django.utils import timezone
from .models import Order, Booking
from catalog.models import Product
from scanner.models import FaceScanRecord

def _scoped(queryset, user):
    """Owners see their own rows; staff see everything."""
    return queryset if user.is_staff else queryset.filter(user=user)

def get_orders(user):
    return _scoped(Order.objects.all(), user).order_by('-order_date')

def get_order(order_id, user):
    try:
        return _scoped(Order.objects.all(), user).get(id=order_id)
    except Order.DoesNotExist:
        return None

def get_bookings(user):
    return _scoped(Booking.objects.all(), user).order_by('-created_at')

def get_booking(booking_id, user):
    try:
        return _scoped(Booking.objects.all(), user).get(id=booking_id)
    except Booking.DoesNotExist:
        return None

def get_dashboard_stats():
    from catalog.models import Style

    today = timezone.now()
    month_start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    products = Product.objects.all()
    orders = Order.objects.all()
    bookings = Booking.objects.all()
    face_scans = FaceScanRecord.objects.all()

    # Cancelled orders never earned anything, so they stay out of revenue and profit.
    monthly_orders = orders.filter(order_date__gte=month_start).exclude(order_status='Cancelled')

    monthly_revenue = monthly_orders.aggregate(total=Sum('total_amount'))['total'] or 0
    monthly_profit = monthly_orders.aggregate(total=Sum('profit_amount'))['total'] or 0

    # Low stock only matters for products shoppers can actually see.
    low_stock_products = products.filter(is_active=True, status='Active', stock_quantity__lte=5).count()

    style_names = list(Style.objects.filter(is_active=True).values_list('name', flat=True)) or [
        "Eastern", "Western", "Formal", "Casual",
    ]
    style_counts = {name: products.filter(cultural_tag__iexact=name).count() for name in style_names}

    skin_tone_counts = {
        tone: products.filter(compatible_skin_tone=tone).count() for tone in ("Fair", "Medium", "Dark", "All")
    }

    order_status_counts = {
        name: orders.filter(order_status=name).count()
        for name, _ in Order.ORDER_STATUS_CHOICES
    }

    booking_status_counts = {
        name: bookings.filter(status=name).count()
        for name, _ in Booking.BOOKING_STATUS_CHOICES
    }

    return {
        "total_products": products.count(),
        "total_orders": orders.count(),
        "total_bookings": bookings.count(),
        "total_face_scans": face_scans.count(),
        "monthly_revenue": monthly_revenue,
        "monthly_profit": monthly_profit,
        "low_stock_products": low_stock_products,
        "style_counts": style_counts,
        "skin_tone_counts": skin_tone_counts,
        "order_status_counts": order_status_counts,
        "booking_status_counts": booking_status_counts,
    }
