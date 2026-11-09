import os
import sys
import django
sys.path.append(r'c:\Archana\glenda_vite\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from area_app.models import DeliveryLocation

dls = DeliveryLocation.objects.filter(location_name__endswith='\u200b')
print(f"Total with zero-width space: {dls.count()}")
for dl in dls[:5]:
    print(f"ID: {dl.id}, Name: {repr(dl.location_name)}")
