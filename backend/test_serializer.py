import os, sys
sys.path.append('c:\\Paul@Rarenett\\glenda_vite1\\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
import django
django.setup()

from project_app.serializers import MarketingShopVisitSerializer
from project_app.models import MarketingShopVisit
from rarenett_app.models import Employee

data = {
    'shop_name': 'Pauls Shop',
    'shop_type': 'Retail Shop',
    'address': '',
    'city': '',
    'state': '',
    'mobile_number': '',
    'gst_number': '',
    'latitude': None,
    'longitude': None
}

serializer = MarketingShopVisitSerializer(data=data)
if not serializer.is_valid():
    print('Validation Errors:', serializer.errors)
else:
    try:
        emp = Employee.objects.first()
        serializer.save(employee=emp)
        print('Saved successfully! Data:', serializer.data)
    except Exception as e:
        print('Error on save:', e)
