import os
import sys
import django

sys.path.append(r'c:\Archana\glenda_vite\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from area_app.models import DeliveryLocation
from area_app.serializers import DeliveryLocationSerializer

dl = DeliveryLocation.objects.first()
serializer = DeliveryLocationSerializer(dl)
print(serializer.data)
