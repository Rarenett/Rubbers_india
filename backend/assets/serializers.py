from rest_framework import serializers
from .models import StorageRoom, Shelf, Rack, AssetType, File, FileAllocation, Key, KeyAllocation, AssetCategory, AssetAttributeDefinition, AssetAttributeValue, AssetDocument, AssetMaintenance, Asset, AssetAllocationItem, AssetAllocation, AssetTransfer
from rarenett_app.models import Company, Branch, Department
from django.contrib.auth import get_user_model

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    department_name = serializers.SerializerMethodField()
    designation_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'department_name', 'designation_name']

    def get_department_name(self, obj):
        from rarenett_app.models import Employee
        try:
            employee = Employee.objects.get(user=obj)
            return employee.department.name if employee.department else None
        except (Employee.DoesNotExist, AttributeError):
            return None

    def get_designation_name(self, obj):
        from rarenett_app.models import Employee
        try:
            employee = Employee.objects.get(user=obj)
            return employee.designation.title if employee.designation else None
        except (Employee.DoesNotExist, AttributeError):
            return None

class StorageRoomSerializer(serializers.ModelSerializer):
    created_by_email = serializers.ReadOnlyField(source='created_by.email')
    company_name = serializers.ReadOnlyField(source='company.name')
    branch_name = serializers.ReadOnlyField(source='branch.name')
    department_name = serializers.ReadOnlyField(source='department.name')

    class Meta:
        model = StorageRoom
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at']

class ShelfSerializer(serializers.ModelSerializer):
    room_name = serializers.ReadOnlyField(source='room.name')
    created_by_email = serializers.ReadOnlyField(source='created_by.email')

    class Meta:
        model = Shelf
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at']

class RackSerializer(serializers.ModelSerializer):
    shelf_name = serializers.ReadOnlyField(source='shelf.name')
    room_name = serializers.ReadOnlyField(source='shelf.room.name')
    created_by_email = serializers.ReadOnlyField(source='created_by.email')
    custodian_name = serializers.SerializerMethodField()

    def get_custodian_name(self, obj):
        if obj.custodian:
            return f"{obj.custodian.first_name} {obj.custodian.last_name}".strip() or obj.custodian.email
        return None

    class Meta:
        model = Rack
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at']

class AssetTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetType
        fields = '__all__'
        read_only_fields = ['created_at']

class FileSerializer(serializers.ModelSerializer):
    file_type_name = serializers.ReadOnlyField(source='file_type.name')
    rack_name = serializers.ReadOnlyField(source='rack.name')
    rack_custodian_name = serializers.SerializerMethodField()
    rack_custodian_id = serializers.SerializerMethodField()
    shelf_name = serializers.ReadOnlyField(source='rack.shelf.name')
    room_name = serializers.ReadOnlyField(source='rack.shelf.room.name')
    department_name = serializers.ReadOnlyField(source='department.name')
    active_allocation_id = serializers.SerializerMethodField()
    owner_email = serializers.ReadOnlyField(source='owner.email')
    owner_name = serializers.SerializerMethodField()
    current_holder_email = serializers.ReadOnlyField(source='current_holder.email')
    current_holder_name = serializers.SerializerMethodField()
    current_holder_department = serializers.SerializerMethodField()
    current_holder_designation = serializers.SerializerMethodField()
    created_by_email = serializers.ReadOnlyField(source='created_by.email')
#
    class Meta:
        model = File
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'status', 'holder_response']

    def validate_file_name(self, value):
        name = value.strip()
        queryset = File.objects.filter(file_name__iexact=name, is_active=True)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError(
                "A file with this name already exists. Duplicate file names are not allowed."
            )
        return name

#

    def get_owner_name(self, obj):
        if obj.owner:
            return f"{obj.owner.first_name} {obj.owner.last_name}".strip() or obj.owner.email
        return None

    def get_rack_custodian_name(self, obj):
        if obj.rack and obj.rack.custodian:
            return f"{obj.rack.custodian.first_name} {obj.rack.custodian.last_name}".strip() or obj.rack.custodian.email
        return None

    def get_rack_custodian_id(self, obj):
        if obj.rack and obj.rack.custodian:
            return obj.rack.custodian.id
        return None

    def get_current_holder_name(self, obj):
        if obj.current_holder:
            return f"{obj.current_holder.first_name} {obj.current_holder.last_name}".strip() or obj.current_holder.email
        if obj.rack and obj.rack.custodian:
            return f"{obj.rack.custodian.first_name} {obj.rack.custodian.last_name}".strip() or obj.rack.custodian.email
        return None

    def get_current_holder_department(self, obj):
        from rarenett_app.models import Employee
        try:
            if obj.current_holder:
                employee = Employee.objects.get(user=obj.current_holder)
                return employee.department.name if employee.department else None
        except (Employee.DoesNotExist, AttributeError):
            pass
        return None

    def get_current_holder_designation(self, obj):
        from rarenett_app.models import Employee
        try:
            if obj.current_holder:
                employee = Employee.objects.get(user=obj.current_holder)
                return employee.designation.title if employee.designation else None
        except (Employee.DoesNotExist, AttributeError):
            pass
        return None

    def get_active_allocation_id(self, obj):
        allocation = obj.allocations.filter(status__in=['Allocated', 'In Use']).first()
        return allocation.id if allocation else None

class FileAllocationSerializer(serializers.ModelSerializer):
    file_details = FileSerializer(source='file', read_only=True)
    assigned_to_details = UserSerializer(source='assigned_to', read_only=True)
    allocated_by_email = serializers.ReadOnlyField(source='allocated_by.email')
    allocated_by_name = serializers.SerializerMethodField()
    reallocated_to_name = serializers.SerializerMethodField()
    previous_holder_details = serializers.SerializerMethodField()
    assigned_to_department = serializers.SerializerMethodField()
    assigned_to_designation = serializers.SerializerMethodField()

    class Meta:
        model = FileAllocation
        fields = '__all__'

    def get_allocated_by_name(self, obj):
        if obj.allocated_by:
            return f"{obj.allocated_by.first_name} {obj.allocated_by.last_name}".strip() or obj.allocated_by.email
        return None

    def get_reallocated_to_name(self, obj):
        if obj.reallocated_to:
            return f"{obj.reallocated_to.first_name} {obj.reallocated_to.last_name}".strip() or obj.reallocated_to.email
        return None

    def get_assigned_to_department(self, obj):
        from rarenett_app.models import Employee
        try:
            if obj.assigned_to:
                employee = Employee.objects.get(user=obj.assigned_to)
                return employee.department.name if employee.department else None
        except (Employee.DoesNotExist, AttributeError):
            pass
        return None

    def get_assigned_to_designation(self, obj):
        from rarenett_app.models import Employee
        try:
            if obj.assigned_to:
                employee = Employee.objects.get(user=obj.assigned_to)
                return employee.designation.title if employee.designation else None
        except (Employee.DoesNotExist, AttributeError):
            pass
        return None

    def get_previous_holder_details(self, obj):
        # Find the allocation that reallocated this asset to the current assigned_to user
        prev_alloc = FileAllocation.objects.filter(
            file=obj.file,
            reallocated_to=obj.assigned_to,
            status='Reallocated'
        ).order_by('-returned_at').first()
        if prev_alloc and prev_alloc.assigned_to:
            u = prev_alloc.assigned_to
            allocator = prev_alloc.allocated_by
            allocator_name = f"{allocator.first_name} {allocator.last_name}".strip() or allocator.email if allocator else 'Admin/Stock'
            return {
                'id': u.id,
                'name': f"{u.first_name} {u.last_name}".strip() or u.email,
                'email': u.email,
                'received_from': allocator_name
            }
        return None


class KeySerializer(serializers.ModelSerializer):
    asset_type_name = serializers.ReadOnlyField(source='asset_type.name')
    rack_name = serializers.ReadOnlyField(source='rack.name')
    shelf_name = serializers.ReadOnlyField(source='rack.shelf.name')
    room_name = serializers.ReadOnlyField(source='rack.shelf.room.name')
    rack_custodian_name = serializers.SerializerMethodField()
    rack_custodian_id = serializers.SerializerMethodField()
    active_allocation_id = serializers.SerializerMethodField()
    owner_email = serializers.ReadOnlyField(source='owner.email')
    owner_name = serializers.SerializerMethodField()
    current_holder_email = serializers.ReadOnlyField(source='current_holder.email')
    current_holder_name = serializers.SerializerMethodField()
    current_holder_department = serializers.SerializerMethodField()
    current_holder_designation = serializers.SerializerMethodField()
    created_by_email = serializers.ReadOnlyField(source='created_by.email')

    class Meta:
        model = Key
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'status', 'holder_response']

    def validate_key_name(self, value):
        name = value.strip()
        queryset = Key.objects.filter(key_name__iexact=name)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError(
                "A key with this name already exists. Duplicate key names are not allowed."
            )
        return name

    def get_owner_name(self, obj):
        if obj.owner:
            return f"{obj.owner.first_name} {obj.owner.last_name}".strip() or obj.owner.email
        return None

    def get_rack_custodian_name(self, obj):
        if obj.rack and obj.rack.custodian:
            return f"{obj.rack.custodian.first_name} {obj.rack.custodian.last_name}".strip() or obj.rack.custodian.email
        return None

    def get_rack_custodian_id(self, obj):
        if obj.rack and obj.rack.custodian:
            return obj.rack.custodian.id
        return None

    def get_current_holder_name(self, obj):
        if obj.current_holder:
            return f"{obj.current_holder.first_name} {obj.current_holder.last_name}".strip() or obj.current_holder.email
        if obj.rack and obj.rack.custodian:
            return f"{obj.rack.custodian.first_name} {obj.rack.custodian.last_name}".strip() or obj.rack.custodian.email
        return None

    def get_current_holder_department(self, obj):
        from rarenett_app.models import Employee
        try:
            if obj.current_holder:
                employee = Employee.objects.get(user=obj.current_holder)
                return employee.department.name if employee.department else None
        except (Employee.DoesNotExist, AttributeError):
            pass
        return None

    def get_current_holder_designation(self, obj):
        from rarenett_app.models import Employee
        try:
            if obj.current_holder:
                employee = Employee.objects.get(user=obj.current_holder)
                return employee.designation.title if employee.designation else None
        except (Employee.DoesNotExist, AttributeError):
            pass
        return None

    def get_active_allocation_id(self, obj):
        allocation = obj.allocations.filter(status__in=['Allocated', 'In Use']).first()
        return allocation.id if allocation else None

class KeyAllocationSerializer(serializers.ModelSerializer):
    key_details = KeySerializer(source='key', read_only=True)
    assigned_to_details = UserSerializer(source='assigned_to', read_only=True)
    allocated_by_email = serializers.ReadOnlyField(source='allocated_by.email')
    allocated_by_name = serializers.SerializerMethodField()
    reallocated_to_name = serializers.SerializerMethodField()
    previous_holder_details = serializers.SerializerMethodField()

    class Meta:
        model = KeyAllocation
        fields = '__all__'

    def get_allocated_by_name(self, obj):
        if obj.allocated_by:
            return f"{obj.allocated_by.first_name} {obj.allocated_by.last_name}".strip() or obj.allocated_by.email
        return None

    def get_reallocated_to_name(self, obj):
        if obj.reallocated_to:
            return f"{obj.reallocated_to.first_name} {obj.reallocated_to.last_name}".strip() or obj.reallocated_to.email
        return None

    def get_assigned_to_department(self, obj):
        from rarenett_app.models import Employee
        try:
            if obj.assigned_to:
                employee = Employee.objects.get(user=obj.assigned_to)
                return employee.department.name if employee.department else None
        except (Employee.DoesNotExist, AttributeError):
            pass
        return None

    def get_assigned_to_designation(self, obj):
        from rarenett_app.models import Employee
        try:
            if obj.assigned_to:
                employee = Employee.objects.get(user=obj.assigned_to)
                return employee.designation.title if employee.designation else None
        except (Employee.DoesNotExist, AttributeError):
            pass
        return None

    def get_previous_holder_details(self, obj):
        prev_alloc = KeyAllocation.objects.filter(
            key=obj.key,
            reallocated_to=obj.assigned_to,
            status='Reallocated'
        ).order_by('-returned_at').first()
        if prev_alloc and prev_alloc.assigned_to:
            u = prev_alloc.assigned_to
            allocator = prev_alloc.allocated_by
            allocator_name = f"{allocator.first_name} {allocator.last_name}".strip() or allocator.email if allocator else 'Admin/Stock'
            return {
                'id': u.id,
                'name': f"{u.first_name} {u.last_name}".strip() or u.email,
                'email': u.email,
                'received_from': allocator_name
            }
        return None

# ==========================================
# IT / Infrastructure Asset Serializers
# ==========================================

class AssetCategorySerializer(serializers.ModelSerializer):
    asset_type_name = serializers.ReadOnlyField(source='asset_type.name')
    parent_name = serializers.ReadOnlyField(source='parent.name')
    default_incharge_name = serializers.SerializerMethodField()

    class Meta:
        model = AssetCategory
        fields = '__all__'

    def get_default_incharge_name(self, obj):
        if obj.default_incharge:
            return f"{obj.default_incharge.first_name} {obj.default_incharge.last_name}".strip() or obj.default_incharge.email
        return None

class AssetAttributeDefinitionSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    category_parent_name = serializers.ReadOnlyField(source='category.parent.name')
    
    class Meta:
        model = AssetAttributeDefinition
        fields = '__all__'

class AssetAttributeValueSerializer(serializers.ModelSerializer):
    attribute_name = serializers.ReadOnlyField(source='attribute.name')
    attribute_type = serializers.ReadOnlyField(source='attribute.field_type')
    
    class Meta:
        model = AssetAttributeValue
        fields = '__all__'

class AssetDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetDocument
        fields = '__all__'

class AssetMaintenanceSerializer(serializers.ModelSerializer):
    technician_name = serializers.SerializerMethodField()

    class Meta:
        model = AssetMaintenance
        fields = '__all__'
        
    def get_technician_name(self, obj):
        if obj.technician:
            return f"{obj.technician.first_name} {obj.technician.last_name}".strip() or obj.technician.email
        return None

class AssetSerializer(serializers.ModelSerializer):
    asset_type = serializers.ReadOnlyField(source='category.asset_type.id')
    asset_type_name = serializers.ReadOnlyField(source='category.asset_type.name')
    category_name = serializers.ReadOnlyField(source='category.name')
    department_name = serializers.ReadOnlyField(source='department.name')
    incharge_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    attribute_values = AssetAttributeValueSerializer(many=True, read_only=True)
    documents = AssetDocumentSerializer(many=True, read_only=True)
    maintenances = AssetMaintenanceSerializer(many=True, read_only=True)

    class Meta:
        model = Asset
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_incharge_name(self, obj):
        if obj.incharge:
            return f"{obj.incharge.first_name} {obj.incharge.last_name}".strip() or obj.incharge.email
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.email
        return None

class AssetAllocationItemSerializer(serializers.ModelSerializer):
    asset_details = AssetSerializer(source='asset', read_only=True)

    class Meta:
        model = AssetAllocationItem
        fields = '__all__'

class AssetAllocationSerializer(serializers.ModelSerializer):
    allocated_to_user_name = serializers.SerializerMethodField()
    allocated_to_user_details = UserSerializer(source='allocated_to_user', read_only=True)
    allocated_to_department_name = serializers.ReadOnlyField(source='allocated_to_department.name')
    allocated_by_name = serializers.SerializerMethodField()
    allocated_by_details = UserSerializer(source='allocated_by', read_only=True)
    items = AssetAllocationItemSerializer(many=True, read_only=True)

    class Meta:
        model = AssetAllocation
        fields = '__all__'
        read_only_fields = ['allocated_at', 'allocated_by']

    def get_allocated_to_user_name(self, obj):
        if obj.allocated_to_user:
            return f"{obj.allocated_to_user.first_name} {obj.allocated_to_user.last_name}".strip() or obj.allocated_to_user.email
        return None

    def get_allocated_by_name(self, obj):
        if obj.allocated_by:
            return f"{obj.allocated_by.first_name} {obj.allocated_by.last_name}".strip() or obj.allocated_by.email
        return None

class AssetTransferSerializer(serializers.ModelSerializer):
    from_department_name = serializers.ReadOnlyField(source='from_department.name')
    to_department_name = serializers.ReadOnlyField(source='to_department.name')
    transferred_by_name = serializers.SerializerMethodField()

    class Meta:
        model = AssetTransfer
        fields = '__all__'
        read_only_fields = ['transfer_date']

    def get_transferred_by_name(self, obj):
        if obj.transferred_by:
            return f"{obj.transferred_by.first_name} {obj.transferred_by.last_name}".strip() or obj.transferred_by.email
        return None