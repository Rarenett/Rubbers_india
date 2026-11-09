import os
import sys
import django
sys.path.append(r'c:\Archana\glenda_vite\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from area_app.models import Area
area = Area.objects.get(id=7)
print("Geofence type:", area.geofence_type)
print("Polygon coords length:", len(area.polygon_coordinates) if area.polygon_coordinates else 0)
