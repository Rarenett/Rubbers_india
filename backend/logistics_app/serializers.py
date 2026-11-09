from rest_framework import serializers
from .models import Vehicle_category, Vehicle,Driver,ServiceType,VehicleHistory,DriverAuditLog,VehicleAuditLog,VehicleHistoryAuditLog,FineAndToken, DriverJourney, DriverRoute, RouteLog, ServiceRequest, RouteMaster, TripMaster, PackageType, ItemSpecification, RouteStopMaster,TyreSize


class VehicleCategorySerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Vehicle_category
        fields = ['id', 'category_name', 'created_by', 'created_by_name']
        read_only_fields = ['created_by']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.email
        return None

    def validate_category_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Category name cannot be blank.")
        # Case-insensitive unique check, excluding current instance on update
        qs = Vehicle_category.objects.filter(category_name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                f'A vehicle category named "{value}" already exists.'
            )
        return value


class VehicleSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    category_name = serializers.SerializerMethodField()
    driver_name = serializers.SerializerMethodField()

    class Meta:
        model = Vehicle
        fields = [
            'id', 'category', 'category_name', 'driver', 'driver_name', 'vehicle_code', 'vehicle_name', 'vehicle_number',
            'vehicle_img', 'fuel_type', 'mileage', 'tonnage', 'volume', 'capacity', 'rate',
            'front_tyre_size', 'rear_tyre_size', 'vehicle_insurance_date', 'vehicle_taxes_date',
            'vehicle_pollution_date', 'next_service_date', 'next_retest_date', 'vehicle_fasttag',
            'narration', 'created_by', 'created_by_name', 'vehicle_status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by', 'vehicle_code']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.email
        return None

    def get_category_name(self, obj):
        if obj.category:
            return obj.category.category_name
        return None

    def get_driver_name(self, obj):
        if obj.driver and obj.driver.user:
            return obj.driver.user.get_full_name() or str(obj.driver)
        return None

    def validate_vehicle_name(self, value):
        if value:
            value = value.strip()
            qs = Vehicle.objects.filter(vehicle_name__iexact=value)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    f'A vehicle with name "{value}" already exists.'
                )
        return value

    def validate_vehicle_number(self, value):
        value = value.strip().upper()
        if not value:
            raise serializers.ValidationError("Vehicle number cannot be blank.")
        qs = Vehicle.objects.filter(vehicle_number__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                f'A vehicle with number "{value}" already exists.'
            )
        return value

class DriverSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(
        source='created_by.get_full_name',
        read_only=True
    )
    user_full_name = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    mobile = serializers.CharField(source='phone_number', required=False, allow_null=True, allow_blank=True)
    license_expiry = serializers.DateField(source='license_exp_date', required=False, allow_null=True)

    class Meta:
        model = Driver
        fields = '__all__'

    def get_user_full_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.email
        return None

    def get_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username or obj.user.email
        return None

    def get_email(self, obj):
        if obj.user:
            return obj.user.email
        return None

class ServiceTypeSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    # required=False so that hidden fields (omitted from payload) don't trigger
    # "this field is required" error — field-level validation still runs if present
    service_type = serializers.CharField(required=False, allow_blank=True, max_length=100)
    description  = serializers.CharField(required=False, allow_blank=True, allow_null=True)
 
    class Meta:
        model  = ServiceType
        fields = ['id', 'service_type', 'description', 'created_by', 'created_by_name', 'created_at', 'updated_at']
        read_only_fields = ['created_by', 'created_at', 'updated_at']
 
    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.email
        return None
 
    def validate_service_type(self, value):
        # If field was hidden it may arrive as empty string — skip uniqueness check
        if not value or not value.strip():
            return value
        value = value.strip()
        qs = ServiceType.objects.filter(service_type__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                f'A service type named "{value}" already exists.'
            )
        return value

class VehicleHistorySerializer(serializers.ModelSerializer):
    vehicle_name           = serializers.SerializerMethodField()
    vehicle_number_display = serializers.SerializerMethodField()
    driver_name            = serializers.SerializerMethodField()
    service_type_name      = serializers.SerializerMethodField()
    created_by_name        = serializers.SerializerMethodField()
    attachment_url         = serializers.SerializerMethodField()

    class Meta:
        model  = VehicleHistory
        fields = [
            'id', 'trans_no', 'trans_date',
            'vehicle', 'vehicle_name', 'vehicle_number_display',
            'default_driver', 'driver_name',
            'actual_km',
            'service_type', 'service_type_name',
            'cost', 'fuel_liters',  # ← NEW: fuel_liters added here
            'attachment', 'attachment_url', 'narration',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['trans_no', 'created_by', 'created_at', 'updated_at']

    def get_vehicle_name(self, obj):
        return obj.vehicle.vehicle_name if obj.vehicle else None

    def get_vehicle_number_display(self, obj):
        return obj.vehicle.vehicle_number if obj.vehicle else None

    def get_driver_name(self, obj):
        if obj.default_driver and obj.default_driver.user:
            return obj.default_driver.user.get_full_name() or obj.default_driver.user.email
        return None

    def get_service_type_name(self, obj):
        return obj.service_type.service_type if obj.service_type else None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.email
        return None

    def get_attachment_url(self, obj):
        request = self.context.get('request')
        if obj.attachment and request:
            return request.build_absolute_uri(obj.attachment.url)
        return None

class FineAndTokenSerializer(serializers.ModelSerializer):
    vehicle_name = serializers.SerializerMethodField()
    vehicle_number = serializers.SerializerMethodField()
    driver_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    attachment_name = serializers.SerializerMethodField()

    class Meta:
        model = FineAndToken
        fields = [
            'id', 'fine_no', 'fine_date', 'vehicle', 'vehicle_name', 'vehicle_number',
            'driver', 'driver_name', 'amount', 'narration', 'attachment', 'attachment_name',
            'status', 'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['fine_no', 'created_by', 'created_at', 'updated_at']

    def get_vehicle_name(self, obj):
        return obj.vehicle.vehicle_name if obj.vehicle else None

    def get_vehicle_number(self, obj):
        return obj.vehicle.vehicle_number if obj.vehicle else None

    def get_driver_name(self, obj):
        if obj.driver and obj.driver.user:
            return obj.driver.user.get_full_name() or obj.driver.user.username or obj.driver.user.email
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_attachment_name(self, obj):
        if obj.attachment:
            return obj.attachment.name.split('/')[-1]
        return None

class ServiceRequestSerializer(serializers.ModelSerializer):
    driver_name = serializers.SerializerMethodField()
    vehicle_name = serializers.SerializerMethodField()
    vehicle_number = serializers.SerializerMethodField()
    service_type_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ServiceRequest
        fields = '__all__'

    def get_driver_name(self, obj):
        if obj.driver and obj.driver.user:
            return obj.driver.user.get_full_name() or obj.driver.user.username
        return None

    def get_vehicle_name(self, obj):
        return obj.vehicle.vehicle_name if obj.vehicle else None
        
    def get_vehicle_number(self, obj):
        return obj.vehicle.vehicle_number if obj.vehicle else None

    def get_service_type_name(self, obj):
        return obj.service_type.service_type if obj.service_type else None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

#### log

class DriverAuditLogSerializer(serializers.ModelSerializer):

    username = serializers.SerializerMethodField()
    driver_name = serializers.SerializerMethodField()

    class Meta:
        model = DriverAuditLog

        fields = [
            'id',
            'driver_name',
            'action',
            'remarks',
            'modified_at',
            'username'
        ]

    def get_driver_name(self, obj):
        name = obj.driver_name
        if name and ' - ' in name:
            return name.split(' - ')[0]
        return name

    def get_username(self, obj):

        if obj.modified_by:
            return (
                obj.modified_by.get_full_name()
                or obj.modified_by.username
                or obj.modified_by.email
            )

        return ""
class VehicleAuditLogSerializer(serializers.ModelSerializer):

    username = serializers.SerializerMethodField()

    class Meta:
        model = VehicleAuditLog

        fields = [
            'id',
            'vehicle_name',
            'vehicle_number',
            'action',
            'remarks',
            'modified_at',
            'username'
        ]

    def get_username(self, obj):

        if obj.modified_by:
            return (
                obj.modified_by.get_full_name()
                or obj.modified_by.username
                or obj.modified_by.email
            )

        return ""

class VehicleHistoryAuditLogSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField()

    class Meta:
        model = VehicleHistoryAuditLog
        fields = [
            'id',
            'trans_no',
            'vehicle_name',
            'vehicle_number',
            'action',
            'remarks',
            'modified_at',
            'username',
        ]

    def get_username(self, obj):
        if obj.modified_by:
            return (
                obj.modified_by.get_full_name()
                or obj.modified_by.username
                or obj.modified_by.email
            )
        return ""

class DriverJourneySerializer(serializers.ModelSerializer):
    driver_name = serializers.SerializerMethodField()

    class Meta:
        model = DriverJourney
        fields = ['id', 'driver', 'driver_name', 'date', 'start_km', 'end_km', 'status', 'created_at', 'updated_at']

    def get_driver_name(self, obj):
        if obj.driver and obj.driver.user:
            return obj.driver.user.get_full_name() or obj.driver.user.username
        return "Unknown"

class RouteLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = RouteLog
        fields = ['id', 'from_location', 'to_location', 'order_index']

class DriverRouteSerializer(serializers.ModelSerializer):
    logs = RouteLogSerializer(many=True)

    class Meta:
        model = DriverRoute
        fields = ['id', 'driver', 'vehicle', 'date', 'created_at', 'updated_at', 'logs']

    def create(self, validated_data):
        logs_data = validated_data.pop('logs', [])
        route = DriverRoute.objects.create(**validated_data)
        for i, log_data in enumerate(logs_data):
            log_data['order_index'] = log_data.get('order_index', i)
            RouteLog.objects.create(route=route, **log_data)
        return route

    def update(self, instance, validated_data):
        logs_data = validated_data.pop('logs', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if logs_data is not None:
            instance.logs.all().delete()
            for i, log_data in enumerate(logs_data):
                log_data['order_index'] = log_data.get('order_index', i)
                RouteLog.objects.create(route=instance, **log_data)
        
        return instance

class RouteMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = RouteMaster
        fields = '__all__'

class TripMasterSerializer(serializers.ModelSerializer):
    vehicle_name = serializers.CharField(source='vehicle.vehicle_name', read_only=True)
    driver_name = serializers.SerializerMethodField(read_only=True)
    route_name = serializers.CharField(source='route.route_name', read_only=True)

    class Meta:
        model = TripMaster
        fields = '__all__'

    def get_driver_name(self, obj):
        if obj.driver and obj.driver.user:
            return obj.driver.user.get_full_name() or obj.driver.user.username
        if obj.driver:
            return f"Driver {obj.driver.id}"
        return "Unknown"

class PackageTypeSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = PackageType
        fields = '__all__'
        read_only_fields = ['pack_id', 'volume', 'created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username or obj.created_by.email
        return "Unknown"

class ItemSpecificationSerializer(serializers.ModelSerializer):
    stock_item_name = serializers.CharField(source='stock_item.name', read_only=True)
    package_type_name = serializers.CharField(source='package_type.pack_name', read_only=True)
    created_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ItemSpecification
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username or obj.created_by.email
        return "Unknown"

class TyreSizeSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)
    tyre_type_display = serializers.CharField(source='get_tyre_type_display', read_only=True)

    class Meta:
        model = TyreSize
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username or obj.created_by.email
        return "Unknown"
from area_app.models import DeliveryLocation
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
            return [dl.location_name for dl in obj.area_delivery_locations.all()]
        except Exception:
            return []

    def get_assigned_delivery_location_ids(self, obj):
        try:
            return [dl.id for dl in obj.area_delivery_locations.all()]
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
            instance.area_delivery_locations.update(route_stop=None)
            if delivery_location_ids:
                DeliveryLocation.objects.filter(id__in=delivery_location_ids).update(route_stop=instance)
        return instance
