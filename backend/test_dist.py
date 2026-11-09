import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'glenda_vite.settings')
django.setup()

from area_app.models import Area
from logistics_app.models import RouteStopMaster
from math import radians, sin, cos, sqrt, atan2

for a in Area.objects.all():
    print('Area:', a.name, a.latitude, a.longitude, a.geofence_radius)
    for rs in RouteStopMaster.objects.all():
        if rs.latitude and rs.longitude and a.latitude and a.longitude:
            R = 6371e3
            dLat = radians(float(rs.latitude) - float(a.latitude))
            dLon = radians(float(rs.longitude) - float(a.longitude))
            a_val = sin(dLat/2)**2 + cos(radians(float(a.latitude))) * cos(radians(float(rs.latitude))) * sin(dLon/2)**2
            c = 2 * atan2(sqrt(a_val), sqrt(1 - a_val))
            d = R * c
            print(f'  {rs.stop_name}: {d}m (inside: {d <= a.geofence_radius})')
