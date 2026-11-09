from django.db import transaction
from rest_framework import serializers
from .models import Area, SalesmanMapping, DeliveryLocation, SalesmanVisiting, AreaLocationMapping, AreaGeofenceHistory, DeliveryLocationCoordinate

class DeliveryLocationCoordinateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryLocationCoordinate
        fields = ['id', 'delivery_location', 'latitude', 'longitude', 'created_at', 'updated_at']

class AreaGeofenceHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AreaGeofenceHistory
        fields = ['id', 'area', 'version_number', 'geofence_type', 'geofence_radius', 'polygon_coordinates', 'latitude', 'longitude', 'change_type', 'description', 'created_at', 'polygon_distances', 'total_distance_km']
class DeliveryLocationSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    area_name = serializers.CharField(source='area.name', read_only=True)
    route_stop = serializers.PrimaryKeyRelatedField(
        queryset=Area.objects.none(),  # Dummy, not used for write on DeliveryLocation here typically
        required=False,
        allow_null=True
    )
    route_stop_name = serializers.CharField(source='route_stop.stop_name', read_only=True)

    class Meta:
        model = DeliveryLocation
        fields = ['id', 'area', 'area_name', 'location_name', 'location_number', 'status', 'route_stop', 'route_stop_name', 'created_at']
        read_only_fields = ['location_number']
        extra_kwargs = {'area': {'required': False}}

class AreaSerializer(serializers.ModelSerializer):
    delivery_locations = DeliveryLocationSerializer(many=True, required=False)
    delivery_locations_count = serializers.SerializerMethodField()

    class Meta:
        model = Area
        fields = ['id', 'name', 'status', 'latitude', 'longitude', 'google_place_id', 'formatted_address', 'geofence_type', 'geofence_radius', 'polygon_coordinates', 'delivery_locations', 'delivery_locations_count', 'created_at', 'updated_at']

    def get_delivery_locations_count(self, obj):
        return obj.delivery_locations.count()

    def create(self, validated_data):
        delivery_locations_data = validated_data.pop('delivery_locations', [])
        
        with transaction.atomic():
            area = Area.objects.create(**validated_data)
            
            for index, location_data in enumerate(delivery_locations_data, start=1):
                DeliveryLocation.objects.create(
                    area=area,
                    location_number=index,
                    location_name=location_data.get('location_name'),
                    status=location_data.get('status', 'Active')
                )
                
            return area

    def update(self, instance, validated_data):
        delivery_locations_data = validated_data.pop('delivery_locations', None)
        
        with transaction.atomic():
            instance.name = validated_data.get('name', instance.name)
            instance.status = validated_data.get('status', instance.status)
            instance.save()
            
            if delivery_locations_data is not None:
                existing_ids = [loc.id for loc in instance.delivery_locations.all()]
                incoming_ids = [item.get('id') for item in delivery_locations_data if item.get('id')]
                
                # Delete missing locations
                DeliveryLocation.objects.filter(area=instance, id__in=set(existing_ids) - set(incoming_ids)).delete()
                
                # Create or Update
                for index, loc_data in enumerate(delivery_locations_data, start=1):
                    loc_id = loc_data.get('id')
                    if loc_id and loc_id in existing_ids:
                        loc = DeliveryLocation.objects.get(id=loc_id, area=instance)
                        loc.location_name = loc_data.get('location_name', loc.location_name)
                        loc.status = loc_data.get('status', loc.status)
                        if 'route_stop' in loc_data:
                            loc.route_stop_id = loc_data.get('route_stop')
                        loc.location_number = index
                        loc.save()
                    else:
                        DeliveryLocation.objects.create(
                            area=instance,
                            location_number=index,
                            location_name=loc_data.get('location_name'),
                            status=loc_data.get('status', 'Active'),
                            route_stop_id=loc_data.get('route_stop')
                        )
            
            return instance

class SalesmanMappingSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    employee_name = serializers.SerializerMethodField()
    area_name = serializers.SerializerMethodField()
    reporting_person_department_name = serializers.CharField(source='reporting_person_department.name', read_only=True)
    reporting_person_name = serializers.SerializerMethodField()

    class Meta:
        model = SalesmanMapping
        fields = ['id', 'area', 'area_name', 'department', 'department_name', 'employee', 'employee_name', 'reporting_person_department', 'reporting_person_department_name', 'reporting_person', 'reporting_person_name', 'created_at', 'updated_at']

    def get_employee_name(self, obj):
        try:
            return obj.employee.user.first_name + ' ' + obj.employee.user.last_name if obj.employee and obj.employee.user else str(obj.employee)
        except Exception:
            return str(obj.employee)

    def get_reporting_person_name(self, obj):
        try:
            return obj.reporting_person.user.first_name + ' ' + obj.reporting_person.user.last_name if obj.reporting_person and obj.reporting_person.user else str(obj.reporting_person) if obj.reporting_person else None
        except Exception:
            return str(obj.reporting_person) if obj.reporting_person else None

    def get_area_name(self, obj):
        return obj.area.name if obj.area else None

    def validate(self, data):
        employee = data.get('employee')
        department = data.get('department')
        if employee and department:
            if not employee.dept_designation or employee.dept_designation.department != department:
                raise serializers.ValidationError({"employee": ["Employee does not belong to the selected department."]})
                
        # the serializer instance has self.instance on update.
        # merge data with instance to get final values for validation
        final_employee = employee if employee is not None else (self.instance.employee if self.instance else None)
        
        reporting_person = data.get('reporting_person')
        reporting_person_department = data.get('reporting_person_department')
        
        # On update, fields might not be in data if they haven't changed.
        # we check if they are in data, otherwise fallback to instance.
        final_rp = reporting_person if 'reporting_person' in data else (self.instance.reporting_person if self.instance else None)
        final_rp_dept = reporting_person_department if 'reporting_person_department' in data else (self.instance.reporting_person_department if self.instance else None)

        if not final_rp_dept:
            raise serializers.ValidationError({"reporting_person_department": ["Please select a reporting person department."]})
            
        if not final_rp:
            raise serializers.ValidationError({"reporting_person": ["Please select a reporting person."]})
            
        if final_rp and final_rp_dept:
            if not final_rp.dept_designation or final_rp.dept_designation.department != final_rp_dept:
                raise serializers.ValidationError({"reporting_person": ["The selected reporting person does not belong to the selected department."]})
                
        if final_employee and final_rp and final_employee == final_rp:
            raise serializers.ValidationError({"reporting_person": ["A salesman cannot be their own reporting person."]})
            
        return data

class SalesmanVisitingSerializer(serializers.ModelSerializer):
    salesman_name = serializers.SerializerMethodField()
    area_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    reporting_person_name = serializers.SerializerMethodField()
    delivery_location_name = serializers.CharField(source='delivery_location.location_name', read_only=True)
    
    class Meta:
        model = SalesmanVisiting
        fields = [
            'id', 'salesman_mapping', 'salesman_name', 'area_name', 'department_name', 
            'reporting_person_name', 'delivery_location', 'delivery_location_name', 
            'visiting_date', 'status', 'remarks', 'created_at', 'updated_at'
        ]

    def get_salesman_name(self, obj):
        try:
            employee = obj.salesman_mapping.employee
            return employee.user.first_name + ' ' + employee.user.last_name if employee and employee.user else str(employee)
        except Exception:
            return str(obj.salesman_mapping.employee) if obj.salesman_mapping and obj.salesman_mapping.employee else None

    def get_area_name(self, obj):
        try:
            return obj.salesman_mapping.area.name
        except Exception:
            return None
            
    def get_department_name(self, obj):
        try:
            return obj.salesman_mapping.department.name
        except Exception:
            return None
            
    def get_reporting_person_name(self, obj):
        try:
            rp = obj.salesman_mapping.reporting_person
            return rp.user.first_name + ' ' + rp.user.last_name if rp and rp.user else str(rp)
        except Exception:
            return None

    def validate(self, data):
        salesman_mapping = data.get('salesman_mapping') or (self.instance.salesman_mapping if self.instance else None)
        delivery_location = data.get('delivery_location') or (self.instance.delivery_location if self.instance else None)
        
        if salesman_mapping:
            # Check if mapping points to active area
            if salesman_mapping.area and salesman_mapping.area.status != 'Active':
                raise serializers.ValidationError({"salesman_mapping": ["This Area is inactive and cannot be scheduled for a new visit."]})
                
            # Check if delivery location belongs to the salesman mapping's area
            if delivery_location and delivery_location.area != salesman_mapping.area:
                raise serializers.ValidationError({"delivery_location": ["The selected Delivery Location does not belong to the Salesman's mapped Area."]})
                
        return data

class AreaLocationMappingSerializer(serializers.ModelSerializer):
    area_name = serializers.CharField(source='area.name', read_only=True)
    delivery_location_name = serializers.CharField(source='delivery_location.location_name', read_only=True)

    class Meta:
        model = AreaLocationMapping
        fields = ['id', 'area', 'area_name', 'delivery_location', 'delivery_location_name', 'custom_location_name', 'source', 'created_at']
