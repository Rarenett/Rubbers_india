import json
from area_app.models import Area, AreaGeofenceHistory
areas = Area.objects.all()
for area in areas:
    history = AreaGeofenceHistory.objects.filter(area=area).order_by('-version_number').first()
    print("Area:", area.name, area.id)
    if history:
        print("polygon_distances length:", len(history.polygon_distances) if history.polygon_distances else 0)
        print("polygon_distances:", history.polygon_distances)
    else:
        print("No history")
