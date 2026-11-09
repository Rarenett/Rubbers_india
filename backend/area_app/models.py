from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver

class Area(models.Model):
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, default='Active', choices=[('Active', 'Active'), ('Inactive', 'Inactive')])
    
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    google_place_id = models.CharField(max_length=255, null=True, blank=True)
    formatted_address = models.TextField(null=True, blank=True)
    geofence_type = models.CharField(max_length=50, default='circle')
    geofence_radius = models.IntegerField(default=5000, help_text='Radius in meters')
    polygon_coordinates = models.JSONField(null=True, blank=True, help_text="List of {lat, lng} objects for polygon")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name or 'Unnamed Area'

class AreaGeofenceHistory(models.Model):
    area = models.ForeignKey(Area, on_delete=models.CASCADE, related_name='geofence_history')
    version_number = models.IntegerField()
    geofence_type = models.CharField(max_length=50, default='circle')
    geofence_radius = models.IntegerField(default=5000)
    polygon_coordinates = models.JSONField(null=True, blank=True)
    polygon_distances = models.JSONField(null=True, blank=True)
    total_distance_km = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    change_type = models.CharField(max_length=100, default='Updated')
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # created_by could be added if we had auth available, omitted for simplicity

    class Meta:
        ordering = ['-version_number']

    def __str__(self):
        return f'{self.area.name} - v{self.version_number}'

    def save(self, *args, **kwargs):
        if self.geofence_type == 'polygon' and self.polygon_coordinates:
            import math
            def haversine(lat1, lon1, lat2, lon2):
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
                return (R * c) / 1000.0  # Convert to km

            def get_names_dict():
                from .models import DeliveryLocationCoordinate
                names_dict = {}
                try:
                    coords = DeliveryLocationCoordinate.objects.filter(delivery_location__area=self.area).select_related('delivery_location')
                    for c in coords:
                        plat = round(float(c.latitude), 5)
                        plng = round(float(c.longitude), 5)
                        names_dict[(plat, plng)] = c.delivery_location.location_name.rstrip('\u200b')
                except Exception:
                    pass
                return names_dict

            names_dict = get_names_dict()
            def get_name(lat, lng):
                key = (round(float(lat), 5), round(float(lng), 5))
                if key in names_dict:
                    return names_dict[key]
                try:
                    import googlemaps
                    from django.conf import settings
                    gmaps = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)
                    res = gmaps.reverse_geocode((lat, lng))
                    if res:
                        for c in res[0].get('address_components', []):
                            if 'locality' in c.get('types', []):
                                return c['long_name']
                        return res[0].get('formatted_address', '').split(',')[0]
                except Exception:
                    pass
                return "Unnamed Location"

            distances = []
            poly = self.polygon_coordinates
            if isinstance(poly, list) and len(poly) >= 3 and not self.polygon_distances:
                for i in range(len(poly)):
                    p1 = poly[i]
                    p2 = poly[(i + 1) % len(poly)]
                    try:
                        lat1, lng1 = float(p1.get('lat')), float(p1.get('lng'))
                        lat2, lng2 = float(p2.get('lat')), float(p2.get('lng'))
                        
                        dist_km = haversine(lat1, lng1, lat2, lng2)
                        
                        name1 = get_name(lat1, lng1)
                        name2 = get_name(lat2, lng2)
                        
                        distances.append({
                            "from_location": name1,
                            "to_location": name2,
                            "distance_km": round(dist_km, 2)
                        })
                    except Exception:
                        pass
                self.polygon_distances = distances
                
            if isinstance(self.polygon_distances, list):
                total = 0.0
                for seg in self.polygon_distances:
                    if isinstance(seg, dict) and 'distance_km' in seg:
                        try:
                            total += float(seg['distance_km'])
                        except (ValueError, TypeError):
                            pass
                    elif isinstance(seg, (int, float, str)):
                        try:
                            total += float(seg)
                        except (ValueError, TypeError):
                            pass
                self.total_distance_km = round(total, 2)
                
        super().save(*args, **kwargs)

@receiver(post_save, sender=Area)
def sync_area_geofence_history(sender, instance, created, **kwargs):
    if instance.geofence_type in ['polygon', 'circle']:
        latest = AreaGeofenceHistory.objects.filter(area=instance).order_by('-created_at').first()
        if latest and latest.polygon_coordinates == instance.polygon_coordinates and latest.geofence_radius == instance.geofence_radius and latest.geofence_type == instance.geofence_type:
            return
        version = (latest.version_number + 1) if latest else 1
        AreaGeofenceHistory.objects.create(
            area=instance,
            version_number=version,
            geofence_type=instance.geofence_type,
            geofence_radius=instance.geofence_radius if instance.geofence_radius is not None else 5000,
            polygon_coordinates=instance.polygon_coordinates,
            latitude=instance.latitude if instance.latitude is not None else 0.0,
            longitude=instance.longitude if instance.longitude is not None else 0.0,
            change_type='System Auto Save'
        )

class DeliveryLocation(models.Model):
    area = models.ForeignKey(Area, on_delete=models.CASCADE, related_name='delivery_locations')
    location_name = models.CharField(max_length=255)
    location_number = models.IntegerField()
    status = models.CharField(max_length=20, default='Active', choices=[('Active', 'Active'), ('Inactive', 'Inactive')])
    route_stop = models.ForeignKey('logistics_app.RouteStopMaster', on_delete=models.SET_NULL, null=True, blank=True, related_name='area_delivery_locations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        from logistics_app.models import RouteStopMaster
        
        if not is_new and self.route_stop:
            try:
                old_instance = DeliveryLocation.objects.get(pk=self.pk)
                if old_instance.location_name != self.location_name:
                    self.route_stop.stop_name = self.location_name
                    self.route_stop.save(update_fields=['stop_name'])
            except DeliveryLocation.DoesNotExist:
                pass
                
        super().save(*args, **kwargs)
        
        if not self.route_stop:
            route_stop = RouteStopMaster.objects.filter(stop_name=self.location_name).first()
            if not route_stop:
                route_stop = RouteStopMaster.objects.create(
                    stop_name=self.location_name,
                    distance_km=0
                )
            DeliveryLocation.objects.filter(pk=self.pk).update(route_stop=route_stop)

    class Meta:
        ordering = ['location_number']

    def __str__(self):
        return f'{self.location_number}. {self.location_name} ({self.area})'

class DeliveryLocationCoordinate(models.Model):
    delivery_location = models.OneToOneField(DeliveryLocation, on_delete=models.CASCADE, related_name='coordinates')
    latitude = models.DecimalField(max_digits=11, decimal_places=8)
    longitude = models.DecimalField(max_digits=11, decimal_places=8)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.delivery_location.location_name} ({self.latitude}, {self.longitude})"

class SalesmanMapping(models.Model):
    area = models.ForeignKey(Area, on_delete=models.CASCADE, related_name='salesman_mappings', null=True)
    department = models.ForeignKey('rarenett_app.Department', on_delete=models.CASCADE, related_name='salesman_mappings_area')
    employee = models.ForeignKey('rarenett_app.Employee', on_delete=models.CASCADE, related_name='salesman_mappings_area')
    reporting_person_department = models.ForeignKey('rarenett_app.Department', on_delete=models.CASCADE, related_name='salesman_mappings_reporting_dept', null=True, blank=True)
    reporting_person = models.ForeignKey('rarenett_app.Employee', on_delete=models.CASCADE, related_name='salesman_mappings_reporting_person', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('area', 'department', 'employee')

    def __str__(self):
        area_str = self.area.name if self.area else 'No Area'
        return f'{area_str} - {self.department.name} - {self.employee.user.username}'

class AreaLocationMapping(models.Model):
    area = models.ForeignKey(Area, on_delete=models.CASCADE, related_name='location_mappings')
    delivery_location = models.ForeignKey(DeliveryLocation, on_delete=models.CASCADE, related_name='area_mappings', null=True, blank=True)
    custom_location_name = models.CharField(max_length=255, null=True, blank=True)
    source = models.CharField(max_length=20, default='MANUAL', choices=[('AUTO', 'AUTO'), ('MANUAL', 'MANUAL')])
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('area', 'delivery_location', 'custom_location_name')
        ordering = ['-created_at', '-id']
        
    def __str__(self):
        return f"{self.area.name} -> {self.delivery_location.location_name if self.delivery_location else self.custom_location_name}"

@receiver(post_save, sender=AreaLocationMapping)
def sync_to_delivery_location(sender, instance, created, **kwargs):
    if created:
        loc_name = instance.delivery_location.location_name if instance.delivery_location else instance.custom_location_name
        if not DeliveryLocation.objects.filter(area=instance.area, location_name__iexact=loc_name).exists():
            max_num = DeliveryLocation.objects.filter(area=instance.area).count()
            DeliveryLocation.objects.create(
                area=instance.area, 
                location_name=loc_name, 
                location_number=max_num + 1, 
                status='Active'
            )

class SalesmanVisiting(models.Model):
    salesman_mapping = models.ForeignKey(SalesmanMapping, on_delete=models.PROTECT, related_name='visitings')
    delivery_location = models.ForeignKey(DeliveryLocation, on_delete=models.PROTECT, related_name='salesman_visitings')
    visiting_date = models.DateField()
    status = models.CharField(max_length=20, default='Planned', choices=[
        ('Planned', 'Planned'), 
        ('Completed', 'Completed'), 
        ('Cancelled', 'Cancelled')
    ])
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-visiting_date']

    def __str__(self):
        return f'{self.salesman_mapping} - {self.delivery_location} on {self.visiting_date}'
