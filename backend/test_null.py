import os
import sys
import django
sys.path.append(r'c:\Archana\glenda_vite\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from area_app.models import DeliveryLocation
null_names = DeliveryLocation.objects.filter(location_name__isnull=True).count()
print(f"Null names: {null_names}")
