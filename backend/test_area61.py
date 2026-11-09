import os
import sys
import django
sys.path.append(r'c:\Archana\glenda_vite\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from area_app.models import Area, DeliveryLocation
a = Area.objects.get(id=61)
print("Geofence type:", a.geofence_type)
print("Polygon coords length:", len(a.polygon_coordinates) if a.polygon_coordinates else 0)
dls = DeliveryLocation.objects.filter(area=a)
print("Total delivery locations for area 61:", dls.count())
with_space = DeliveryLocation.objects.filter(area=a, location_name__endswith='\u200b')
print("Total with zero-width space for area 61:", with_space.count())
import requests
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()
user = User.objects.first()
token = str(RefreshToken.for_user(user).access_token)
headers = {'Authorization': f'Bearer {token}'}

res = requests.get('http://localhost:8000/api/area/areas/61/detected_locations/', headers=headers)
print("Status:", res.status_code)
print("API Response:", res.json())
