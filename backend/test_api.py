import os
import sys
import django

# Set up Django environment
sys.path.append(r'c:\Archana\glenda_vite\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from area_app.models import DeliveryLocation

# Check how many locations belong to area ID 1
locations = DeliveryLocation.objects.filter(area_id=1)
print(f"Locations for area 1: {locations.count()}")

# Try calling getDetectedLocations API logically
from rest_framework.test import APIRequestFactory
from area_app.views import AreaViewSet

factory = APIRequestFactory()
request = factory.get('/api/area/areas/1/detected_locations/')
view = AreaViewSet.as_view({'get': 'detected_locations'})
response = view(request, pk=1)
print(f"Detected locations response status: {response.status_code}")
if response.status_code == 200:
    print(response.data)

