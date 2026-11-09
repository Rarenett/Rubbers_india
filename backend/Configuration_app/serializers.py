from rest_framework import serializers
from .models import DynamicTableConfiguration

class DynamicTableConfigurationSerializer(serializers.ModelSerializer):
    class Meta:
        model = DynamicTableConfiguration
        fields = '__all__'
