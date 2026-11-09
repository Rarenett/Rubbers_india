from rest_framework import serializers
from django.utils import timezone
from .models import (
    ExitCard, EntryCard,
    Gate, GateCategory, GateSubCategory, EntryTag, GeneratedTag, Visitor, 
    GateEntry, VehicleType, Vehicle, VehicleEntry, GateEntryVehicle, GateEntryReallocation,
    VehicleEntryDocument, EmployeeGateEntry, ApprovelessEntryConfig, Equipment, ParkingFee
)

class GateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Gate
        fields = '__all__'

class GateCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = GateCategory
        fields = '__all__'

    def validate(self, data):
        name = data.get('name')
        category_no = data.get('category_no')
        colour_code = data.get('colour_code')
        queryset = GateCategory.objects.all()
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        if name and queryset.filter(name__iexact=name.strip()).exists():
            raise serializers.ValidationError({"name": "A category with this name already exists."})

        if category_no and category_no.strip() and queryset.filter(category_no__iexact=category_no.strip()).exists():
            raise serializers.ValidationError({"category_no": "A category with this code/number already exists."})

        if colour_code and colour_code.strip() and queryset.filter(colour_code__iexact=colour_code.strip()).exists():
            raise serializers.ValidationError({"colour_code": "A category with this color code already exists."})

        return data

class GateSubCategorySerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    category_colour = serializers.ReadOnlyField(source='category.colour_code')
    class Meta:
        model = GateSubCategory
        fields = '__all__'

    def validate(self, data):
        category = data.get('category')
        name = data.get('name')
        subcategory_no = data.get('subcategory_no')

        queryset = GateSubCategory.objects.all()
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        if name and queryset.filter(name__iexact=name.strip()).exists():
            raise serializers.ValidationError({"name": "A sub-category with this name already exists."})

        if subcategory_no and subcategory_no.strip():
            if queryset.filter(subcategory_no__iexact=subcategory_no.strip()).exists():
                raise serializers.ValidationError({"subcategory_no": "A sub-category with this code/number already exists."})

        return data

class EntryTagSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    category_colour = serializers.ReadOnlyField(source='category.colour_code')
    subcategory_name = serializers.ReadOnlyField(source='subcategory.name')
    class Meta:
        model = EntryTag
        fields = '__all__'

    def validate(self, data):
        tag_type = data.get('tag_type')
        sl_no_from = data.get('sl_no_from')
        sl_no_to = data.get('sl_no_to')
        queryset = EntryTag.objects.all()
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        if tag_type and queryset.filter(tag_type__iexact=tag_type.strip()).exists():
            raise serializers.ValidationError({"tag_type": "A tag book with this Book Type already exists."})

        if sl_no_from is not None and sl_no_to is not None:
            if sl_no_from > sl_no_to:
                raise serializers.ValidationError({"sl_no_to": "Serial No To must be greater than or equal to Serial No From."})
            for existing in queryset.exclude(sl_no_from__isnull=True).exclude(sl_no_to__isnull=True):
                if sl_no_from <= existing.sl_no_to and sl_no_to >= existing.sl_no_from:
                    raise serializers.ValidationError({
                        "sl_no_from": f"Serial range overlaps with existing tag book '{existing.tag_type}' ({existing.sl_no_from} - {existing.sl_no_to})."
                    })

        return data

class GeneratedTagSerializer(serializers.ModelSerializer):
    tag_type = serializers.ReadOnlyField(source='entry_tag.tag_type')
    category_id = serializers.ReadOnlyField(source='entry_tag.category.id')
    category_name = serializers.ReadOnlyField(source='entry_tag.category.name')
    category_colour = serializers.ReadOnlyField(source='entry_tag.category.colour_code')
    class Meta:
        model = GeneratedTag
        fields = '__all__'


class VisitorSerializer(serializers.ModelSerializer):
    department_name = serializers.ReadOnlyField(source='department.name')
    class Meta:
        model = Visitor
        fields = '__all__'

    def validate(self, data):
        visitor_photo = data.get('visitor_photo')
        if visitor_photo is None and self.instance:
            visitor_photo = self.instance.visitor_photo
        if not visitor_photo:
            raise serializers.ValidationError({"visitor_photo": "Visitor photo is mandatory."})

        id_card_photo = data.get('id_card_photo')
        if id_card_photo is None and self.instance:
            id_card_photo = self.instance.id_card_photo
        if not id_card_photo:
            raise serializers.ValidationError({"id_card_photo": "ID card photo is mandatory."})

        return data

class GateEntryVehicleSerializer(serializers.ModelSerializer):
    vehicle_photo = serializers.SerializerMethodField()

    class Meta:
        model = GateEntryVehicle
        fields = ['id', 'vehicle_number', 'driver_name', 'vehicle_photo', 'created_at']

    def get_vehicle_photo(self, obj):
        if obj.vehicle_photo:
            try:
                request = self.context.get('request')
                url = obj.vehicle_photo.url
                return request.build_absolute_uri(url) if request else url
            except Exception:
                return None
        return None

class GateEntryReallocationSerializer(serializers.ModelSerializer):
    from_employee_name = serializers.SerializerMethodField()
    to_employee_name = serializers.SerializerMethodField()
    from_department_name = serializers.ReadOnlyField(source='from_department.name')
    to_department_name = serializers.ReadOnlyField(source='to_department.name')
    reallocated_by_name = serializers.SerializerMethodField()
    visitor_name = serializers.SerializerMethodField()
    visitor_mobile = serializers.SerializerMethodField()
    company_name = serializers.SerializerMethodField()
    visitor_photo = serializers.SerializerMethodField()
    id_card_photo = serializers.SerializerMethodField()
    tag_number = serializers.SerializerMethodField()
    purpose_of_visit = serializers.SerializerMethodField()
    entry_type = serializers.SerializerMethodField()
    entry_time = serializers.SerializerMethodField()
    number_of_persons = serializers.SerializerMethodField()

    class Meta:
        model = GateEntryReallocation
        fields = [
            'id', 'gate_entry', 'vehicle_entry', 'from_employee', 'from_employee_name',
            'to_employee', 'to_employee_name', 'from_department', 'from_department_name',
            'to_department', 'to_department_name', 'reason', 'status', 'responded_at',
            'response_notes', 'reallocated_by', 'reallocated_by_name', 'created_at',
            'visitor_name', 'visitor_mobile', 'company_name', 'visitor_photo',
            'id_card_photo', 'tag_number', 'purpose_of_visit', 'entry_type',
            'entry_time', 'number_of_persons'
        ]

    def get_from_employee_name(self, obj):
        if obj.from_employee:
            return f"{obj.from_employee.first_name} {obj.from_employee.last_name}".strip() or obj.from_employee.username
        return "N/A"

    def get_to_employee_name(self, obj):
        if obj.to_employee:
            return f"{obj.to_employee.first_name} {obj.to_employee.last_name}".strip() or obj.to_employee.username
        return "N/A"

    def get_reallocated_by_name(self, obj):
        if obj.reallocated_by:
            return f"{obj.reallocated_by.first_name} {obj.reallocated_by.last_name}".strip() or obj.reallocated_by.username
        return "N/A"

    def get_entry_type(self, obj):
        return 'vehicle' if obj.vehicle_entry_id else 'visitor'

    def get_visitor_name(self, obj):
        if obj.gate_entry and obj.gate_entry.visitor:
            return obj.gate_entry.visitor.visitor_name
        if obj.vehicle_entry:
            return f"{obj.vehicle_entry.driver} (Driver)" if obj.vehicle_entry.driver else (obj.vehicle_entry.company or "Vehicle Visitor")
        return "Visitor"

    def get_visitor_mobile(self, obj):
        if obj.gate_entry and obj.gate_entry.visitor:
            return obj.gate_entry.visitor.mobile_no
        if obj.vehicle_entry:
            if obj.vehicle_entry.appointment:
                if obj.vehicle_entry.appointment.visitor and obj.vehicle_entry.appointment.visitor.mobile_no:
                    return obj.vehicle_entry.appointment.visitor.mobile_no
                if obj.vehicle_entry.appointment.contact_number:
                    return obj.vehicle_entry.appointment.contact_number
            return getattr(obj.vehicle_entry, 'contact_number', None)
        return None

    def get_company_name(self, obj):
        if obj.gate_entry and obj.gate_entry.visitor:
            return obj.gate_entry.visitor.company_name
        if obj.vehicle_entry:
            return obj.vehicle_entry.company
        return None

    def get_tag_number(self, obj):
        if obj.gate_entry:
            if obj.gate_entry.generated_tag:
                return obj.gate_entry.generated_tag.tag_number
            return obj.gate_entry.tag_number
        if obj.vehicle_entry and obj.vehicle_entry.vehicle_pass:
            return obj.vehicle_entry.vehicle_pass.tag_number
        return None

    def get_purpose_of_visit(self, obj):
        if obj.gate_entry:
            return obj.gate_entry.purpose_of_visit
        if obj.vehicle_entry:
            return obj.vehicle_entry.purpose
        return None

    def get_entry_time(self, obj):
        if obj.gate_entry:
            return obj.gate_entry.entry_time
        if obj.vehicle_entry:
            return obj.vehicle_entry.entry_time
        return None

    def get_number_of_persons(self, obj):
        if obj.gate_entry:
            return obj.gate_entry.number_of_persons
        return 1

    def get_visitor_photo(self, obj):
        request = self.context.get('request')
        photo = None
        if obj.gate_entry and obj.gate_entry.visitor and obj.gate_entry.visitor.visitor_photo:
            photo = obj.gate_entry.visitor.visitor_photo
        elif obj.vehicle_entry:
            first_v = obj.vehicle_entry.vehicles.first()
            if first_v and first_v.vehicle_photo:
                photo = first_v.vehicle_photo
            elif hasattr(obj.vehicle_entry, 'driver_photo') and obj.vehicle_entry.driver_photo:
                photo = obj.vehicle_entry.driver_photo
        if photo:
            try:
                return request.build_absolute_uri(photo.url) if request else photo.url
            except Exception:
                return photo.url
        return None

    def get_id_card_photo(self, obj):
        request = self.context.get('request')
        photo = None
        if obj.gate_entry and obj.gate_entry.visitor and obj.gate_entry.visitor.id_card_photo:
            photo = obj.gate_entry.visitor.id_card_photo
        elif obj.vehicle_entry and obj.vehicle_entry.document_photo:
            photo = obj.vehicle_entry.document_photo
        if photo:
            try:
                return request.build_absolute_uri(photo.url) if request else photo.url
            except Exception:
                return photo.url
        return None


class EquipmentSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(default=True, required=False)

    class Meta:
        model = Equipment
        fields = [
            'id', 'name', 'code', 'image', 'description', 'is_active',
            'created_at', 'updated_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def validate_name(self, value):
        val = value.strip()
        qs = Equipment.objects.filter(name__iexact=val)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("An equipment/tool with this name already exists.")
        return val


class EntryCardSerializer(serializers.ModelSerializer):
    park_area_name = serializers.CharField(source='park_area.name', read_only=True)
    parking_slot_number = serializers.IntegerField(source='parking_slot.slot_number', read_only=True)
    status = serializers.SerializerMethodField()
    exit_card_id = serializers.SerializerMethodField()
    exit_time = serializers.SerializerMethodField()
    parking_fee = serializers.SerializerMethodField()

    class Meta:
        model = EntryCard
        fields = '__all__'

    def get_status(self, obj):
        return 'Exited' if obj.exit_cards.exists() else 'Inside'

    def get_exit_card_id(self, obj):
        xc = obj.exit_cards.first()
        return xc.id if xc else None

    def get_exit_time(self, obj):
        xc = obj.exit_cards.first()
        return xc.exit_time if xc else None

    def get_parking_fee(self, obj):
        xc = obj.exit_cards.first()
        if xc:
            return float(xc.parking_fee or 0)
        from .views import calculate_parking_fee_for_duration
        from django.utils import timezone
        return float(calculate_parking_fee_for_duration(obj.entry_time, timezone.now()) or 0)


class ExitCardSerializer(serializers.ModelSerializer):
    vehicle_number = serializers.CharField(source='entry_card.vehicle_number', read_only=True)
    entry_time = serializers.DateTimeField(source='entry_card.entry_time', read_only=True)
    park_area_name = serializers.CharField(source='entry_card.park_area.name', read_only=True)
    parking_slot_number = serializers.IntegerField(source='entry_card.parking_slot.slot_number', read_only=True)
    duration_formatted = serializers.SerializerMethodField()
    parking_fee = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = ExitCard
        fields = '__all__'

    def get_duration_formatted(self, obj):
        if not obj.entry_card or not obj.entry_card.entry_time or not obj.exit_time:
            return '-'
        mins = int((obj.exit_time - obj.entry_card.entry_time).total_seconds() / 60)
        hrs = mins // 60
        rem_mins = mins % 60
        if hrs > 0:
            return f"{hrs}h {rem_mins}m"
        return f"{mins} mins"

    def validate(self, data):
        entry_card = data.get('entry_card', getattr(self.instance, 'entry_card', None))
        exit_time = data.get('exit_time', getattr(self.instance, 'exit_time', None))
        
        if entry_card and exit_time:
            if exit_time < entry_card.entry_time:
                raise serializers.ValidationError("Exit Time cannot be earlier than Entry Time.")
            
            from .views import calculate_parking_fee_for_duration
            data['parking_fee'] = calculate_parking_fee_for_duration(entry_card.entry_time, exit_time)
            
        return data


class GateEntrySerializer(serializers.ModelSerializer):
    visitor_name = serializers.ReadOnlyField(source='visitor.visitor_name')
    visitor_mobile = serializers.ReadOnlyField(source='visitor.mobile_no')
    visitor_photo = serializers.SerializerMethodField()
    entry_gate_no = serializers.ReadOnlyField(source='entry_gate.gate_no')
    exit_gate_no = serializers.ReadOnlyField(source='exit_gate.gate_no')
    entry_gate_name = serializers.ReadOnlyField(source='entry_gate.name')
    exit_gate_name = serializers.ReadOnlyField(source='exit_gate.name')
    gate_name = serializers.ReadOnlyField(source='entry_gate.name')
    department_name = serializers.ReadOnlyField(source='department.name')
    employee_name = serializers.SerializerMethodField()
    tag_code = serializers.SerializerMethodField()
    tag_colour = serializers.SerializerMethodField()
    tag_category = serializers.SerializerMethodField()
    tag_category_name = serializers.SerializerMethodField()
    id_card_photo = serializers.SerializerMethodField()
    visiting_card_photo = serializers.SerializerMethodField()
    company_name = serializers.ReadOnlyField(source='visitor.company_name')
    visitor_company = serializers.ReadOnlyField(source='visitor.company_name')
    email = serializers.ReadOnlyField(source='visitor.email')
    address = serializers.ReadOnlyField(source='visitor.address')
    vehicles = GateEntryVehicleSerializer(many=True, read_only=True)
    reallocations = GateEntryReallocationSerializer(many=True, read_only=True)
    movement_completed_by_name = serializers.SerializerMethodField()
    contact_person_name = serializers.SerializerMethodField()
    contact_person_number = serializers.SerializerMethodField()
    has_pending_reallocation = serializers.SerializerMethodField()
    pending_reallocation = serializers.SerializerMethodField()
    material_details = serializers.SerializerMethodField()
    equipment_details = EquipmentSerializer(source='equipments', many=True, read_only=True)
    equipments = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    generated_tags_details = serializers.SerializerMethodField()
    generated_tags = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    park_area_name = serializers.ReadOnlyField(source='park_area.name')
    parking_slot_number = serializers.ReadOnlyField(source='parking_slot.slot_number')
    parking_location_display = serializers.SerializerMethodField()
    entry_card_id = serializers.SerializerMethodField()
    exit_card_id = serializers.SerializerMethodField()
    parking_fee = serializers.SerializerMethodField()
    entry_cards = EntryCardSerializer(many=True, read_only=True)
    exit_cards = ExitCardSerializer(many=True, read_only=True)
    
    class Meta:
        model = GateEntry
        fields = '__all__'

    def get_entry_card_id(self, obj):
        ec = obj.entry_cards.first()
        return ec.id if ec else None

    def get_exit_card_id(self, obj):
        xc = obj.exit_cards.first()
        return xc.id if xc else None

    def get_parking_fee(self, obj):
        xcs = obj.exit_cards.all()
        if xcs.exists():
            return sum([float(xc.parking_fee or 0) for xc in xcs])
        ecs = obj.entry_cards.all()
        if ecs.exists():
            from .views import calculate_parking_fee_for_duration
            from django.utils import timezone
            ref_exit = obj.exit_time or timezone.now()
            return sum([float(calculate_parking_fee_for_duration(ec.entry_time, ref_exit) or 0) for ec in ecs])
        return 0

    def get_parking_location_display(self, obj):
        if obj.park_area and obj.parking_slot:
            return f"{obj.park_area.name} - Slot #{obj.parking_slot.slot_number}"
        elif obj.park_area:
            return obj.park_area.name
        return None

    def get_generated_tags_details(self, obj):
        result = []
        for tag in obj.generated_tags.all():
            colour = None
            category_name = None
            if tag.entry_tag and tag.entry_tag.category:
                colour = tag.entry_tag.category.colour_code
                category_name = tag.entry_tag.category.name
            result.append({
                'id': tag.id,
                'tag_number': tag.tag_number,
                'status': tag.status,
                'colour': colour,
                'category_name': category_name,
            })
        return result


    def to_internal_value(self, data):
        # Handle 'N/A' tag assignment gracefully without Foreign Key PK type error
        if hasattr(data, '_mutable'):
            mutable = data._mutable
            data._mutable = True
            gt = data.get('generated_tag')
            if gt in ['N/A', 'n/a', 'NA', '', 'null', 'None']:
                if gt in ['N/A', 'n/a', 'NA']:
                    data['tag_number'] = 'N/A'
                data['generated_tag'] = None
            if 'generated_tags' in data:
                data.pop('generated_tags', None)
            if 'equipments' in data:
                data.pop('equipments', None)
            data._mutable = mutable
        elif isinstance(data, dict):
            data = data.copy()
            gt = data.get('generated_tag')
            if gt in ['N/A', 'n/a', 'NA', '', 'null', 'None']:
                if gt in ['N/A', 'n/a', 'NA']:
                    data['tag_number'] = 'N/A'
                data['generated_tag'] = None
            data.pop('generated_tags', None)
            data.pop('equipments', None)
        return super().to_internal_value(data)

    def get_tag_code(self, obj):
        if obj.generated_tags.exists():
            tags_list = [str(t.tag_number) for t in obj.generated_tags.all() if t.tag_number]
            if tags_list:
                return ", ".join(tags_list)
        if obj.generated_tag and obj.generated_tag.tag_number:
            return obj.generated_tag.tag_number
        if obj.tag_number:
            return obj.tag_number
        return None

    def get_tag_colour(self, obj):
        if obj.generated_tag and obj.generated_tag.entry_tag and obj.generated_tag.entry_tag.category:
            return obj.generated_tag.entry_tag.category.colour_code
        if obj.entry_tag and obj.entry_tag.category:
            return obj.entry_tag.category.colour_code
        return None

    def get_tag_category(self, obj):
        if obj.generated_tag and obj.generated_tag.entry_tag and obj.generated_tag.entry_tag.category:
            return obj.generated_tag.entry_tag.category.id
        if obj.entry_tag and obj.entry_tag.category:
            return obj.entry_tag.category.id
        return None

    def get_tag_category_name(self, obj):
        if obj.generated_tag and obj.generated_tag.entry_tag and obj.generated_tag.entry_tag.category:
            return obj.generated_tag.entry_tag.category.name
        if obj.entry_tag and obj.entry_tag.category:
            return obj.entry_tag.category.name
        return None

    def validate(self, data):
        visitor = data.get('visitor')
        if visitor and not self.instance: # Only on creation
            active_entry = GateEntry.objects.filter(visitor=visitor, exit_time__isnull=True).exists()
            if active_entry:
                raise serializers.ValidationError({
                    "visitor": "This visitor already has an active entry. They must exit before a new entry can be registered."
                })
            if not visitor.visitor_photo:
                raise serializers.ValidationError({
                    "visitor": "This visitor does not have a mandatory visitor photo. Please update visitor profile before creating entry."
                })
            if not visitor.id_card_photo:
                raise serializers.ValidationError({
                    "visitor": "This visitor does not have mandatory ID card proof. Please update visitor profile before creating entry."
                })
        expected_time = data.get('expected_time_of_exit')
        if expected_time and not self.instance:
            import datetime
            now_time = datetime.datetime.now().time().replace(second=0, microsecond=0)
            if expected_time < now_time:
                raise serializers.ValidationError({
                    "expected_time_of_exit": f"Expected time of exit cannot be in the past ({expected_time.strftime('%I:%M %p')}). Current time is {now_time.strftime('%I:%M %p')}."
                })
        return data

    def get_contact_person_name(self, obj):
        if obj.appointment:
            if obj.appointment.contact_person:
                return obj.appointment.contact_person.get_full_name() or obj.appointment.contact_person.username
            if obj.appointment.department and obj.appointment.department.contact_person:
                return obj.appointment.department.contact_person
        return None

    def get_contact_person_number(self, obj):
        if obj.appointment:
            if obj.appointment.contact_number:
                return obj.appointment.contact_number
            if obj.appointment.contact_person:
                return getattr(obj.appointment.contact_person, 'phone', None) or getattr(obj.appointment.contact_person, 'mobile_number', None)
            if obj.appointment.department and obj.appointment.department.contact_number:
                return obj.appointment.department.contact_number
        return None

    def get_employee_name(self, obj):
        if obj.employee:
            return f"{obj.employee.first_name} {obj.employee.last_name}".strip() or obj.employee.username
        return "N/A"

    def get_material_details(self, obj):
        if hasattr(obj, 'material_details') and obj.material_details:
            return obj.material_details
        return obj.narration or None

    def get_visitor_photo(self, obj):
        if obj.visitor and obj.visitor.visitor_photo:
            try:
                request = self.context.get('request')
                url = obj.visitor.visitor_photo.url
                return request.build_absolute_uri(url) if request else url
            except Exception:
                return None
        return None

    def get_id_card_photo(self, obj):
        if obj.visitor and obj.visitor.id_card_photo:
            try:
                request = self.context.get('request')
                url = obj.visitor.id_card_photo.url
                return request.build_absolute_uri(url) if request else url
            except Exception:
                return None
        return None

    def get_visiting_card_photo(self, obj):
        if obj.visitor and obj.visitor.visiting_card_photo:
            try:
                request = self.context.get('request')
                url = obj.visitor.visiting_card_photo.url
                return request.build_absolute_uri(url) if request else url
            except Exception:
                return None
        return None

    def get_movement_completed_by_name(self, obj):
        if obj.movement_completed_by:
            return f"{obj.movement_completed_by.first_name} {obj.movement_completed_by.last_name}".strip() or obj.movement_completed_by.username
        return None

    def get_has_pending_reallocation(self, obj):
        return obj.reallocations.filter(status='pending').exists()

    def get_pending_reallocation(self, obj):
        pending = obj.reallocations.filter(status='pending').first()
        if pending:
            return GateEntryReallocationSerializer(pending, context=self.context).data
        return None


class VehicleTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleType
        fields = '__all__'


class VehicleSerializer(serializers.ModelSerializer):
    vehicle_type_name = serializers.ReadOnlyField(source='vehicle_type.name')
    employee_name = serializers.SerializerMethodField()
    employee_department_id = serializers.SerializerMethodField()
    employee_department_name = serializers.SerializerMethodField()

    class Meta:
        model = Vehicle
        fields = '__all__'

    def get_employee_name(self, obj):
        if obj.employee:
            return str(obj.employee)
        return None

    def get_employee_department_id(self, obj):
        if obj.employee and hasattr(obj.employee, 'dept_designation') and obj.employee.dept_designation and obj.employee.dept_designation.department:
            return obj.employee.dept_designation.department.id
        return None

    def get_employee_department_name(self, obj):
        if obj.employee and hasattr(obj.employee, 'dept_designation') and obj.employee.dept_designation and obj.employee.dept_designation.department:
            return obj.employee.dept_designation.department.name
        return None

    def to_internal_value(self, data):
        if hasattr(data, 'copy'):
            data = data.copy()
        if 'employee' in data and data.get('employee') in ['', 'null', 'undefined', None]:
            data['employee'] = None
        return super().to_internal_value(data)

    def validate(self, data):
        vehicle_photo = data.get('vehicle_photo')
        if vehicle_photo is None and self.instance:
            vehicle_photo = self.instance.vehicle_photo
        has_employee = data.get('employee') or (self.instance and self.instance.employee)
        
        # Check if owner or company vehicle
        vehicle_type = data.get('vehicle_type') or (self.instance and self.instance.vehicle_type)
        is_internal_fleet = False
        if vehicle_type:
            vt_name = getattr(vehicle_type, 'name', str(vehicle_type)).lower()
            if any(term in vt_name for term in ['owner', 'company', 'fleet', 'executive', 'official', 'employee']):
                is_internal_fleet = True
        company_val = str(data.get('company') or (self.instance and self.instance.company) or '').lower()
        if any(term in company_val for term in ['glenda', 'owner', 'executive', 'company']):
            is_internal_fleet = True

        if not vehicle_photo and not has_employee and not is_internal_fleet:
            raise serializers.ValidationError({"vehicle_photo": "Vehicle photo is mandatory."})
        return data


class VehicleEntrySerializer(serializers.ModelSerializer):
    vehicles_data = VehicleSerializer(source='vehicles', many=True, read_only=True)
    vehicles = serializers.PrimaryKeyRelatedField(many=True, queryset=Vehicle.objects.all(), required=False)
    vehicle_number = serializers.CharField(read_only=True)
    vehicle_photo = serializers.SerializerMethodField()
    entry_gate_name = serializers.ReadOnlyField(source='entry_gate.name')
    exit_gate_name = serializers.ReadOnlyField(source='exit_gate.name')
    pass_number = serializers.ReadOnlyField(source='vehicle_pass.tag_number')
    tag_code = serializers.SerializerMethodField()
    tag_colour = serializers.SerializerMethodField()
    employee_name = serializers.SerializerMethodField()
    department_name = serializers.ReadOnlyField(source='department.name')
    movement_completed_by_name = serializers.SerializerMethodField()
    visitor_name = serializers.SerializerMethodField()
    visitor_mobile = serializers.SerializerMethodField()
    company_name = serializers.ReadOnlyField(source='company')
    purpose_of_visit = serializers.ReadOnlyField(source='purpose')
    entry_type = serializers.CharField(default='vehicle', read_only=True)
    reallocations = GateEntryReallocationSerializer(many=True, read_only=True)
    contact_person_name = serializers.SerializerMethodField()
    contact_person_number = serializers.SerializerMethodField()
    has_pending_reallocation = serializers.SerializerMethodField()
    pending_reallocation = serializers.SerializerMethodField()
    park_area_name = serializers.ReadOnlyField(source='park_area.name')
    parking_slot_number = serializers.ReadOnlyField(source='parking_slot.slot_number')
    parking_location_display = serializers.SerializerMethodField()
    entry_card_id = serializers.SerializerMethodField()
    exit_card_id = serializers.SerializerMethodField()
    parking_fee = serializers.SerializerMethodField()
    entry_cards = EntryCardSerializer(many=True, read_only=True)
    exit_cards = ExitCardSerializer(many=True, read_only=True)

    class Meta:
        model = VehicleEntry
        fields = '__all__'
        extra_kwargs = {
            'vehicles': {'required': True}
        }

    def get_entry_card_id(self, obj):
        ec = obj.entry_cards.first()
        return ec.id if ec else None

    def get_exit_card_id(self, obj):
        xc = obj.exit_cards.first()
        return xc.id if xc else None

    def get_parking_fee(self, obj):
        xcs = obj.exit_cards.all()
        if xcs.exists():
            return sum([float(xc.parking_fee or 0) for xc in xcs])
        ec = obj.entry_cards.first()
        if ec:
            from .views import calculate_parking_fee_for_duration
            from django.utils import timezone
            ref_exit = obj.exit_time or timezone.now()
            return float(calculate_parking_fee_for_duration(ec.entry_time, ref_exit) or 0)
        return 0

    def get_parking_location_display(self, obj):
        if obj.park_area and obj.parking_slot:
            return f"{obj.park_area.name} - Slot #{obj.parking_slot.slot_number}"
        elif obj.park_area:
            return obj.park_area.name
        elif obj.parking_location:
            return obj.parking_location
        return None

    def to_internal_value(self, data):
        if hasattr(data, '_mutable'):
            mutable = data._mutable
            data._mutable = True
            vp = data.get('vehicle_pass')
            if vp in ['N/A', 'n/a', 'NA', '', 'null', 'None']:
                data['vehicle_pass'] = None
            data._mutable = mutable
        elif isinstance(data, dict):
            data = data.copy()
            vp = data.get('vehicle_pass')
            if vp in ['N/A', 'n/a', 'NA', '', 'null', 'None']:
                data['vehicle_pass'] = None
        return super().to_internal_value(data)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get('request')
        
        # Serialize vehicles with rich detail for frontend view
        veh_list = []
        for v in instance.vehicles.all():
            photo_url = None
            if v.vehicle_photo:
                try:
                    photo_url = request.build_absolute_uri(v.vehicle_photo.url) if request else v.vehicle_photo.url
                except Exception:
                    photo_url = v.vehicle_photo.url
            veh_list.append({
                'id': v.id,
                'vehicle_number': v.vehicle_number,
                'driver_name': v.driver or instance.driver,
                'vehicle_photo': photo_url,
                'vehicle_type_name': v.vehicle_type.name if v.vehicle_type else None
            })
        ret['vehicles'] = veh_list

        # Format document_photo with full URL
        if instance.document_photo:
            try:
                ret['document_photo'] = request.build_absolute_uri(instance.document_photo.url) if request else instance.document_photo.url
            except Exception:
                ret['document_photo'] = instance.document_photo.url
        else:
            ret['document_photo'] = None

        # Format delivery_note_photo with full URL
        if instance.delivery_note_photo:
            try:
                ret['delivery_note_photo'] = request.build_absolute_uri(instance.delivery_note_photo.url) if request else instance.delivery_note_photo.url
            except Exception:
                ret['delivery_note_photo'] = instance.delivery_note_photo.url
        else:
            ret['delivery_note_photo'] = None

        # Format multiple documents list
        docs_list = []
        for doc in instance.documents.all():
            doc_url = None
            if doc.document_photo:
                try:
                    doc_url = request.build_absolute_uri(doc.document_photo.url) if request else doc.document_photo.url
                except Exception:
                    doc_url = doc.document_photo.url
            docs_list.append({
                'id': doc.id,
                'document_photo': doc_url,
                'document_name': doc.document_name or f"Document {doc.id}"
            })
        
        # If legacy entry has document_photo but no VehicleEntryDocument rows
        if not docs_list and ret['document_photo']:
            docs_list.append({
                'id': 0,
                'document_photo': ret['document_photo'],
                'document_name': 'Supporting Document'
            })
        elif docs_list and not ret['document_photo']:
            ret['document_photo'] = docs_list[0]['document_photo']

        ret['documents'] = docs_list

        return ret

    def get_vehicle_photo(self, obj):
        first_v = obj.vehicles.first()
        if first_v and first_v.vehicle_photo:
            try:
                request = self.context.get('request')
                url = first_v.vehicle_photo.url
                return request.build_absolute_uri(url) if request else url
            except Exception:
                return first_v.vehicle_photo.url
        return None

    def get_visitor_name(self, obj):
        if obj.driver:
            return f"{obj.driver} (Driver)"
        first_v = obj.vehicles.first()
        if first_v:
            return f"Vehicle {first_v.vehicle_number}"
        return "Vehicle Entry"

    def get_visitor_mobile(self, obj):
        if obj.appointment:
            if obj.appointment.visitor and obj.appointment.visitor.mobile_no:
                return obj.appointment.visitor.mobile_no
            if obj.appointment.contact_number:
                return obj.appointment.contact_number
        return None

    def get_tag_code(self, obj):
        if obj.vehicle_pass:
            return obj.vehicle_pass.tag_number
        return None

    def get_tag_colour(self, obj):
        if obj.vehicle_pass and hasattr(obj.vehicle_pass, 'tag_colour'):
            return obj.vehicle_pass.tag_colour
        return None

    def get_employee_name(self, obj):
        if obj.employee:
            return f"{obj.employee.first_name} {obj.employee.last_name}".strip() or obj.employee.username
        return None

    def get_contact_person_name(self, obj):
        if obj.appointment:
            if obj.appointment.contact_person:
                return obj.appointment.contact_person.get_full_name() or obj.appointment.contact_person.username
            if obj.appointment.department and obj.appointment.department.contact_person:
                return obj.appointment.department.contact_person
        return None

    def get_contact_person_number(self, obj):
        if obj.appointment:
            if obj.appointment.contact_number:
                return obj.appointment.contact_number
            if obj.appointment.contact_person:
                return getattr(obj.appointment.contact_person, 'phone', None) or getattr(obj.appointment.contact_person, 'mobile_number', None)
            if obj.appointment.department and obj.appointment.department.contact_number:
                return obj.appointment.department.contact_number
        return None

    def get_movement_completed_by_name(self, obj):
        if obj.movement_completed_by:
            return f"{obj.movement_completed_by.first_name} {obj.movement_completed_by.last_name}".strip() or obj.movement_completed_by.username
        return None

    def get_has_pending_reallocation(self, obj):
        return obj.reallocations.filter(status='pending').exists()

    def get_pending_reallocation(self, obj):
        pending = obj.reallocations.filter(status='pending').first()
        if pending:
            return GateEntryReallocationSerializer(pending, context=self.context).data
        return None

    def validate(self, data):
        vehicles = data.get('vehicles', [])
        if vehicles and not self.instance: # Only on creation
            for vehicle in vehicles:
                active_entry = VehicleEntry.objects.filter(vehicles=vehicle, exit_time__isnull=True).exists()
                if active_entry:
                    raise serializers.ValidationError({
                        "vehicles": f"Vehicle {vehicle.vehicle_number} already has an active entry. It must exit before a new entry can be registered."
                    })
                if not vehicle.vehicle_photo:
                    raise serializers.ValidationError({
                        "vehicles": f"Vehicle {vehicle.vehicle_number} does not have a mandatory vehicle photo. Please update vehicle details before creating entry."
                    })
        expected_time = data.get('expected_time_of_exit')
        if expected_time and not self.instance:
            import datetime
            now_time = datetime.datetime.now().time().replace(second=0, microsecond=0)
            if expected_time < now_time:
                raise serializers.ValidationError({
                    "expected_time_of_exit": f"Expected time of exit cannot be in the past ({expected_time.strftime('%I:%M %p')}). Current time is {now_time.strftime('%I:%M %p')}."
                })
        return data


class EmployeeGateEntrySerializer(serializers.ModelSerializer):
    employment_no = serializers.SerializerMethodField()
    employee_name = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    designation_name = serializers.SerializerMethodField()
    profile_photo = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    email = serializers.SerializerMethodField()
    entry_gate_name = serializers.ReadOnlyField(source='entry_gate.name')
    exit_gate_name = serializers.ReadOnlyField(source='exit_gate.name')
    stay_duration = serializers.SerializerMethodField()
    recorded_by_name = serializers.SerializerMethodField()
    vehicle_id = serializers.ReadOnlyField(source='vehicle.id')
    vehicle_number = serializers.ReadOnlyField(source='vehicle.vehicle_number')
    vehicle_type_name = serializers.SerializerMethodField()
    vehicle_photo = serializers.SerializerMethodField()
    is_preferred_vehicle = serializers.ReadOnlyField(source='vehicle.is_preferred')
    vehicle_entry_id = serializers.ReadOnlyField(source='vehicle_entry.id')
    park_area_id = serializers.ReadOnlyField(source='park_area.id')
    park_area_name = serializers.SerializerMethodField()
    parking_slot_id = serializers.ReadOnlyField(source='parking_slot.id')
    parking_slot_number = serializers.SerializerMethodField()
    parking_details = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeGateEntry
        fields = [
            'id', 'employment_detail', 'employee', 'employment_no',
            'employee_name', 'department_name', 'designation_name',
            'profile_photo', 'phone', 'email', 'entry_gate', 'entry_gate_name',
            'exit_gate', 'exit_gate_name', 'entry_time', 'exit_time',
            'status', 'verification_method', 'face_match_score', 'snapshot_image',
            'stay_duration', 'remarks', 'recorded_by',
            'recorded_by_name', 'vehicle', 'vehicle_id', 'vehicle_number',
            'vehicle_type_name', 'vehicle_photo', 'is_preferred_vehicle',
            'vehicle_entry', 'vehicle_entry_id', 'park_area', 'park_area_id',
            'park_area_name', 'parking_slot', 'parking_slot_id',
            'parking_slot_number', 'parking_details', 'created_at', 'updated_at'
        ]

    def get_employment_no(self, obj):
        if obj.employment_detail and obj.employment_detail.employment_no:
            return obj.employment_detail.employment_no
        if obj.employee:
            if obj.employee.candidate and obj.employee.candidate.employment_details.exists():
                return obj.employee.candidate.employment_details.first().employment_no
            return f"EMP{obj.employee.id:03d}"
        return "—"

    def get_employee_name(self, obj):
        if obj.employment_detail and obj.employment_detail.user:
            return obj.employment_detail.user.full_name
        if obj.employee:
            if obj.employee.candidate:
                return obj.employee.candidate.full_name
            if obj.employee.user:
                return obj.employee.user.get_full_name() or obj.employee.user.username
            return f"Employee #{obj.employee.id}"
        return "Unknown Employee"

    def get_department_name(self, obj):
        if obj.employee and obj.employee.dept_designation and obj.employee.dept_designation.department:
            return obj.employee.dept_designation.department.name
        if obj.employment_detail and obj.employment_detail.user and obj.employment_detail.user.department_applied:
            return obj.employment_detail.user.department_applied.name
        return "—"

    def get_designation_name(self, obj):
        if obj.employee and obj.employee.dept_designation and obj.employee.dept_designation.designation:
            return obj.employee.dept_designation.designation.name
        if obj.employment_detail and obj.employment_detail.user and obj.employment_detail.user.position_applied:
            return obj.employment_detail.user.position_applied.name
        return "—"

    def get_profile_photo(self, obj):
        request = self.context.get('request')
        photo = None
        if obj.employee and obj.employee.profile_picture:
            photo = obj.employee.profile_picture
        elif obj.employment_detail and obj.employment_detail.user and obj.employment_detail.user.photo:
            photo = obj.employment_detail.user.photo
        elif obj.employee and obj.employee.candidate and obj.employee.candidate.photo:
            photo = obj.employee.candidate.photo
        if photo:
            try:
                url = photo.url
                if request and not url.startswith('http'):
                    return request.build_absolute_uri(url)
                return url
            except Exception:
                return None
        return None

    def get_phone(self, obj):
        if obj.employee and obj.employee.phone:
            return obj.employee.phone
        if obj.employment_detail and obj.employment_detail.user:
            return obj.employment_detail.user.mobile_number
        if obj.employee and obj.employee.candidate:
            return obj.employee.candidate.mobile_number or "—"
        return "—"

    def get_email(self, obj):
        if obj.employee and obj.employee.email:
            return obj.employee.email
        if obj.employment_detail and obj.employment_detail.user:
            return obj.employment_detail.user.email
        if obj.employee and obj.employee.candidate:
            return obj.employee.candidate.email or "—"
        return "—"

    def get_stay_duration(self, obj):
        from django.utils import timezone
        end = obj.exit_time or timezone.now()
        if obj.entry_time:
            delta = end - obj.entry_time
            total_seconds = int(delta.total_seconds())
            if total_seconds < 0:
                return "0m"
            hours = total_seconds // 3600
            mins = (total_seconds % 3600) // 60
            if hours > 0:
                return f"{hours}h {mins}m"
            return f"{mins}m"
        return "—"

    def get_recorded_by_name(self, obj):
        if obj.recorded_by:
            return obj.recorded_by.get_full_name() or obj.recorded_by.username
        return None

    def get_vehicle_type_name(self, obj):
        if obj.vehicle and obj.vehicle.vehicle_type:
            return obj.vehicle.vehicle_type.name
        return None

    def get_vehicle_photo(self, obj):
        request = self.context.get('request')
        if obj.vehicle and obj.vehicle.vehicle_photo:
            try:
                url = obj.vehicle.vehicle_photo.url
                if request and not url.startswith('http'):
                    return request.build_absolute_uri(url)
                return url
            except Exception:
                return None
        return None

    def get_park_area_name(self, obj):
        if obj.park_area:
            return obj.park_area.name
        if getattr(obj, 'vehicle_entry', None) and obj.vehicle_entry.park_area:
            return obj.vehicle_entry.park_area.name
        return None

    def get_parking_slot_number(self, obj):
        if obj.parking_slot:
            return obj.parking_slot.slot_number
        if getattr(obj, 'vehicle_entry', None) and obj.vehicle_entry.parking_slot:
            return obj.vehicle_entry.parking_slot.slot_number
        return None

    def get_parking_details(self, obj):
        pa = getattr(obj, 'park_area', None) or (obj.vehicle_entry.park_area if getattr(obj, 'vehicle_entry', None) else None)
        ps = getattr(obj, 'parking_slot', None) or (obj.vehicle_entry.parking_slot if getattr(obj, 'vehicle_entry', None) else None)
        if pa and ps:
            return f"{pa.name} - Slot #{ps.slot_number}"
        return None


class ApprovelessEntryConfigSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    employee_name = serializers.SerializerMethodField()
    employee_email = serializers.CharField(source='employee.email', read_only=True)
    employee_designation = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ApprovelessEntryConfig
        fields = [
            'id', 'department', 'department_name', 'employee', 'employee_name',
            'employee_email', 'employee_designation', 'is_active', 'notes',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_employee_name(self, obj):
        if obj.employee:
            return obj.employee.get_full_name() or obj.employee.username or obj.employee.email
        return "Unknown"

    def get_employee_designation(self, obj):
        if not obj.employee:
            return "—"
        if hasattr(obj.employee, 'position_applied') and obj.employee.position_applied:
            return obj.employee.position_applied.name
        if hasattr(obj.employee, 'employee') and obj.employee.employee and obj.employee.employee.dept_designation:
            dd = obj.employee.employee.dept_designation
            if dd.designation:
                return dd.designation.name
        return "Official"

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None



from .models import ExitCard, ParkArea
class ParkAreaSerializer(serializers.ModelSerializer):
    total_slots = serializers.SerializerMethodField()
    occupied_slots = serializers.SerializerMethodField()
    available_slots = serializers.SerializerMethodField()

    class Meta:
        model = ParkArea
        fields = '__all__'

    def get_total_slots(self, obj):
        return obj.number_of_slots or 0

    def get_occupied_slots(self, obj):
        if not obj.number_of_slots:
            return 0
        active_ge = GateEntry.objects.filter(exit_time__isnull=True, park_area=obj).count()
        active_ve = VehicleEntry.objects.filter(exit_time__isnull=True, park_area=obj).count()
        explicit_occupied = obj.slots.filter(status='Occupied').count()
        occupied = max(active_ge + active_ve, explicit_occupied)
        return min(occupied, obj.number_of_slots)

    def get_available_slots(self, obj):
        if not obj.number_of_slots:
            return 0
        occupied = self.get_occupied_slots(obj)
        return max(0, obj.number_of_slots - occupied)

    def validate(self, data):
        # Determine is_main_area and parent_area handling partial updates
        is_main_area = data.get('is_main_area', self.instance.is_main_area if self.instance else False)
        
        if 'parent_area' in data:
            parent_area = data['parent_area']
        else:
            parent_area = self.instance.parent_area if self.instance else None

        if is_main_area:
            data['parent_area'] = None
            data['sort_order'] = 0
            
            number_of_slots = data.get('number_of_slots')
            if number_of_slots is None:
                if not (self.instance and self.instance.number_of_slots is not None and 'number_of_slots' not in data):
                    raise serializers.ValidationError({"number_of_slots": "Number of Slots is required for Main Area."})
            elif number_of_slots <= 0:
                raise serializers.ValidationError({"number_of_slots": "Number of Slots must be a positive number."})
        else:
            data['number_of_slots'] = None
            
            if 'sort_order' in data and data['sort_order'] is None:
                raise serializers.ValidationError({"sort_order": "Sort Order is required when not a Main Area."})
            elif 'sort_order' not in data and not (self.instance and self.instance.sort_order is not None):
                raise serializers.ValidationError({"sort_order": "Sort Order is required when not a Main Area."})

            if not parent_area:
                raise serializers.ValidationError({"parent_area": "Parent Area is required when not a Main Area."})
            
            # Parent must be a main area
            if not parent_area.is_main_area:
                raise serializers.ValidationError({"parent_area": "Parent Area must be a Main Park Area."})
                
            # Cannot be its own parent
            if self.instance and parent_area.id == self.instance.id:
                raise serializers.ValidationError({"parent_area": "A Park Area cannot be its own parent."})

        # Changing from Main Area to Non-Main Area
        if self.instance and self.instance.is_main_area and not is_main_area:
            if self.instance.child_areas.exists():
                raise serializers.ValidationError({
                    "is_main_area": "Cannot unset Main Area status because this area is used as a Parent Area by other records."
                })

        return data


# Parking fee serializer below

class ParkingFeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParkingFee
        fields = '__all__'

    def validate(self, data):
        min_mins = data.get('min_minutes', getattr(self.instance, 'min_minutes', None))
        max_mins = data.get('max_minutes', getattr(self.instance, 'max_minutes', None))
        is_active = data.get('is_active', getattr(self.instance, 'is_active', True))
        fee = data.get('fee', getattr(self.instance, 'fee', 0))

        if min_mins is None:
            raise serializers.ValidationError({"min_minutes": "Minimum minutes is required."})

        if min_mins < 0:
            raise serializers.ValidationError({"min_minutes": "Duration cannot be negative."})

        if fee < 0:
            raise serializers.ValidationError({"fee": "Fee cannot be negative."})

        if max_mins is not None and min_mins > max_mins:
            raise serializers.ValidationError({"min_minutes": "Minimum duration cannot be greater than maximum duration."})

        if is_active:
            qs = ParkingFee.objects.filter(is_active=True)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            
            for rule in qs:
                start1 = min_mins
                end1 = max_mins if max_mins is not None else float('inf')
                start2 = rule.min_minutes
                end2 = rule.max_minutes if rule.max_minutes is not None else float('inf')
                
                if not (start1 >= end2 or end1 <= start2):
                    raise serializers.ValidationError("This duration slab overlaps with an existing active slab.")

        return data
