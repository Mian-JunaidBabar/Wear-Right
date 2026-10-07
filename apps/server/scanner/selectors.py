from .models import FaceScanRecord
def get_face_scan_records():
    return FaceScanRecord.objects.all().order_by('-scan_date')
