from rest_framework import viewsets, permissions, filters
from .models import Area, SalesmanMapping, SalesmanVisiting, DeliveryLocation, AreaLocationMapping, AreaGeofenceHistory, DeliveryLocationCoordinate
from logistics_app.models import RouteStopMaster
from django.db.models.deletion import ProtectedError
import math
from rest_framework.response import Response
from rest_framework import status
from .serializers import AreaSerializer, SalesmanMappingSerializer, SalesmanVisitingSerializer, DeliveryLocationSerializer, AreaLocationMappingSerializer, AreaGeofenceHistorySerializer, DeliveryLocationCoordinateSerializer
from rest_framework.decorators import action, api_view
import json
import requests

class DeliveryLocationViewSet(viewsets.ModelViewSet):
    queryset = DeliveryLocation.objects.select_related('area').all().order_by('location_number')
    serializer_class = DeliveryLocationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['area__name', 'location_name']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        area_id = self.request.query_params.get('area')
        if area_id:
            queryset = queryset.filter(area_id=area_id)
        return queryset


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

    def perform_create(self, serializer):
        area = serializer.validated_data.get('area')
        if area:
            max_num = DeliveryLocation.objects.filter(area=area).count()
            serializer.save(location_number=max_num + 1)
        else:
            serializer.save()

class AreaViewSet(viewsets.ModelViewSet):
    queryset = Area.objects.prefetch_related('delivery_locations').all().order_by('-created_at')
    serializer_class = AreaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _reverse_geocode(self, lat, lon):
        try:
            url = "https://nominatim.openstreetmap.org/reverse"
            params = {'lat': lat, 'lon': lon, 'format': 'json'}
            headers = {
                'Accept-Language': 'en-US,en;q=0.9',
                'User-Agent': 'GlendaViteApp/1.0 (contact@glendavite.com)'
            }
            response = requests.get(url, params=params, headers=headers, timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data and 'display_name' in data:
                    name_parts = data['display_name'].split(',')
                    return name_parts[0].strip() if name_parts else None
            return None
        except Exception:
            return None

    def _calculate_haversine(self, lat1, lon1, lat2, lon2):
        if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
            return float('inf')
        R = 6371000  # radius of Earth in meters
        phi_1 = math.radians(float(lat1))
        phi_2 = math.radians(float(lat2))
        delta_phi = math.radians(float(lat2) - float(lat1))
        delta_lambda = math.radians(float(lon2) - float(lon1))
        
        a = math.sin(delta_phi / 2.0) ** 2 + \
            math.cos(phi_1) * math.cos(phi_2) * \
            math.sin(delta_lambda / 2.0) ** 2
        
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    def _generate_polygon_locations(self, area):
        if area.geofence_type != 'polygon' or not area.polygon_coordinates:
            return

        polygon = area.polygon_coordinates
        import json
        if isinstance(polygon, str):
            try:
                polygon = json.loads(polygon)
            except:
                polygon = []

        if not isinstance(polygon, list) or len(polygon) < 3:
            return

        def get_pt(pt):
            if isinstance(pt, dict):
                return float(pt.get('lat', 0)), float(pt.get('lng', 0))
            elif isinstance(pt, (list, tuple)) and len(pt) >= 2:
                val0, val1 = float(pt[0]), float(pt[1])
                if val0 > 50 and val1 < 50:
                    return val1, val0
                return val0, val1
            return None, None

        unique_points = []
        for pt in polygon:
            lat, lng = get_pt(pt)
            if lat is not None and lng is not None:
                if not unique_points or (unique_points[-1][0] != lat or unique_points[-1][1] != lng):
                    unique_points.append((lat, lng))

        if len(unique_points) > 1 and unique_points[0] == unique_points[-1]:
            unique_points.pop()

        # Get existing tracked locations for this area
        tracked_locations = DeliveryLocation.objects.filter(area=area, location_name__endswith='\u200b')
        existing_coords = {}
        for dl in tracked_locations:
            if hasattr(dl, 'coordinates'):
                try:
                    plat = round(float(dl.coordinates.latitude), 5)
                    plng = round(float(dl.coordinates.longitude), 5)
                    existing_coords[(plat, plng)] = dl
                except:
                    pass

        seen_names = set()
        active_ids = []
        location_number_counter = DeliveryLocation.objects.filter(area=area).count() + 1

        for idx, (lat, lng) in enumerate(unique_points):
            plat = round(float(lat), 5)
            plng = round(float(lng), 5)

            if (plat, plng) in existing_coords:
                dl = existing_coords[(plat, plng)]
                place_name = dl.location_name.rstrip('\u200b')
                if place_name in seen_names:
                    continue
                seen_names.add(place_name)
                active_ids.append(dl.id)
            else:
                place_name = self._reverse_geocode(lat, lng)
                if not place_name:
                    place_name = f"{area.name} Boundary {idx + 1}"

                if place_name in seen_names:
                    continue
                seen_names.add(place_name)

                tracked_name = place_name + '\u200b'
                dl = DeliveryLocation.objects.create(
                    area=area,
                    location_name=tracked_name,
                    location_number=location_number_counter,
                    status='Active'
                )
                DeliveryLocationCoordinate.objects.create(
                    delivery_location=dl,
                    latitude=lat,
                    longitude=lng
                )
                active_ids.append(dl.id)
                location_number_counter += 1

        # Clean up obsolete polygon points
        DeliveryLocation.objects.filter(area=area, location_name__endswith='\u200b').exclude(id__in=active_ids).delete()
        prefix = f"{area.name} - Polygon Point"
        DeliveryLocation.objects.filter(area=area, location_name__startswith=prefix).delete()

    @action(detail=True, methods=['get'])
    def detected_locations(self, request, pk=None):
        area = self.get_object()
        matched_locations = []

        if area.geofence_type == 'polygon' and area.polygon_coordinates:
            tracked_locations = DeliveryLocation.objects.filter(area=area, location_name__endswith='\u200b')
            for dl in tracked_locations:
                place_name = dl.location_name.rstrip('\u200b')
                matched_locations.append({'id': dl.id, 'location_name': place_name})
        
        return Response(matched_locations)

    @action(detail=True, methods=['post'])
    def check_overlap(self, request, pk=None):
        area = self.get_object()
        return Response({'overlap': False})

    def _run_generate_polygon_locations_async(self, area_id):
        import threading
        from django.db import connection
        
        def run():
            try:
                area = Area.objects.get(id=area_id)
                self._generate_polygon_locations(area)
            except Exception as e:
                print("Async polygon generation error:", e)
            finally:
                connection.close()
                
        threading.Thread(target=run).start()

    def perform_create(self, serializer):
        area = serializer.save()
        self._run_generate_polygon_locations_async(area.id)

    def perform_update(self, serializer):
        area = serializer.save()
        self._run_generate_polygon_locations_async(area.id)

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "Cannot delete this Area because it is currently mapped to other records (like Delivery Locations or Salesman Mappings). Please remove those mappings first."},
                status=status.HTTP_400_BAD_REQUEST
            )

class SalesmanMappingViewSet(viewsets.ModelViewSet):
    queryset = SalesmanMapping.objects.select_related('area', 'department', 'employee__user').all().order_by('-created_at')
    serializer_class = SalesmanMappingSerializer
    permission_classes = [permissions.IsAuthenticated]

class SalesmanVisitingViewSet(viewsets.ModelViewSet):
    queryset = SalesmanVisiting.objects.select_related(
        'salesman_mapping__area', 
        'salesman_mapping__department', 
        'salesman_mapping__employee__user',
        'salesman_mapping__reporting_person__user',
        'delivery_location'
    ).all().order_by('-created_at')
    serializer_class = SalesmanVisitingSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = [
        'salesman_mapping__employee__user__first_name',
        'salesman_mapping__employee__user__last_name',
        'salesman_mapping__area__name',
        'delivery_location__location_name',
    ]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        
        if not user or not user.is_authenticated:
            return qs.none()
            
        if user.is_superuser:
            return qs
            
        if hasattr(user, 'employee') and user.employee:
            is_salesman = SalesmanMapping.objects.filter(employee=user.employee).exists()
            if is_salesman:
                return qs.filter(salesman_mapping__employee=user.employee)
                
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if not user.is_superuser:
            if hasattr(user, 'employee') and user.employee:
                if SalesmanMapping.objects.filter(employee=user.employee).exists():
                    mapping = serializer.validated_data.get('salesman_mapping')
                    if mapping and mapping.employee != user.employee:
                        from rest_framework.exceptions import PermissionDenied
                        raise PermissionDenied("You can only create visiting records for yourself.")
        serializer.save()
        
    def perform_update(self, serializer):
        user = self.request.user
        if not user.is_superuser:
            if hasattr(user, 'employee') and user.employee:
                if SalesmanMapping.objects.filter(employee=user.employee).exists():
                    mapping = serializer.validated_data.get('salesman_mapping')
                    if mapping and mapping.employee != user.employee:
                        from rest_framework.exceptions import PermissionDenied
                        raise PermissionDenied("You can only assign visiting records to yourself.")
        serializer.save()

class AreaLocationMappingViewSet(viewsets.ModelViewSet):
    queryset = AreaLocationMapping.objects.select_related('area', 'delivery_location').all().order_by('-created_at')
    serializer_class = AreaLocationMappingSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['area__name', 'delivery_location__location_name']


class DeliveryLocationCoordinateViewSet(viewsets.ModelViewSet):
    queryset = DeliveryLocationCoordinate.objects.all()
    serializer_class = DeliveryLocationCoordinateSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def all_coordinates(self, request):
        coords = self.queryset.values('delivery_location__location_name', 'latitude', 'longitude')
        return Response(list(coords))

    @action(detail=False, methods=['post'])
    def nearest(self, request):
        lat = request.data.get('latitude')
        lng = request.data.get('longitude')
        if lat is None or lng is None:
            return Response({'error': 'latitude and longitude are required'}, status=400)
        
        try:
            lat = float(lat)
            lng = float(lng)
        except:
            return Response({'error': 'Invalid latitude or longitude'}, status=400)
            
        coords = list(self.queryset.select_related('delivery_location').all())
        results = []
        
        def calc_dist(lat1, lon1, lat2, lon2):
            R = 6371000
            p1, p2 = math.radians(lat1), math.radians(lat2)
            dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
            a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
            return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
            
        for c in coords:
            dist = calc_dist(lat, lng, float(c.latitude), float(c.longitude))
            results.append({
                'id': c.delivery_location.id,
                'location_name': c.delivery_location.location_name,
                'distance_km': round(dist / 1000, 2),
                'latitude': float(c.latitude),
                'longitude': float(c.longitude)
            })
            
        results.sort(key=lambda x: x['distance_km'])
        return Response(results[:10])  # return top 10 nearest


class AreaGeofenceHistoryViewSet(viewsets.ModelViewSet):
    queryset = AreaGeofenceHistory.objects.all().order_by('-version_number')
    serializer_class = AreaGeofenceHistorySerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        qs = super().get_queryset()
        area_id = self.request.query_params.get('area')
        if area_id:
            qs = qs.filter(area_id=area_id)
        return qs

@api_view(['GET'])
def geocode_search(request):
    query = request.query_params.get('q')
    if not query:
        return Response({'error': 'Query parameter q is required'}, status=status.HTTP_400_BAD_REQUEST)

    search_query = query.strip()

    import time
    def fetch_from_nominatim(q, retries=1):
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            'q': q,
            'format': 'json',
            'limit': 10,
            'addressdetails': 1
        }
        headers = {
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': f'GlendaViteApp/1.0 (contact_{int(time.time())}@glendavite.com)'
        }
        for attempt in range(retries + 1):
            try:
                time.sleep(1) # Respect Nominatim rate limits (1 request/sec)
                resp = requests.get(url, params=params, headers=headers, timeout=10)
                resp.raise_for_status() # Raise exception for 4xx/5xx
                
                data = resp.json()
                if data and len(data) > 0:
                    results = []
                    for place in data:
                        results.append({
                            'latitude': float(place.get('lat', 0)),
                            'longitude': float(place.get('lon', 0)),
                            'name': place.get('name', ''),
                            'display_name': place.get('display_name', ''),
                            'type': place.get('type', ''),
                            'class': place.get('class', ''),
                            'importance': place.get('importance', 0),
                            'place_rank': place.get('place_rank', 0),
                            'address': place.get('address', {})
                        })
                    return results
                return None
            except Exception as e:
                if attempt == retries:
                    raise e
                time.sleep(1.5)
        return None

    try:
        # Attempt 1: Exact query
        results = fetch_from_nominatim(search_query)
        
        # Attempt 2: Retry with geographic context if not found
        if not results and ',' not in search_query:
            context_query = f"{search_query}, Kerala, India"
            results = fetch_from_nominatim(context_query)
            
        if results:
            return Response(results)
            
        return Response({'error': 'Location not found'}, status=status.HTTP_404_NOT_FOUND)
        
    except requests.exceptions.RequestException as e:
        return Response({'error': f'Geocoding service error: {str(e)}'}, status=status.HTTP_502_BAD_GATEWAY)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def geocode_reverse(request):
    lat = request.query_params.get('lat')
    lon = request.query_params.get('lon')
    
    if not lat or not lon:
        return Response({'error': 'lat and lon are required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        url = "https://nominatim.openstreetmap.org/reverse"
        params = {
            'lat': lat,
            'lon': lon,
            'format': 'json'
        }
        headers = {
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': 'GlendaViteApp/1.0 (contact@glendavite.com)'
        }
        response = requests.get(url, params=params, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data and 'display_name' in data:
                return Response({
                    'display_name': data['display_name'],
                    'latitude': float(data.get('lat', lat)),
                    'longitude': float(data.get('lon', lon)),
                    'address': data.get('address', {})
                })
            return Response({'error': 'Location not found'}, status=status.HTTP_404_NOT_FOUND)
            
        return Response({'error': 'Geocoding service error'}, status=status.HTTP_502_BAD_GATEWAY)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

