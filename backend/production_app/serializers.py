from rest_framework import serializers
from .models import (
    EmployeeGroup, EmployeeGroupMember, Shift, ProductionLine, 
    ShiftPlan, ShiftPlanDay, ShiftProductionLine, ShiftProductionEmployee,
    ProductionAttendance, ProductionBreakLog, BreakTypeMaster,
    PostProductionEntry, PostProductionDamagedMaterial, PostProductionResponsibility
)
from rarenett_app.serializers import EmployeeSerializer

class EmployeeGroupMemberSerializer(serializers.ModelSerializer):
    employee_details = EmployeeSerializer(source='employee', read_only=True)
    designation_name = serializers.CharField(source='designation.designation.name', read_only=True)

    class Meta:
        model = EmployeeGroupMember
        fields = ['id', 'group', 'employee', 'designation', 'added_at', 'employee_details', 'designation_name']
        read_only_fields = ['designation'] # designation is auto-set on save


class EmployeeGroupSerializer(serializers.ModelSerializer):
    members = EmployeeGroupMemberSerializer(many=True, read_only=True)
    member_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False
    )

    class Meta:
        model = EmployeeGroup
        fields = ['id', 'group_name', 'description', 'created_by', 'created_at', 'members', 'member_ids']
        read_only_fields = ['created_by', 'created_at']

    def validate_member_ids(self, value):
        existing = EmployeeGroupMember.objects.filter(employee_id__in=value)
        if self.instance:
            existing = existing.exclude(group=self.instance)
        if existing.exists():
            names = []
            for e in existing:
                if e.employee:
                    if e.employee.user:
                        names.append(e.employee.user.get_full_name() or e.employee.user.username)
                    elif e.employee.candidate:
                        names.append(e.employee.candidate.full_name)
                    else:
                        names.append(str(e.employee))
            raise serializers.ValidationError(f"Employees already in a group: {', '.join(names)}")
        return value

    def create(self, validated_data):
        member_ids = validated_data.pop('member_ids', [])
        group = EmployeeGroup.objects.create(**validated_data)
        
        # Create members
        for emp_id in member_ids:
            EmployeeGroupMember.objects.create(group=group, employee_id=emp_id)
            
        return group
        
    def update(self, instance, validated_data):
        member_ids = validated_data.pop('member_ids', None)
        
        # Update standard fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update members if provided
        if member_ids is not None:
            # Clear existing members
            instance.members.all().delete()
            # Add new members
            for emp_id in member_ids:
                EmployeeGroupMember.objects.create(group=instance, employee_id=emp_id)
        return instance


class PostProductionResponsibilitySerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_designation = serializers.CharField(source='employee.dept_designation.designation.name', read_only=True)

    class Meta:
        model = PostProductionResponsibility
        fields = '__all__'
        
    def get_employee_name(self, obj):
        try:
            return obj.employee.user.get_full_name() or obj.employee.user.username
        except:
            return str(obj.employee)
class ShiftSerializer(serializers.ModelSerializer):
    factory_name = serializers.CharField(source='factory.name', read_only=True, default=None)

    class Meta:
        model = Shift
        fields = '__all__'
        # Disable auto-generated UniqueTogetherValidator so updates don't
        # falsely conflict with the record being edited.
        validators = []

    def validate(self, attrs):
        name = attrs.get('name', getattr(self.instance, 'name', None))
        factory = attrs.get('factory', getattr(self.instance, 'factory', None))
        qs = Shift.objects.filter(name=name, factory=factory)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                {'name': 'A shift with this name already exists for the selected factory.'}
            )
        return attrs


class ProductionLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductionLine
        fields = '__all__'


class ShiftProductionEmployeeSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_code = serializers.CharField(source='employee.id', read_only=True)
    designation_name = serializers.CharField(source='employee.dept_designation.designation.name', read_only=True)
    
    class Meta:
        model = ShiftProductionEmployee
        fields = '__all__'
        
    def get_employee_name(self, obj):
        try:
            return obj.employee.user.get_full_name() or obj.employee.user.username
        except:
            return str(obj.employee)


class ShiftProductionLineSerializer(serializers.ModelSerializer):
    employees = ShiftProductionEmployeeSerializer(many=True, read_only=True)
    production_line_name = serializers.CharField(source='production_line.name', read_only=True)
    stock_item_name = serializers.CharField(source='stock_item.name', read_only=True)
    employee_group_name = serializers.CharField(source='employee_group.group_name', read_only=True)
    shift_name = serializers.CharField(source='shift_day.shift.name', read_only=True)
    shift_id = serializers.IntegerField(source='shift_day.shift.id', read_only=True)
    factory_name = serializers.CharField(source='shift_day.shift.factory.name', read_only=True, default=None)
    factory_id = serializers.IntegerField(source='shift_day.shift.factory.id', read_only=True, default=None)
    plan_date = serializers.DateField(source='shift_day.plan_date', read_only=True)
    
    stock_item_base_unit_name = serializers.SerializerMethodField()
    stock_item_base_unit_id = serializers.SerializerMethodField()
    stock_item_alternate_unit_name = serializers.SerializerMethodField()
    stock_item_alternate_unit_id = serializers.SerializerMethodField()
    stock_item_conversion_value = serializers.DecimalField(source='stock_item.conversion_value', max_digits=18, decimal_places=6, read_only=True)
    post_production_entry_id = serializers.SerializerMethodField()
    has_rnd_entry = serializers.SerializerMethodField()
    post_production_responsibility_id = serializers.IntegerField(source='post_production_responsibility.id', read_only=True)
    post_production_responsible_employee_id = serializers.IntegerField(source='post_production_responsibility.employee.id', read_only=True)
    post_production_responsible_employee_name = serializers.SerializerMethodField()

    class Meta:
        model = ShiftProductionLine
        fields = '__all__'

    def get_stock_item_base_unit_name(self, obj):
        return obj.stock_item.base_unit.name if obj.stock_item and obj.stock_item.base_unit else None

    def get_stock_item_base_unit_id(self, obj):
        return obj.stock_item.base_unit.id if obj.stock_item and obj.stock_item.base_unit else None

    def get_stock_item_alternate_unit_name(self, obj):
        return obj.stock_item.alternate_unit.name if obj.stock_item and obj.stock_item.alternate_unit else None

    def get_stock_item_alternate_unit_id(self, obj):
        return obj.stock_item.alternate_unit.id if obj.stock_item and obj.stock_item.alternate_unit else None

    def get_post_production_entry_id(self, obj):
        if hasattr(obj, 'post_production_entry') and obj.post_production_entry:
            return obj.post_production_entry.id
        return None

    def get_has_rnd_entry(self, obj):
        try:
            if hasattr(obj, 'post_production_entry') and obj.post_production_entry:
                return hasattr(obj.post_production_entry, 'rnd_entry') and obj.post_production_entry.rnd_entry is not None
            return False
        except:
            return False

    def get_post_production_responsible_employee_name(self, obj):
        if hasattr(obj, 'post_production_responsibility') and obj.post_production_responsibility:
            emp = obj.post_production_responsibility.employee
            try:
                return emp.user.get_full_name() or emp.user.username
            except:
                return str(emp)
        return None


class ShiftPlanDaySerializer(serializers.ModelSerializer):
    production_lines = ShiftProductionLineSerializer(many=True, read_only=True)
    shift_name = serializers.CharField(source='shift.name', read_only=True)
    shift = serializers.SerializerMethodField()
    factory_id = serializers.IntegerField(source='shift.factory.id', read_only=True, default=None)
    factory_name = serializers.CharField(source='shift.factory.name', read_only=True, default=None)

    class Meta:
        model = ShiftPlanDay
        fields = '__all__'

    def get_shift(self, obj):
        if obj.shift:
            return {
                'id': obj.shift.id,
                'name': obj.shift.name,
                'start_time': str(obj.shift.start_time),
                'end_time': str(obj.shift.end_time),
                'factory_id': obj.shift.factory_id,
                'factory_name': obj.shift.factory.name if obj.shift.factory else None,
            }
        return None


class ShiftPlanSerializer(serializers.ModelSerializer):
    days = ShiftPlanDaySerializer(many=True, read_only=True)
    factory_name = serializers.CharField(source='factory.name', read_only=True, default=None)
    
    class Meta:
        model = ShiftPlan
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at']
        # Disable auto-generated UniqueTogetherValidator so updates don't
        # falsely conflict with the record being edited.
        validators = []

    def validate(self, attrs):
        plan_name = attrs.get('plan_name', getattr(self.instance, 'plan_name', None))
        factory = attrs.get('factory', getattr(self.instance, 'factory', None))
        qs = ShiftPlan.objects.filter(plan_name=plan_name, factory=factory)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                {'plan_name': 'A shift plan with this name already exists for the selected factory.'}
            )
        return attrs


class BreakTypeMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = BreakTypeMaster
        fields = '__all__'


class ProductionBreakLogSerializer(serializers.ModelSerializer):
    break_type_name = serializers.CharField(source='break_type.name', read_only=True)
    
    class Meta:
        model = ProductionBreakLog
        fields = '__all__'


class ProductionAttendanceSerializer(serializers.ModelSerializer):
    breaks = ProductionBreakLogSerializer(many=True, read_only=True)
    employee_name = serializers.SerializerMethodField()
    employee_code = serializers.CharField(source='employee.id', read_only=True)
    production_line_name = serializers.CharField(source='production_line.name', read_only=True)
    date = serializers.DateField(source='shift_day.plan_date', read_only=True)
    shift_name = serializers.CharField(source='shift_day.shift.name', read_only=True)
    
    class Meta:
        model = ProductionAttendance
        fields = '__all__'

    def get_employee_name(self, obj):
        try:
            return obj.employee.user.get_full_name() or obj.employee.user.username
        except:
            return str(obj.employee)


class PostProductionDamagedMaterialSerializer(serializers.ModelSerializer):
    raw_material_name = serializers.CharField(source='raw_material.name', read_only=True)

    class Meta:
        model = PostProductionDamagedMaterial
        fields = ['id', 'raw_material', 'raw_material_name', 'damaged_quantity']


class PostProductionEntrySerializer(serializers.ModelSerializer):
    damaged_materials = PostProductionDamagedMaterialSerializer(many=True, required=False)
    has_rnd_entry = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = PostProductionEntry
        fields = '__all__'

    def get_has_rnd_entry(self, obj):
        try:
            return hasattr(obj, 'rnd_entry') and obj.rnd_entry is not None
        except:
            return False

    def validate(self, attrs):
        if self.instance:
            if hasattr(self.instance, 'rnd_entry') and self.instance.rnd_entry is not None:
                raise serializers.ValidationError("This Post Production entry cannot be edited because an R&D entry has already been saved for it.")
        return attrs

    def create(self, validated_data):
        damaged_materials_data = validated_data.pop('damaged_materials', [])
        entry = PostProductionEntry.objects.create(**validated_data)
        for item_data in damaged_materials_data:
            PostProductionDamagedMaterial.objects.create(post_production_entry=entry, **item_data)
        return entry

    def update(self, instance, validated_data):
        damaged_materials_data = validated_data.pop('damaged_materials', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if damaged_materials_data is not None:
            instance.damaged_materials.all().delete()
            for item_data in damaged_materials_data:
                PostProductionDamagedMaterial.objects.create(post_production_entry=instance, **item_data)
                
        return instance


class AdjustmentPostProductionSerializer(serializers.ModelSerializer):
    stock_item_name = serializers.CharField(source='stock_item.name', read_only=True)
    stock_item_code = serializers.CharField(source='stock_item.item_code', read_only=True)
    primary_unit_name = serializers.CharField(source='stock_item.base_unit.name', read_only=True)
    alternate_unit_name = serializers.CharField(source='stock_item.alternate_unit.name', read_only=True)
    adjusted_date = serializers.SerializerMethodField(read_only=True)
    extra_quantities_count = serializers.SerializerMethodField(read_only=True)
    consumed_alternate_quantity = serializers.SerializerMethodField(read_only=True)
    has_rnd_entry = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = PostProductionEntry
        fields = [
            'id',
            'stock_item',
            'stock_item_name',
            'stock_item_code',
            'primary_unit_name',
            'alternate_unit_name',
            'manufactured_quantity',
            'production_type',
            'created_at',
            'adjusted_date',
            'extra_quantities_count',
            'consumed_alternate_quantity',
            'has_rnd_entry',
            'batch_number',
            'expiry_after',
        ]

    def get_has_rnd_entry(self, obj):
        try:
            return hasattr(obj, 'rnd_entry') and obj.rnd_entry is not None
        except Exception:
            return False

    def validate(self, attrs):
        if self.instance:
            if hasattr(self.instance, 'rnd_entry') and self.instance.rnd_entry is not None:
                raise serializers.ValidationError("This adjustment entry cannot be edited because an R&D entry has already been saved for it.")
        return attrs

    def get_adjusted_date(self, obj):
        if obj.created_at:
            return obj.created_at.strftime("%d-%m-%Y")
        return None

    def get_extra_quantities_count(self, obj):
        return obj.extra_quantities.filter(out_quantity__gt=0).count()

    def get_consumed_alternate_quantity(self, obj):
        from django.db.models import Sum
        total = obj.extra_quantities.aggregate(total=Sum('out_quantity'))['total']
        return str(total or 0)


class AdjustmentAvailableEntrySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    stock_item_id = serializers.IntegerField(source='stock_item.id', allow_null=True)
    stock_item_name = serializers.CharField(source='stock_item.name', allow_null=True)
    production_line_name = serializers.SerializerMethodField()
    date = serializers.SerializerMethodField()
    plan_date = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(read_only=True)
    shift_name = serializers.SerializerMethodField()
    in_quantity = serializers.DecimalField(max_digits=12, decimal_places=2)
    unit_name = serializers.CharField(source='unit.name', allow_null=True)
    is_allocated = serializers.SerializerMethodField()
    allocated_quantity = serializers.SerializerMethodField()

    def get_is_allocated(self, obj):
        adj_id = self.context.get('adjustment_id')
        if adj_id and obj.post_production_id and str(obj.post_production_id) == str(adj_id):
            return True
        return False

    def get_allocated_quantity(self, obj):
        adj_id = self.context.get('adjustment_id')
        if adj_id and obj.post_production_id and str(obj.post_production_id) == str(adj_id):
            return str(obj.in_quantity)
        return None

    def get_production_line_name(self, obj):
        try:
            return obj.production_line.production_line.name
        except AttributeError:
            return "N/A"

    def get_date(self, obj):
        try:
            if obj.production_line and obj.production_line.shift_day and obj.production_line.shift_day.plan_date:
                plan_date = obj.production_line.shift_day.plan_date
                if hasattr(plan_date, 'strftime'):
                    return plan_date.strftime("%d-%m-%Y")
                parts = str(plan_date).split('-')
                if len(parts) == 3 and len(parts[0]) == 4:
                    return f"{parts[2]}-{parts[1]}-{parts[0]}"
                return str(plan_date)
        except Exception:
            pass
        try:
            if obj.post_production and obj.post_production.created_at:
                return obj.post_production.created_at.strftime("%d-%m-%Y")
        except Exception:
            pass
        if getattr(obj, 'created_at', None):
            return obj.created_at.strftime("%d-%m-%Y")
        return "N/A"

    def get_plan_date(self, obj):
        return self.get_date(obj)

    def get_shift_name(self, obj):
        try:
            return obj.production_line.shift_day.shift.name
        except AttributeError:
            return "N/A"


class AdjustmentStockItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    item_code = serializers.CharField(allow_null=True)
    base_unit_name = serializers.CharField(source='base_unit.name', allow_null=True)
    alternate_unit_name = serializers.CharField(source='alternate_unit.name', allow_null=True)
    conversion_value = serializers.DecimalField(max_digits=18, decimal_places=6)
    total_available_alt_qty = serializers.DecimalField(max_digits=18, decimal_places=2)
    available_entries_count = serializers.IntegerField()
