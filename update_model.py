import re

with open(r'c:\Archana\glenda_vite\backend\area_app\models.py', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''class DeliveryLocation(models.Model):
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

'''

content = re.sub(r'class DeliveryLocation\(models\.Model\):.*?updated_at = models\.DateTimeField\(auto_now=True\)\n+', replacement, content, flags=re.DOTALL)

with open(r'c:\Archana\glenda_vite\backend\area_app\models.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated DeliveryLocation model")
