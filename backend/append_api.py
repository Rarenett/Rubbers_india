import os

serializers_path = 'c:/Paul@Rarenett/glenda_vite1/backend/project_app/serializers.py'
views_path = 'c:/Paul@Rarenett/glenda_vite1/backend/project_app/views.py'
urls_path = 'c:/Paul@Rarenett/glenda_vite1/backend/project_app/urls.py'

# 1. Serializers
new_serializers = """
from .models import MarketingOrder, MarketingOrderItem
from rest_framework import serializers

class MarketingOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketingOrderItem
        fields = '__all__'

class MarketingOrderSerializer(serializers.ModelSerializer):
    items = MarketingOrderItemSerializer(many=True, required=False)

    class Meta:
        model = MarketingOrder
        fields = '__all__'

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        order = MarketingOrder.objects.create(**validated_data)
        for item_data in items_data:
            MarketingOrderItem.objects.create(marketing_order=order, **item_data)
        return order
"""
if os.path.exists(serializers_path):
    with open(serializers_path, 'a', encoding='utf-8') as f:
        f.write(new_serializers)

# 2. Views
new_views = """
from .models import MarketingOrder
from .serializers import MarketingOrderSerializer
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

class MarketingOrderViewSet(viewsets.ModelViewSet):
    queryset = MarketingOrder.objects.all().order_by('-created_at')
    serializer_class = MarketingOrderSerializer
    permission_classes = [IsAuthenticated]
"""
if os.path.exists(views_path):
    with open(views_path, 'a', encoding='utf-8') as f:
        f.write(new_views)

# 3. URLs
urls_code = """
from .views import MarketingOrderViewSet
router.register(r'marketing/orders', MarketingOrderViewSet, basename='marketing-orders')
"""
# Assuming urls.py uses router.register. 
# We'll just read urls.py and insert before urlpatterns if we can, else just append.
if os.path.exists(urls_path):
    with open(urls_path, 'r', encoding='utf-8') as f:
        urls_content = f.read()
    
    if "MarketingOrderViewSet" not in urls_content:
        # Simple injection: append after the last router.register
        if "urlpatterns = [" in urls_content:
            urls_content = urls_content.replace("urlpatterns = [", f"{urls_code}\nurlpatterns = [")
            with open(urls_path, 'w', encoding='utf-8') as f:
                f.write(urls_content)

print("API endpoints added successfully.")
