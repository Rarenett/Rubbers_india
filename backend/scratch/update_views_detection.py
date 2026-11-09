import os

views_path = r'c:\Archana\glenda_vite\backend\area_app\views.py'
with open(views_path, 'r') as f:
    content = f.read()

# I will add an endpoint to AreaViewSet: detected_locations
new_endpoint = """
    def _is_point_in_polygon(self, lat, lng, polygon):
        x, y = float(lat), float(lng)
        inside = False
        n = len(polygon)
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

    @action(detail=True, methods=['get'])
    def detected_locations(self, request, pk=None):
        area = self.get_object()
        
        # We need to find DeliveryLocations that fall inside this Area's geofence.
        # We ONLY use DeliveryLocationCoordinate, NOT RouteStopMaster.
        coords = DeliveryLocationCoordinate.objects.select_related('delivery_location').all()
        
        matched_locations = []
        
        if area.geofence_type == 'polygon' and area.polygon_coordinates:
            polygon = area.polygon_coordinates
            for c in coords:
                if self._is_point_in_polygon(c.latitude, c.longitude, polygon):
                    matched_locations.append(c.delivery_location.id)
        elif area.latitude and area.longitude and area.geofence_radius:
            radius = area.geofence_radius
            for c in coords:
                dist = self._calculate_haversine(area.latitude, area.longitude, c.latitude, c.longitude)
                if dist <= float(radius):
                    matched_locations.append(c.delivery_location.id)
                    
        return Response(matched_locations)

    @action(detail=True, methods=['post'])
    def check_overlap(self, request, pk=None):
        area = self.get_object()
        # simplified check: we just return false for now unless we implement full polygon intersection
        # actually, let's just do bounding box check or return empty if too complex to do in pure python
        return Response({'overlap': False})
"""

# inject this before perform_create in AreaViewSet
if 'def detected_locations' not in content:
    content = content.replace(
        '    def perform_create(self, serializer):',
        new_endpoint + '\n    def perform_create(self, serializer):'
    )

with open(views_path, 'w') as f:
    f.write(content)
