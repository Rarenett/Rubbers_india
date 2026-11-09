

from rest_framework import serializers
from .models import MarketingTravelPhoto, MarketingLead, MarketingAttendance, MarketingTravel, MarketingShopVisit, MarketingShopPhoto, MarketingWishlist

class MarketingLeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketingLead
        fields = '__all__'
        read_only_fields = ['employee']

class MarketingAttendanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = MarketingAttendance
        fields = '__all__'
        read_only_fields = ['employee']
        
    def get_employee_name(self, obj):
        if obj.employee and obj.employee.user:
            return f"{obj.employee.user.first_name} {obj.employee.user.last_name}".strip() or obj.employee.user.username
        return "Unknown"

class MarketingTravelPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketingTravelPhoto
        fields = '__all__'

class MarketingTravelSerializer(serializers.ModelSerializer):
    photos = MarketingTravelPhotoSerializer(many=True, read_only=True)

    class Meta:
        model = MarketingTravel
        fields = '__all__'
        read_only_fields = ['employee']

class MarketingShopPhotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketingShopPhoto
        fields = '__all__'

class MarketingShopVisitSerializer(serializers.ModelSerializer):
    photos = MarketingShopPhotoSerializer(many=True, read_only=True)
    class Meta:
        model = MarketingShopVisit
        fields = '__all__'
        read_only_fields = ['employee']

class MarketingWishlistSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketingWishlist
        fields = '__all__'


from .models import MarketingOrder, MarketingOrderItem
from rest_framework import serializers

class MarketingOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketingOrderItem
        fields = '__all__'
        read_only_fields = ['marketing_order']

class MarketingOrderSerializer(serializers.ModelSerializer):
    items = MarketingOrderItemSerializer(many=True, required=False)

    class Meta:
        model = MarketingOrder
        fields = '__all__'

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        
        request = self.context.get('request')
        user = request.user if request and hasattr(request, 'user') else None
        
        if user and not validated_data.get('employee'):
            from rarenett_app.models import Employee
            employee = Employee.objects.filter(user=user).first()
            if employee:
                validated_data['employee'] = employee
                
        order = MarketingOrder.objects.create(**validated_data)
        for item_data in items_data:
            MarketingOrderItem.objects.create(marketing_order=order, **item_data)
        return order
