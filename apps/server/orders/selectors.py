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
    today = timezone.now()
    month_start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    products = Product.objects.all()
    orders = Order.objects.all()
    bookings = Booking.objects.all()
    face_scans = FaceScanRecord.objects.all()

    monthly_orders = orders.filter(order_date__gte=month_start)

    monthly_revenue = monthly_orders.aggregate(total=Sum('total_amount'))['total'] or 0
    monthly_profit = monthly_orders.aggregate(total=Sum('profit_amount'))['total'] or 0

    low_stock_products = products.filter(stock_quantity__lte=5).count()

    style_counts = {
        "Eastern": products.filter(cultural_tag="Eastern").count(),
        "Western": products.filter(cultural_tag="Western").count(),
        "Formal": products.filter(cultural_tag="Formal").count(),
        "Casual": products.filter(cultural_tag="Casual").count(),
    }

    skin_tone_counts = {
        "Fair": products.filter(compatible_skin_tone="Fair").count(),
        "Medium": products.filter(compatible_skin_tone="Medium").count(),
        "Dark": products.filter(compatible_skin_tone="Dark").count(),
    }

    order_status_counts = {
        "Pending": orders.filter(order_status="Pending").count(),
        "Confirmed": orders.filter(order_status="Confirmed").count(),
        "Shipped": orders.filter(order_status="Shipped").count(),
        "Delivered": orders.filter(order_status="Delivered").count(),
        "Cancelled": orders.filter(order_status="Cancelled").count(),
    }

    booking_status_counts = {
        "Pending": bookings.filter(status="Pending").count(),
        "Confirmed": bookings.filter(status="Confirmed").count(),
        "Completed": bookings.filter(status="Completed").count(),
        "Cancelled": bookings.filter(status="Cancelled").count(),
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
