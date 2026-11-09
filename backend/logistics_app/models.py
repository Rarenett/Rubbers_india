import datetime
from register_app.models import CustomUser
from django.db import models
from django.urls import reverse
from django.core.exceptions import ValidationError
from django.utils import timezone

# Create your models here.
class Driver(models.Model):
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='driver_profile'
    )
    license_number = models.CharField(max_length=200, null=True)
    aadhaar_number = models.CharField(max_length=200, null=True)
    phone_number = models.CharField(max_length=200, null=True)
    license_exp_date = models.DateField(null=True)
    upload_license = models.ImageField(upload_to='images/', null=True)
    driver_status = models.CharField(max_length=20, default='available')  # Add this if missing

    created_by = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='drivers_created'
    )

    def get_absolute_url(self):
        return reverse('view_driver')

    def __str__(self):
        if self.user:
            return self.user.name
        return "Unnamed Driver"

    def formatted_license_exp_date(self):
        if self.license_exp_date and self.license_exp_date >= timezone.now().date():
            return self.license_exp_date.strftime('%d-%m-%Y')
        return None  # Return None if the date is in the past

    def clean(self):
        if self.license_exp_date and self.license_exp_date < timezone.now().date():
            raise ValidationError("License expiration date cannot be in the past.")


class Vehicle_category(models.Model):
    category_name=models.CharField(max_length=50,null=True)
    created_by = models.ForeignKey(CustomUser, on_delete=models.CASCADE, null=True, related_name='created_veh_cat')

    def get_absolute_url(self):
        return reverse('vehicle_category_list')
    
    def __str__(self):
        return self.category_name

          



FUEL_TYPES = [
    ('diesel', 'Diesel'),
    ('petrol', 'Petrol'),
    ('electric', 'Electric'),
    ('cng', 'CNG'),
    ('hybrid', 'Hybrid'),
]

STATUS_CHOICES = [
    ('available', 'Available'),
    ('in_use', 'In Use'),
    ('maintenance', 'Maintenance'),
    ('inactive', 'Inactive'),
]


class Vehicle(models.Model):
    category = models.ForeignKey(
        'Vehicle_category', on_delete=models.CASCADE,
        related_name='vehicles', null=True
    )
    driver = models.ForeignKey(
        'Driver', on_delete=models.SET_NULL,
        related_name='vehicles', null=True, blank=True
    )

    vehicle_code = models.CharField(max_length=10, unique=True, blank=True, null=True)
    vehicle_name = models.CharField(max_length=200, null=True)
    vehicle_number = models.CharField(max_length=50, unique=True, null=True)
    vehicle_img = models.ImageField(upload_to='images/', null=True, blank=True)

    fuel_type = models.CharField(max_length=20, choices=FUEL_TYPES, null=True)
    mileage = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    tonnage = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    volume = models.DecimalField(max_digits=10, decimal_places=2, help_text="Volume in m³", null=True)
    capacity = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    front_tyre_size = models.CharField(max_length=20, null=True, blank=True)
    rear_tyre_size = models.CharField(max_length=20, null=True, blank=True)

    vehicle_insurance_date = models.DateField(null=True)
    vehicle_taxes_date = models.DateField(null=True)
    vehicle_pollution_date = models.DateField(null=True)
    next_service_date = models.DateField(null=True, blank=True)
    next_retest_date = models.DateField(null=True, blank=True)

    vehicle_fasttag = models.CharField(max_length=20, null=True)
    narration = models.TextField(null=True, blank=True)

    created_by = models.ForeignKey(CustomUser,on_delete=models.CASCADE, null=True)
    vehicle_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available', null=True)

    created_at = models.DateTimeField(auto_now_add=True,null=True)
    updated_at = models.DateTimeField(auto_now=True,null=True)

    def clean(self):
        if self.mileage and self.mileage < 0:
            raise ValidationError("Mileage must be a positive number.")

    def save(self, *args, **kwargs):
        if not self.vehicle_code:
            last = Vehicle.objects.order_by('-id').first()
            if last and last.vehicle_code and '-' in last.vehicle_code:
                try:
                    last_number = int(last.vehicle_code.split('-')[1])
                    self.vehicle_code = f"VH-{last_number + 1:04d}"
                except ValueError:
                    self.vehicle_code = "VH-0001"
            else:
                self.vehicle_code = "VH-0001"
        self.full_clean()  # Run validations
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        return reverse('view_vehicle')

    def __str__(self):
        return f"{self.vehicle_name} ({self.vehicle_number})"

class ServiceType(models.Model):
    service_type = models.CharField(max_length=100)
    description  = models.TextField(blank=True, null=True)
    created_by   = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_service_types',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
 
    def __str__(self):
        return self.service_type
 
    class Meta:
        verbose_name        = 'Service Type'
        verbose_name_plural = 'Service Types'
        ordering            = ['service_type']

class VehicleHistory(models.Model):
    trans_no       = models.CharField(max_length=20, unique=True, editable=False)
    trans_date     = models.DateField()
    vehicle        = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='history_records')
    default_driver = models.ForeignKey(Driver, on_delete=models.SET_NULL, null=True, blank=True, related_name='vehicle_histories')
    actual_km      = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    service_type   = models.ForeignKey(ServiceType, on_delete=models.SET_NULL, null=True, blank=True, related_name='vehicle_histories')
    cost           = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    fuel_liters    = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text='Litres filled (only for Fuel Filling service types)')  # ← NEW
    attachment     = models.FileField(upload_to='vehicle_history/', null=True, blank=True)
    narration      = models.TextField(null=True, blank=True)
    created_by     = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, related_name='created_vehicle_histories')
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.trans_no: 
            last = VehicleHistory.objects.order_by('-id').first()
            if last and last.trans_no and last.trans_no.startswith('VHT-'):
                try:
                    last_num = int(last.trans_no.split('-')[1])
                    self.trans_no = f"VHT-{last_num + 1:05d}"
                except ValueError:
                    self.trans_no = "VHT-00001"
            else:
                self.trans_no = "VHT-00001"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.trans_no} — {self.vehicle}"

    class Meta:
        verbose_name        = 'Vehicle History'
        verbose_name_plural = 'Vehicle Histories'
        ordering            = ['-trans_date', '-id']


class FineAndToken(models.Model):
    fine_no = models.CharField(max_length=50, unique=True, blank=True)
    fine_date = models.DateField()
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='fines', null=True, blank=True)
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE, related_name='fines', null=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    narration = models.TextField(null=True, blank=True)
    attachment = models.FileField(upload_to='fines_attachments/', null=True, blank=True)
    status = models.CharField(max_length=20, choices=(('Pending', 'Pending'), ('Paid', 'Paid')), default='Pending')

    created_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, related_name='created_fines')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.fine_no:
            last = FineAndToken.objects.order_by('-id').first()
            if last and last.fine_no and last.fine_no.startswith('FIN-'):
                try:
                    last_num = int(last.fine_no.split('-')[1])
                    self.fine_no = f"FIN-{last_num + 1:04d}"
                except ValueError:
                    self.fine_no = "FIN-1000"
            else:
                self.fine_no = "FIN-1000"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.fine_no} - {self.driver.user.first_name if self.driver and self.driver.user else 'Unknown'}"

    class Meta:
        ordering = ['-fine_date', '-id']

class ServiceRequest(models.Model):
    request_no = models.CharField(max_length=50, unique=True, blank=True)
    date = models.DateField()
    driver = models.ForeignKey(Driver, on_delete=models.SET_NULL, null=True, blank=True, related_name='service_requests')
    vehicle = models.ForeignKey(Vehicle, on_delete=models.SET_NULL, null=True, blank=True, related_name='service_requests')
    service_type = models.ForeignKey(ServiceType, on_delete=models.SET_NULL, null=True, blank=True, related_name='service_requests')
    expiry_date = models.DateField(null=True, blank=True)
    narration = models.TextField(null=True, blank=True)
    
    created_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, related_name='created_service_requests')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.request_no:
            last = ServiceRequest.objects.order_by('-id').first()
            if last and last.request_no and last.request_no.startswith('SRV-'):
                try:
                    last_num = int(last.request_no.split('-')[1])
                    self.request_no = f"SRV-{last_num + 1:04d}"
                except ValueError:
                    self.request_no = "SRV-1000"
            else:
                self.request_no = "SRV-1000"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.request_no} - {self.vehicle}"

    class Meta:
        verbose_name = 'Service Request'
        verbose_name_plural = 'Service Requests'
        ordering = ['-date', '-id']

#### log

class DriverAuditLog(models.Model):

    ACTION_CHOICES = (
        ('CREATE', 'Create'),
        ('EDIT', 'Edit'),
        ('DELETE', 'Delete'),
    )

    driver = models.ForeignKey(
        Driver,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    driver_name = models.CharField(
        max_length=255,
        null=True,
        blank=True
    )

    action = models.CharField(
        max_length=20,
        choices=ACTION_CHOICES
    )

    modified_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    modified_at = models.DateTimeField(
        auto_now_add=True
    )

    remarks = models.TextField(
        blank=True,
        null=True
    )

    class Meta:
        ordering = ['-modified_at']

    def __str__(self):
        return f"{self.driver_name} - {self.action}"

class VehicleAuditLog(models.Model):

    ACTION_CHOICES = (
        ('CREATE', 'Create'),
        ('EDIT', 'Edit'),
        ('DELETE', 'Delete'),
    )

    vehicle = models.ForeignKey(
        Vehicle,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    vehicle_name = models.CharField(
        max_length=255,
        blank=True,
        null=True
    )

    vehicle_number = models.CharField(
        max_length=50,
        blank=True,
        null=True
    )

    action = models.CharField(
        max_length=20,
        choices=ACTION_CHOICES
    )

    modified_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    modified_at = models.DateTimeField(
        auto_now_add=True
    )

    remarks = models.TextField(
        blank=True,
        null=True
    )

    class Meta:
        ordering = ['-modified_at']

    def __str__(self):
        return f"{self.vehicle_name} - {self.action}"

class VehicleHistoryAuditLog(models.Model):

    ACTION_CHOICES = (
        ('CREATE', 'Create'),
        ('EDIT',   'Edit'),
        ('DELETE', 'Delete'),
    )

    vehicle_history = models.ForeignKey(
        VehicleHistory,
        on_delete=models.SET_NULL,
        null=True, blank=True
    )

    trans_no = models.CharField(max_length=20, null=True, blank=True)
    vehicle_name = models.CharField(max_length=255, null=True, blank=True)
    vehicle_number = models.CharField(max_length=50, null=True, blank=True)

    action = models.CharField(max_length=20, choices=ACTION_CHOICES)

    modified_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True, blank=True
    )

    modified_at = models.DateTimeField(auto_now_add=True)

    remarks = models.TextField(null=True, blank=True)

    class Meta:
        ordering = ['-modified_at']

    def __str__(self):
        return f"{self.trans_no} - {self.action}"

class DriverJourney(models.Model):
    STATUS_CHOICES = (
        ('STARTED', 'Started'),
        ('COMPLETED', 'Completed'),
    )
    
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE, related_name='journeys')
    date = models.DateField(default=datetime.date.today)
    start_km = models.DecimalField(max_digits=10, decimal_places=2)
    end_km = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='STARTED')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.driver} - {self.date} - {self.status}"

class DriverRoute(models.Model):
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE, related_name='routes')
    vehicle = models.ForeignKey(Vehicle, on_delete=models.SET_NULL, null=True, blank=True)
    date = models.DateField(default=datetime.date.today)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.driver} - {self.date}"

class RouteLog(models.Model):
    route = models.ForeignKey(DriverRoute, on_delete=models.CASCADE, related_name='logs')
    from_location = models.TextField()
    to_location = models.TextField()
    order_index = models.PositiveIntegerField(default=0)
    
    def __str__(self):
        return f"{self.from_location} -> {self.to_location}"

class RouteMaster(models.Model):
    route_name = models.CharField(max_length=255)
    start_point = models.CharField(max_length=255)
    end_point = models.CharField(max_length=255)
    start_lat = models.FloatField(null=True, blank=True)
    start_lng = models.FloatField(null=True, blank=True)
    end_lat = models.FloatField(null=True, blank=True)
    end_lng = models.FloatField(null=True, blank=True)
    stops = models.JSONField(default=list, blank=True)
    total_distance = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.route_name

class TripMaster(models.Model):
    trip_id = models.CharField(max_length=50, unique=True, blank=True)
    trip_date = models.DateField(default=datetime.date.today)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.SET_NULL, null=True, related_name='trips')
    driver = models.ForeignKey(Driver, on_delete=models.SET_NULL, null=True, related_name='trips')
    route = models.ForeignKey(RouteMaster, on_delete=models.SET_NULL, null=True, related_name='trips')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.trip_id:
            last_trip = TripMaster.objects.all().order_by('-id').first()
            if last_trip and last_trip.trip_id.startswith('TRP-'):
                try:
                    last_num = int(last_trip.trip_id.split('-')[1])
                    self.trip_id = f"TRP-{last_num + 1:04d}"
                except (ValueError, IndexError):
                    self.trip_id = "TRP-0001"
            else:
                self.trip_id = "TRP-0001"
        super(TripMaster, self).save(*args, **kwargs)

    def __str__(self):
        return self.trip_id

class PackageType(models.Model):
    pack_id = models.CharField(max_length=50, unique=True, blank=True)
    pack_name = models.CharField(max_length=255)
    length = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    width = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    height = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    weight = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    volume = models.DecimalField(max_digits=15, decimal_places=2, default=0, help_text="Calculated automatically")
    narration = models.TextField(null=True, blank=True)

    created_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, related_name='created_package_types')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Auto-calculate volume
        self.volume = self.length * self.width * self.height

        # Auto-generate pack_id
        if not self.pack_id:
            last_pack = PackageType.objects.all().order_by('-id').first()
            if last_pack and last_pack.pack_id.startswith('PKG-'):
                try:
                    last_num = int(last_pack.pack_id.split('-')[1])
                    self.pack_id = f"PKG-{last_num + 1:04d}"
                except (ValueError, IndexError):
                    self.pack_id = "PKG-0001"
            else:
                self.pack_id = "PKG-0001"
        super(PackageType, self).save(*args, **kwargs)

    def __str__(self):
        return f"{self.pack_id} - {self.pack_name}"

class ItemSpecification(models.Model):
    stock_item = models.ForeignKey('inventory_app.StockItem', on_delete=models.CASCADE, related_name='specifications')
    package_type = models.ForeignKey(PackageType, on_delete=models.CASCADE, related_name='item_specifications')
    items_per_case = models.IntegerField(default=1)
    volume_per_case = models.DecimalField(max_digits=15, decimal_places=4, default=0)
    case_weight = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    created_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, related_name='created_item_specifications')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.stock_item.name} - {self.package_type.pack_name}"

TYRE_TYPE_CHOICES = [
    ('front', 'Front Tyre'),
    ('rear', 'Rear Tyre'),
    ('both', 'Both'),
]

class TyreSize(models.Model):
    size = models.CharField(max_length=50)
    tyre_type = models.CharField(max_length=10, choices=TYRE_TYPE_CHOICES)
    created_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, related_name='created_tyre_sizes')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.size} ({self.get_tyre_type_display()})"
class RouteStopMaster(models.Model):
    stop_name = models.CharField(max_length=255, unique=True)
    distance_km = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    latitude = models.DecimalField(max_digits=11, decimal_places=8, null=True, blank=True)
    longitude = models.DecimalField(max_digits=11, decimal_places=8, null=True, blank=True)
    google_place_id = models.CharField(max_length=255, null=True, blank=True)
    formatted_address = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['stop_name']
        
    def __str__(self):
        return self.stop_name

class TripLoadedItem(models.Model):
    trip = models.ForeignKey(TripMaster, on_delete=models.CASCADE, related_name='loaded_items')
    sales_order = models.ForeignKey('sales_app.SalesOrder', on_delete=models.CASCADE, related_name='trip_loaded_items')
    sales_order_item = models.ForeignKey('sales_app.SalesOrderItem', on_delete=models.CASCADE, related_name='trip_loaded_items')
    loaded_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.sales_order.so_no} on {self.trip.trip_id} - {self.loaded_quantity}"
