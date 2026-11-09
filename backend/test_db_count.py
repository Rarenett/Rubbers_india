import os
import sys
import django

sys.path.append(r'c:\Archana\glenda_vite\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from area_app.models import DeliveryLocation
from django.db.models import Count

print("Total delivery locations:", DeliveryLocation.objects.count())
print("Delivery locations with area set:", DeliveryLocation.objects.filter(area__isnull=False).count())
print("Areas and their counts:")
for count in DeliveryLocation.objects.values('area').annotate(c=Count('id')).order_by('-c')[:10]:
    print(f"Area ID: {count['area']}, Count: {count['c']}")
