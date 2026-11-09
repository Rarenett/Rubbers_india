import os
import sys
import django

# Set up Django environment
sys.path.append(r'c:\Archana\glenda_vite\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from area_app.models import DeliveryLocation
from logistics_app.models import RouteStopMaster
from django.db import transaction

def sync_delivery_locations():
    with transaction.atomic():
        locations = DeliveryLocation.objects.filter(route_stop__isnull=True)
        count = 0
        for loc in locations:
            # Check if a route stop with this exact name already exists
            route_stop = RouteStopMaster.objects.filter(stop_name=loc.location_name).first()
            
            if not route_stop:
                # Create a new RouteStop
                route_stop = RouteStopMaster.objects.create(
                    stop_name=loc.location_name,
                    distance_km=0  # Default value
                )
            
            # Establish relationship
            loc.route_stop = route_stop
            loc.save(update_fields=['route_stop'])
            count += 1
            
        print(f"Synchronized {count} delivery locations.")

if __name__ == '__main__':
    sync_delivery_locations()
