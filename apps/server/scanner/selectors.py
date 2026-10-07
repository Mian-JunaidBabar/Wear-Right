from .models import FaceScanRecord


def get_face_scan_records(user):
    """Scans the user may see: their own, or all for staff."""
    records = FaceScanRecord.objects.all().order_by('-scan_date')
    if user.is_staff:
        return records
    return records.filter(user=user)
