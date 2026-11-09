from inventory_app.models import StockItem, StockCategory, Unit
# django settings, etc.
from django.db import models
from logistics_app.models import Vehicle
from finance_app.models import Ledger
from rarenett_app.models import Department, Employee

class lifespan(models.Model):
    lifespan_type = models.CharField(max_length=20)

    class Meta:
        verbose_name = "Lifespan"
        verbose_name_plural = "Lifespans"
        ordering = ['lifespan_type']
        

    def __str__(self):
        return self.lifespan_type


class SparePart(models.Model):
    name = models.ForeignKey(StockItem, on_delete=models.CASCADE, related_name='spare_parts', null=True, blank=True)
    code = models.CharField(max_length=100, unique=True)
    brand = models.ForeignKey(StockCategory, on_delete=models.SET_NULL, blank=True, null=True, related_name='spare_part_brands')
    machine_name = models.ForeignKey(StockItem, on_delete=models.CASCADE, related_name='spare_parts_as_machine', null=True, blank=True)
    rate = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    
    # Conditional lifespan values
    lifespan_type = models.ForeignKey(lifespan, on_delete=models.CASCADE, null=True, blank=True)
    priority = models.CharField(max_length=50, blank=True, null=True)
    supplier = models.ForeignKey(Ledger, on_delete=models.SET_NULL, null=True, blank=True, related_name='spare_parts_as_supplier')

    class Meta:
        verbose_name = "Spare Part"
        verbose_name_plural = "Spare Parts"
        ordering = ['name__name']
        

    def __str__(self):
        return f"{self.name} ({self.code})"


class SparePartImage(models.Model):
    spare_part = models.ForeignKey(
        SparePart, 
        on_delete=models.CASCADE, 
        related_name='images'
    )
    image = models.ImageField(upload_to='spare_part_images/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Spare Part Image"
        verbose_name_plural = "Spare Part Images"
        

    def __str__(self):
        return f"Image for {self.spare_part.name} ({self.id})"
#Type Name
class TypeName(models.Model):
    typename = models.CharField(max_length=50)

    class Meta:
        verbose_name = "Type Name"
        verbose_name_plural = "Types Name"
        ordering = ['typename']

    def __str__(self):
        return self.typename

#Category name and typename (foreignkey from typename table)
class CategoryName(models.Model) :

    categoryname = models.CharField(max_length=50)
    typename = models.ForeignKey(TypeName, on_delete=models.CASCADE)

    class Meta:
        verbose_name = "Category Name"
        verbose_name_plural = "Categories Name"
        ordering = ['categoryname']
    
    def __str__(self):
        return f"{self.categoryname} ({self.typename})"
#subcategory name and categoryname(foreignkey from CategoryName)        
class SubCategoryName(models.Model):
    subcategoryname = models.CharField(max_length=50)
    categoryname = models.ForeignKey(CategoryName, on_delete=models.CASCADE)

    class Meta:
        verbose_name = "Sub Category Name"
        verbose_name_plural = "Sub Categories Name"
        ordering = ['subcategoryname']
    
    def __str__(self):
        return f"{self.subcategoryname} ({self.categoryname})"  

#Process independent noconnection

class ProcessName(models.Model):
    processname = models.CharField(max_length=50)

    class Meta:
        verbose_name = "Process Name"
        verbose_name_plural = "Process Names"
        ordering = ['processname']
    def __str__(self):
        return self.processname

class MachineDataCollection(models.Model):
    machine_name = models.ForeignKey(StockItem, on_delete=models.CASCADE, related_name='machine_data_collections')
    code = models.CharField(max_length=100, unique=True)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='machine_data_collections') 
    process = models.ForeignKey(ProcessName, on_delete=models.CASCADE, related_name='machine_data_collections')
    supplier = models.ForeignKey(Ledger, on_delete=models.CASCADE, related_name='machine_data_collections')
    purchase_date = models.DateField()
    hp = models.CharField(max_length=100)
    steam = models.CharField(max_length=100)
    pressure = models.CharField(max_length=100)
    chilled_water = models.CharField(max_length=100)
    no_of_operators = models.CharField(max_length=100)
    no_of_helpers = models.CharField(max_length=100)
    service_contact = models.CharField(max_length=50, blank=True, null=True, default='')
    last_maintenance_date = models.DateField()
    next_maintenance_date = models.DateField()
    service_frequency_days = models.IntegerField()
    service_frequency_hours = models.IntegerField()
  
    #machine status tick box active or not
    machine_status = models.BooleanField(default=True)
    class Meta:
        verbose_name = "Machine Data Collection"
        verbose_name_plural = "Machine Data Collections"
        ordering = ['machine_name__name']
    def __str__(self):
        return f"{self.machine_name} ({self.code})"
    


class RepairRequest(models.Model):
    part = models.ForeignKey(StockItem, on_delete=models.CASCADE, related_name='repair_requests')
    duedate = models.DateField()
    entry_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)
    priority = models.CharField(
        max_length=20,
        choices=[('High', 'High'), ('Medium', 'Medium'), ('Low', 'Low')],
        default='Medium'
    )
    status = models.CharField(
        max_length=20,
        choices=[('Pending', 'Pending'), ('Hold', 'Hold'), ('Accepted', 'Accepted'), ('Rejected', 'Rejected')],
        default='Pending'
    )
    created_by = models.ForeignKey(
        'register_app.CustomUser', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_repair_requests'
    )
    decision = models.CharField(
        max_length=20,
        choices=[('YES', 'YES'), ('NO', 'NO'), ('NEUTRAL', 'NEUTRAL')],
        blank=True,
        null=True
    )
    positive_feedback = models.TextField(blank=True, null=True)
    negative_feedback = models.TextField(blank=True, null=True)
    decision_notes = models.TextField(blank=True, null=True)
    supporting_document = models.FileField(upload_to='repair_request_docs/', blank=True, null=True)

    class Meta:
        verbose_name = "Repair Request"
        verbose_name_plural = "Repair Requests"
        ordering = ['part__name']

    def __str__(self):
        return f"Repair Request #{self.id}"

    def save(self, *args, **kwargs):
        if not self.entry_date:
            import datetime
            self.entry_date = datetime.date.today()
            
        # Look for any RepairPart for this machine (part)
        repair_part = RepairPart.objects.filter(machine=self.part).first()
        if repair_part and repair_part.cutoff_days is not None:
            import datetime
            self.duedate = self.entry_date + datetime.timedelta(days=repair_part.cutoff_days)
        elif not self.duedate:
            self.duedate = self.entry_date

        super().save(*args, **kwargs)

class RepairRequestImage(models.Model):
    repairrequest = models.ForeignKey(RepairRequest, on_delete=models.CASCADE, related_name='repair_request_images')
    image = models.ImageField(upload_to='repair_request_images/')

    class Meta:
        verbose_name = "Repair Request Image"
        verbose_name_plural = "Repair Request Images"

    def __str__(self):
        return f"Image for Repair Request {self.repairrequest.id}"

class MachineProductMapping(models.Model):
    machine = models.ForeignKey(StockItem, on_delete=models.CASCADE, related_name='mapped_products')
    product = models.ForeignKey(StockItem, on_delete=models.CASCADE, related_name='mapped_machines')

    class Meta:
        verbose_name = "Machine Product Mapping"
        verbose_name_plural = "Machine Product Mappings"
        ordering = ['machine__name']

    def __str__(self):
        return f"Machine {self.machine.name} - Product {self.product.name}"
class MachineOutput(models.Model):
    machine = models.ForeignKey(MachineProductMapping, on_delete=models.CASCADE, related_name='machine_outputs')
    product = models.ForeignKey(MachineProductMapping, on_delete=models.CASCADE, related_name='product_outputs')
    productunit = models.ForeignKey(StockItem, on_delete=models.CASCADE, related_name='product_outputs_unit')
    output = models.IntegerField()
    outputunit =  models.ForeignKey(Unit, on_delete=models.CASCADE, related_name='product_outputs_unit')

    class Meta:
        verbose_name = "Machine Output"
        verbose_name_plural = "Machine Outputs"

    def __str__(self):
        return f"Machine {self.machine.machine.name} - Product {self.product.product.name} ({self.output} {self.outputunit})"
    
class MachineDataCollectionConfiguration(models.Model):
    stock_item = models.OneToOneField(StockItem, on_delete=models.CASCADE, null=True, blank=True, related_name='machine_configuration')
    settings = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return "Machine Data Collection Configuration"


class RepairPart(models.Model):
    PATTERN_CHOICES = [
        ('Single', 'Single'),
        ('Multiple', 'Multiple'),
        ('HOD', 'HOD'),
        ('BOD', 'BOD'),
        ('Assign', 'Assign'),
    ]

    machine = models.ForeignKey(
        StockItem, on_delete=models.CASCADE, blank=True, null=True, related_name='repair_parts_machine'
    )
    typename = models.ForeignKey(
        TypeName, on_delete=models.CASCADE, blank=True, null=True, related_name='repair_parts_typename'
    )
    vehicle = models.ForeignKey(
        'logistics_app.Vehicle', on_delete=models.CASCADE, blank=True, null=True, related_name='repair_parts_vehicle'
    )
    category = models.ForeignKey(CategoryName, on_delete=models.CASCADE, related_name='repair_parts')
    subcategory = models.ForeignKey(SubCategoryName, on_delete=models.CASCADE, related_name='repair_parts')
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='repair_parts', blank=True, null=True)
    part_name = models.CharField(max_length=255, blank=True, null=True)
    part_code = models.CharField(max_length=100)
    narration = models.TextField(blank=True, null=True)
    
    pattern_type = models.CharField(max_length=20, choices=PATTERN_CHOICES, blank=True, null=True)
    cutoff_days = models.IntegerField(default=0, blank=True, null=True)
    targeted_departments = models.ManyToManyField(Department, related_name='targeted_repair_parts', blank=True)
    employees = models.ManyToManyField(Employee, related_name='assigned_repair_parts', blank=True)
    decision_maker_pattern_type = models.CharField(max_length=20, choices=PATTERN_CHOICES, blank=True, null=True)
    decision_maker_departments = models.ManyToManyField(Department, related_name='decision_maker_repair_parts_depts', blank=True)
    decision_maker = models.ForeignKey('register_app.CustomUser', on_delete=models.SET_NULL, null=True, blank=True, related_name='decision_maker_repair_parts')

    class Meta:
        verbose_name = "Repair Part"
        verbose_name_plural = "Repair Parts"
        ordering = ['part_name']

    def __str__(self):
        return f"{self.part_name} ({self.part_code})"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.machine and self.cutoff_days is not None:
            import datetime
            requests = RepairRequest.objects.filter(part=self.machine)
            for req in requests:
                base_date = req.entry_date if req.entry_date else datetime.date.today()
                req.duedate = base_date + datetime.timedelta(days=self.cutoff_days)
                req.save()


class RepairRequestFeedback(models.Model):
    repair_request = models.ForeignKey(RepairRequest, on_delete=models.CASCADE, related_name='feedbacks')
    user = models.ForeignKey('register_app.CustomUser', on_delete=models.CASCADE, related_name='repair_feedbacks')
    decision = models.CharField(max_length=20, choices=[('YES', 'YES'), ('NO', 'NO'), ('NEUTRAL', 'NEUTRAL')])
    positive_feedback = models.TextField(blank=True, null=True)
    negative_feedback = models.TextField(blank=True, null=True)
    decision_notes = models.TextField(blank=True, null=True)
    supporting_document = models.FileField(upload_to='repair_request_docs/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Repair Request Feedback"
        verbose_name_plural = "Repair Request Feedbacks"
        unique_together = ('repair_request', 'user')

    def __str__(self):
        return f"Feedback for Repair Request #{self.repair_request.id} by {self.user.username}"

