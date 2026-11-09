import os
import sys
import django
sys.path.append(r'c:\Archana\glenda_vite\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()
from area_app.models import Area
areas = Area.objects.filter(geofence_type='polygon')
print("Polygon areas:", areas.count())
for a in areas[:5]:
    print(f"ID: {a.id}, Name: {a.name}")
