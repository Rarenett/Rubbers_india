import re

with open(r'c:\Archana\glenda_vite\backend\logistics_app\serializers.py', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''from area_app.models import DeliveryLocation
class RouteStopMasterSerializer(serializers.ModelSerializer):
    delivery_locations_info = serializers.SerializerMethodField(read_only=True)
    delivery_location_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_empty=True
    )
    assigned_delivery_location_ids = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = RouteStopMaster
        fields = '__all__'

    def get_delivery_locations_info(self, obj):
        try:
            return [dl.location_name for dl in obj.delivery_locations.all()]
        except Exception:
            return []

    def get_assigned_delivery_location_ids(self, obj):
        try:
            return [dl.id for dl in obj.delivery_locations.all()]
        except Exception:
            return []

    def create(self, validated_data):
        delivery_location_ids = validated_data.pop('delivery_location_ids', [])
        instance = super().create(validated_data)
        if delivery_location_ids is not None:
            DeliveryLocation.objects.filter(id__in=delivery_location_ids).update(route_stop=instance)
        return instance

    def update(self, instance, validated_data):
        delivery_location_ids = validated_data.pop('delivery_location_ids', None)
        instance = super().update(instance, validated_data)
        if delivery_location_ids is not None:
            instance.delivery_locations.update(route_stop=None)
            if delivery_location_ids:
                DeliveryLocation.objects.filter(id__in=delivery_location_ids).update(route_stop=instance)
        return instance
'''

content = re.sub(r'class RouteStopMasterSerializer\(serializers\.ModelSerializer\):.*', replacement, content, flags=re.DOTALL)

with open(r'c:\Archana\glenda_vite\backend\logistics_app\serializers.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated serializers.py")
