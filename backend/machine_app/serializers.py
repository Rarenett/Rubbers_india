from rest_framework import serializers
# pyrefly: ignore [missing-import]
from .models import SparePart, SparePartImage, lifespan, TypeName, CategoryName, SubCategoryName, ProcessName, MachineDataCollection, RepairRequest, RepairRequestImage, MachineProductMapping, MachineOutput, MachineDataCollection, MachineDataCollectionConfiguration, RepairPart, RepairRequestFeedback
from inventory_app.models import StockItem


class LifespanSerializer(serializers.ModelSerializer):
    # required=False: hidden fields don't cause "this field is required" errors
    lifespan_type = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = lifespan
        fields = '__all__'

class SparePartImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = SparePartImage
        fields = ['id', 'image', 'uploaded_at']

class SparePartSerializer(serializers.ModelSerializer):
    images = SparePartImageSerializer(many=True, read_only=True)
    name_details = serializers.CharField(source='name.name', read_only=True)
    brand_details = serializers.CharField(source='brand.name', read_only=True, allow_null=True)
    machine_name_details = serializers.CharField(source='machine_name.name', read_only=True)
    lifespan_type_details = serializers.CharField(source='lifespan_type.lifespan_type', read_only=True)
    supplier_details = serializers.CharField(source='supplier.name', read_only=True, allow_null=True)

    class Meta:
        model = SparePart
        fields = '__all__'

    def create(self, validated_data):
        request = self.context.get('request')
        uploaded_images = request.FILES.getlist('uploaded_images') if request else []
        
        spare_part = SparePart.objects.create(**validated_data)
        for img in uploaded_images:
            SparePartImage.objects.create(spare_part=spare_part, image=img)
        return spare_part

    def update(self, instance, validated_data):
        request = self.context.get('request')
        uploaded_images = request.FILES.getlist('uploaded_images') if request else []
        
        for img in uploaded_images:
            SparePartImage.objects.create(spare_part=instance, image=img)
            
        return super().update(instance, validated_data)


class TypeNameSerializer(serializers.ModelSerializer):
    class Meta:
        model = TypeName
        fields = '__all__'


class CategoryNameSerializer(serializers.ModelSerializer):
    typename_details = serializers.CharField(source='typename.typename', read_only=True)
    # required=False: hidden fields don't cause "this field is required" errors
    categoryname = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = CategoryName
        fields = '__all__'


class SubCategoryNameSerializer(serializers.ModelSerializer):
    categoryname_details = serializers.CharField(source='categoryname.categoryname', read_only=True)
    # required=False: hidden fields don't cause "this field is required" errors
    subcategoryname = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = SubCategoryName
        fields = '__all__'


class ProcessNameSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProcessName
        fields = '__all__'


class MachineDataCollectionSerializer(serializers.ModelSerializer):
    machine_name_details = serializers.CharField(source='machine_name.name', read_only=True)
    department_details = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    process_details = serializers.CharField(source='process.processname', read_only=True, allow_null=True)
    supplier_details = serializers.CharField(source='supplier.name', read_only=True, allow_null=True)
    service_contact = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = MachineDataCollection
        fields = '__all__'

class RepairRequestImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = RepairRequestImage
        fields = ['id', 'image']

class RepairRequestFeedbackSerializer(serializers.ModelSerializer):
    responder_name = serializers.CharField(source='user.first_name', read_only=True, default='')

    class Meta:
        model = RepairRequestFeedback
        fields = [
            'id', 'repair_request', 'user', 'responder_name', 'decision',
            'positive_feedback', 'negative_feedback', 'decision_notes', 'supporting_document', 'created_at'
        ]


class RepairRequestSerializer(serializers.ModelSerializer):
    images = RepairRequestImageSerializer(source='repair_request_images', many=True, read_only=True)
    uploaded_images = serializers.ListField(
        child=serializers.ImageField(max_length=1000000, allow_empty_file=False, use_url=False),
        write_only=True,
        required=False
    )
    part_details = serializers.CharField(source='part.name', read_only=True)
    is_defined = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.first_name', read_only=True, default='')
    
    votes = serializers.SerializerMethodField()
    total_voters = serializers.SerializerMethodField()
    feedbacks = RepairRequestFeedbackSerializer(many=True, read_only=True)

    decision_maker_id = serializers.SerializerMethodField()

    class Meta:
        model = RepairRequest
        fields = [
            'id', 'part', 'part_details', 'duedate', 'entry_date', 'priority', 'notes', 'remarks', 'images', 'uploaded_images',
            'status', 'created_by', 'created_by_name', 'is_defined',
            'decision', 'positive_feedback', 'negative_feedback', 'decision_notes', 'supporting_document',
            'votes', 'total_voters', 'feedbacks', 'decision_maker_id'
        ]

    def get_decision_maker_id(self, obj):
        rp = RepairPart.objects.filter(machine=obj.part).first()
        if rp and rp.decision_maker_id:
            return rp.decision_maker_id
        return None

    def get_is_defined(self, obj):
        return RepairPart.objects.filter(machine=obj.part).exists()

    def get_assigned_voter_ids(self, obj):
        repair_parts = RepairPart.objects.filter(machine=obj.part)
        voters = set()
        for rp in repair_parts:
            pattern = rp.pattern_type
            if pattern in ['Single', 'Multiple', 'Assign']:
                for emp in rp.employees.all():
                    if emp.user:
                        voters.add(emp.user.id)
            elif pattern == 'HOD':
                for dept in rp.targeted_departments.all():
                    from rarenett_app.models import Employee
                    hod_employees = Employee.objects.filter(
                        dept_designation__department=dept,
                        dept_designation__designation__name__icontains='HOD'
                    )
                    for emp in hod_employees:
                        if emp.user:
                            voters.add(emp.user.id)
            elif pattern == 'BOD':
                from rarenett_app.models import Employee
                bod_employees = Employee.objects.filter(
                    dept_designation__designation__name__icontains='BOD'
                )
                for emp in bod_employees:
                    if emp.user:
                        voters.add(emp.user.id)
        return voters

    def get_votes(self, obj):
        import datetime
        yes_count = obj.feedbacks.filter(decision='YES').count()
        no_count = obj.feedbacks.filter(decision='NO').count()
        neutral_count = obj.feedbacks.filter(decision='NEUTRAL').count()
        
        # Check if duedate is over or status is Accepted/Rejected
        if (obj.duedate and obj.duedate < datetime.date.today()) or obj.status in ['Accepted', 'Rejected']:
            assigned_voters = self.get_assigned_voter_ids(obj)
            voted_users = set(obj.feedbacks.values_list('user_id', flat=True))
            unvoted_count = len(assigned_voters - voted_users)
            neutral_count += unvoted_count
            
        return {
            'yes': yes_count,
            'no': no_count,
            'neutral': neutral_count
        }

    def get_total_voters(self, obj):
        return len(self.get_assigned_voter_ids(obj))

    def create(self, validated_data):
        uploaded_images = validated_data.pop('uploaded_images', [])
        repair_request = RepairRequest.objects.create(**validated_data)
        
        for image in uploaded_images:
            RepairRequestImage.objects.create(repairrequest=repair_request, image=image)
            
        return repair_request

    def update(self, instance, validated_data):
        uploaded_images = validated_data.pop('uploaded_images', [])
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        for image in uploaded_images:
            RepairRequestImage.objects.create(repairrequest=instance, image=image)
            
        return instance

class MachineProductMappingSerializer(serializers.ModelSerializer):
    machine_details = serializers.CharField(source='machine.name', read_only=True)
    product_details = serializers.CharField(source='product.name', read_only=True)
    
    product = serializers.PrimaryKeyRelatedField(
        queryset=StockItem.objects.all(),
        required=False
    )
    products = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False
    )

    class Meta:
        model = MachineProductMapping
        fields = ['id', 'machine', 'machine_details', 'product', 'product_details', 'products']

    def validate(self, attrs):
        if not attrs.get('products') and not attrs.get('product'):
            raise serializers.ValidationError("Either 'product' or 'products' field must be provided.")
        return attrs

    def create(self, validated_data):
        products = validated_data.pop('products', [])
        machine = validated_data.get('machine')
        
        if products:
            # Bulk create mappings for the given machine
            mappings = []
            for product_id in products:
                mappings.append(MachineProductMapping(machine=machine, product_id=product_id))
            
            if mappings:
                MachineProductMapping.objects.bulk_create(mappings)
                # Return the first one as representation, or a generic one
                return mappings[0]
                
        # Fallback to standard creation if no 'products' list provided
        return MachineProductMapping.objects.create(**validated_data)

class MachineOutputSerializer(serializers.ModelSerializer):
    machine_details = serializers.CharField(source='machine.machine.name', read_only=True)
    product_details = serializers.CharField(source='product.product.name', read_only=True)
    productunit_details = serializers.CharField(source='productunit.base_unit.name', read_only=True)
    outputunit_details = serializers.CharField(source='outputunit.name', read_only=True)

    class Meta:
        model = MachineOutput
        fields = '__all__'
class MachineDataCollectionConfigurationSerializer(serializers.ModelSerializer):
    stock_item_details = serializers.CharField(source='stock_item.name', read_only=True, allow_null=True)
    class Meta:
        model = MachineDataCollectionConfiguration
        fields = '__all__'


class RepairPartSerializer(serializers.ModelSerializer):
    typename_name = serializers.CharField(source='typename.typename', read_only=True, allow_null=True)
    machine_name = serializers.CharField(source='machine.name', read_only=True, allow_null=True)
    vehicle_name = serializers.CharField(source='vehicle.vehicle_name', read_only=True, allow_null=True)
    category_name = serializers.CharField(source='category.categoryname', read_only=True, allow_null=True)
    subcategory_name = serializers.CharField(source='subcategory.subcategoryname', read_only=True, allow_null=True)
    decision_maker_name = serializers.CharField(source='decision_maker.username', read_only=True, allow_null=True)
    
    class Meta:
        model = RepairPart
        fields = '__all__'

    def validate(self, attrs):
        machine = attrs.get('machine')
        vehicle = attrs.get('vehicle')

        if machine:
            exists = RepairPart.objects.filter(machine=machine)
            if self.instance:
                exists = exists.exclude(pk=self.instance.pk)
            if exists.exists():
                raise serializers.ValidationError({"machine": "A pattern for this item already exists."})

        if vehicle:
            exists = RepairPart.objects.filter(vehicle=vehicle)
            if self.instance:
                exists = exists.exclude(pk=self.instance.pk)
            if exists.exists():
                raise serializers.ValidationError({"vehicle": "A pattern for this vehicle already exists."})

        return attrs
