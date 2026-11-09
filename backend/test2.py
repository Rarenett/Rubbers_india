import os
import django
import sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'glenda_vite.settings')
django.setup()
from area_app.models import Area, DeliveryLocation
print('Areas:', list(Area.objects.filter(name__icontains='Thrissur').values('id', 'name')))
print('DeliveryLocations:', list(DeliveryLocation.objects.filter(location_name__icontains='Thrissur').values('id', 'location_name')))
