import django.utils.timezone
from django.db import models
from django.utils import timezone

def get_current_date():
    return timezone.now().date()

def get_current_time():
    return timezone.now().time()

# Create your models here.

class Team(models.Model):
    team_name = models.CharField(max_length=200)
    team_leader = models.ForeignKey('rarenett_app.Employee', on_delete=models.CASCADE, related_name='led_teams')
    team_members = models.ManyToManyField('rarenett_app.Employee', related_name='teams')
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.team_name


class Project(models.Model):
    name = models.CharField(max_length=200)
    client_name = models.CharField(max_length=200, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    start_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)
    status_choices = [
        ('planning', 'Planning'),
        ('in_progress', 'In Progress'),
        ('on_hold', 'On Hold'),
        ('completed', 'Completed'),
    ]
    status = models.CharField(max_length=20, choices=status_choices, default='planning')
    created_by = models.ForeignKey('register_app.CustomUser', on_delete=models.SET_NULL, null=True, related_name='projects_created')
    project_manager = models.ForeignKey('rarenett_app.Employee', on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_projects')
    project_head = models.ForeignKey('rarenett_app.Employee', on_delete=models.SET_NULL, null=True, blank=True, related_name='headed_projects')
    progress = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)



class Module(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='modules')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    start_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)
    progress = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    status_choices = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
    ]
    status = models.CharField(max_length=20, choices=status_choices, default='pending')
    created_by = models.ForeignKey('register_app.CustomUser', on_delete=models.CASCADE, null=True, related_name='user_module')
    teams = models.ManyToManyField('Team', blank=True, related_name='modules')


class Task(models.Model):
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='tasks')
    parent_task = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='subtasks')
    team = models.ForeignKey('Team', on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    assigned_to = models.ForeignKey('rarenett_app.Employee', on_delete=models.SET_NULL, null=True, related_name='assigned_tasks')
    start_date = models.DateField()
    due_date = models.DateField()
    priority_choices = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]
    priority = models.CharField(max_length=10, choices=priority_choices, default='medium')
    status_choices = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('review', 'In Review'),
        ('completed', 'Completed'),
    ]
    status = models.CharField(max_length=20, choices=status_choices, default='pending')
    progress = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    remarks = models.TextField(blank=True, null=True)
    assigned_by = models.ForeignKey('rarenett_app.Employee', on_delete=models.SET_NULL, null=True, related_name='tasks_assigned')
    attachment = models.FileField(upload_to='task_attachments/', blank=True, null=True)

    previous_assigned_to = models.ForeignKey('rarenett_app.Employee', on_delete=models.SET_NULL,null=True, blank=True, related_name="previous_tasks")

    created_by = models.ForeignKey('register_app.CustomUser', on_delete=models.CASCADE, null=True, related_name='user_task')
    
    assigned_on = models.DateTimeField(default=timezone.now)
    effective_due = models.DateTimeField(null=True, blank=True)
    is_split_approved = models.BooleanField(default=True)
    approval_type = models.CharField(max_length=20, blank=True, null=True, choices=[('split', 'Split'), ('reassign', 'Reassign')])

class MarketingTravel(models.Model):
    employee = models.ForeignKey('rarenett_app.Employee', on_delete=models.CASCADE, related_name='marketing_travels')
    date = models.DateField(default=get_current_date)
    mode = models.CharField(max_length=50, choices=[
        ('Bike', 'Bike'),
        ('Car', 'Car'),
        ('Bus', 'Bus'),
        ('Train', 'Train'),
        ('Flight', 'Flight')
    ])
    start_km = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    end_km = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    total_km = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    odometer_photo = models.ImageField(upload_to='marketing/travel/odometer/', blank=True, null=True)
    ticket_file = models.FileField(upload_to='marketing/travel/tickets/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.start_km is not None and self.end_km is not None:
            self.total_km = self.end_km - self.start_km
        super().save(*args, **kwargs)

class MarketingLead(models.Model):
    lead_id = models.CharField(max_length=20, unique=True, blank=True, null=True)
    employee = models.ForeignKey('rarenett_app.Employee', on_delete=models.CASCADE, related_name='marketing_leads')
    lead_date = models.DateField(default=get_current_date)
    shop_name = models.CharField(max_length=200)
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    mobile_number = models.CharField(max_length=20, blank=True, null=True)
    gst_number = models.CharField(max_length=50, blank=True, null=True)
    shop_type = models.CharField(max_length=150)
    status = models.CharField(max_length=50, choices=[('Active', 'Active'), ('Working on Deal', 'Working on Deal'), ('Escalated', 'Escalated')], default='Active')
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    location = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new and not self.lead_id:
            self.lead_id = f"LD-{self.id:04d}"
            MarketingLead.objects.filter(id=self.id).update(lead_id=self.lead_id)

class MarketingShopVisit(models.Model):
    employee = models.ForeignKey('rarenett_app.Employee', on_delete=models.CASCADE, related_name='marketing_shop_visits')
    shop_name = models.CharField(max_length=200)
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    mobile_number = models.CharField(max_length=20, blank=True, null=True)
    gst_number = models.CharField(max_length=50, blank=True, null=True)
    shop_type = models.CharField(max_length=150)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    visit_date = models.DateField(default=get_current_date)
    visit_time = models.TimeField(default=get_current_time)
    created_at = models.DateTimeField(auto_now_add=True)

class MarketingShopPhoto(models.Model):
    visit = models.ForeignKey(MarketingShopVisit, on_delete=models.CASCADE, related_name='photos')
    photo = models.ImageField(upload_to='marketing/shop_visits/')

class MarketingWishlist(models.Model):
    employee = models.ForeignKey('rarenett_app.Employee', on_delete=models.CASCADE)
    customer_ledger = models.ForeignKey('finance_app.Ledger', on_delete=models.CASCADE, null=True, blank=True) # Assuming Ledger is customer
    stock_item = models.ForeignKey('inventory_app.StockItem', on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    negotiated_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_new_customer = models.BooleanField(default=False)
    new_customer_name = models.CharField(max_length=255, null=True, blank=True)
    new_customer_phone = models.CharField(max_length=20, null=True, blank=True)
    
    STATUS_CHOICES = (
        ('Pending', 'Pending'),
        ('Accepted', 'Accepted'),
        ('Rejected', 'Rejected'),
    )
    approval_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    created_at = models.DateTimeField(auto_now_add=True)



class MarketingTravelPhoto(models.Model):
    travel = models.ForeignKey(MarketingTravel, on_delete=models.CASCADE, related_name='photos')
    photo = models.ImageField(upload_to='marketing/travel/photos/')
    uploaded_at = models.DateTimeField(auto_now_add=True)


class MarketingOrder(models.Model):
    order_no = models.CharField(max_length=50, unique=True, blank=True, null=True)
    employee = models.ForeignKey('rarenett_app.Employee', on_delete=models.CASCADE, related_name='marketing_orders', null=True, blank=True)
    customer_ledger = models.ForeignKey('finance_app.Ledger', on_delete=models.CASCADE, null=True, blank=True)
    new_customer_name = models.CharField(max_length=255, null=True, blank=True)
    entry_date = models.DateField(default=get_current_date)
    narration = models.TextField(blank=True, null=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Adding fields similar to SalesOrder
    delivery_location = models.CharField(max_length=255, null=True, blank=True)
    vehicle_type = models.CharField(max_length=100, null=True, blank=True)
    terms_of_delivery = models.CharField(max_length=255, null=True, blank=True)

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new and not self.order_no:
            self.order_no = f"MKO-{self.id:04d}"
            MarketingOrder.objects.filter(id=self.id).update(order_no=self.order_no)

class MarketingOrderItem(models.Model):
    marketing_order = models.ForeignKey(MarketingOrder, on_delete=models.CASCADE, related_name='items')
    stock_item = models.ForeignKey('inventory_app.StockItem', on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)


class EmployeeFaceProfile(models.Model):
    employee = models.OneToOneField('rarenett_app.Employee', on_delete=models.CASCADE, related_name='face_profile')
    face_descriptor = models.JSONField(help_text="128-d float array from face-api.js")
    enrolled_image = models.ImageField(upload_to='marketing/attendance/enrolled_faces/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class MarketingAttendance(models.Model):
    employee = models.ForeignKey('rarenett_app.Employee', on_delete=models.CASCADE, related_name='marketing_attendances')
    attendance_date = models.DateField(default=get_current_date)
    attendance_time = models.TimeField(default=django.utils.timezone.now)
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    location_accuracy = models.FloatField(null=True, blank=True)
    selfie_image = models.ImageField(upload_to='marketing/attendance/selfies/', blank=True, null=True)
    face_verification_status = models.CharField(max_length=50, default='PENDING')
    face_match_score = models.FloatField(null=True, blank=True)
    status = models.CharField(max_length=50, default='ACTIVE')  # changed default to ACTIVE
    session_type = models.CharField(max_length=50, default='FIRST_SIGN_IN')
    sign_out_time = models.TimeField(null=True, blank=True)
    sign_out_latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    sign_out_longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    offline_attendance_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
