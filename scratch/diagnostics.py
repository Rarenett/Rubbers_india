import os
import sys
import django

# Setup Django
sys.path.append(r'c:\Archana\glenda_vite\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from area_app.models import Area, DeliveryLocation, DeliveryLocationCoordinate

def run_diagnostics():
    print("============================================================")
    print("GELNDA DIAGNOSTICS - VAZHAKULAM AREA & DELIVERY LOCATIONS")
    print("============================================================\n")

    # STEP 1 & 2: VAZHAKULAM AREA
    try:
        area = Area.objects.get(name__icontains="Vazhakulam")
        print(f"AREA: {area.name}")
        print(f"AREA ID: {area.id}")
        
        polygon = area.polygon_coordinates
        has_polygon = bool(polygon and len(polygon) > 0)
        print(f"SAVED POLYGON: {'YES' if has_polygon else 'NO'}")
        if has_polygon:
            print(f"POLYGON POINT COUNT: {len(polygon)}")
            print(f"POLYGON SAMPLE: {polygon[:2]}")
        else:
            print("POLYGON POINT COUNT: 0")
    except Area.DoesNotExist:
        print("AREA: Vazhakulam (NOT FOUND)")
        area = None
        polygon = []

    print("\n------------------------------------------------------------\n")

    # STEP 3 & 4: DELIVERY LOCATIONS & COORDINATES
    dl_count = DeliveryLocation.objects.count()
    dlc_count = DeliveryLocationCoordinate.objects.count()
    dlc_valid = DeliveryLocationCoordinate.objects.filter(latitude__isnull=False, longitude__isnull=False).count()

    print(f"MAIN DELIVERY LOCATION MODEL: DeliveryLocation (coords in DeliveryLocationCoordinate)")
    print(f"TOTAL DELIVERY LOCATIONS: {dl_count}")
    print(f"TOTAL DELIVERY LOCATION COORDINATES: {dlc_count}")
    print(f"DELIVERY LOCATIONS WITH VALID COORDINATES: {dlc_valid}")

    print("\n------------------------------------------------------------\n")

    # STEP 5 & 7: DETECTION API LOGIC
    def _is_point_in_polygon(lat, lng, polygon):
        x, y = float(lat), float(lng)
        inside = False
        n = len(polygon)
        if n == 0: return False
        p1x, p1y = float(polygon[0].get('lat', 0)), float(polygon[0].get('lng', 0))
        for i in range(1, n + 1):
            p2x, p2y = float(polygon[i % n].get('lat', 0)), float(polygon[i % n].get('lng', 0))
            if min(p1y, p2y) < y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xints = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xints:
                        inside = not inside
            p1x, p1y = p2x, p2y
        return inside

    matched = []
    if area and has_polygon:
        coords = DeliveryLocationCoordinate.objects.all()
        for c in coords:
            if c.latitude and c.longitude:
                if _is_point_in_polygon(c.latitude, c.longitude, polygon):
                    matched.append(c.delivery_location.id)
    
    print(f"DETECTED LOCATIONS: {len(matched)}")
    print(f"DETECTION API RESPONSE (IDs): {matched}")

    print("\n============================================================")

if __name__ == '__main__':
    run_diagnostics()
