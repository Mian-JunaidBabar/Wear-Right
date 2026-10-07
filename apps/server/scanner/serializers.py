from rest_framework import serializers
from .models import FaceScanRecord

class FaceScanRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = FaceScanRecord
        fields = '__all__'
