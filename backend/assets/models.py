from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.conf import settings 
# No imports from rarenett_app needed

class StorageRoom(models.Model):
    name = models.CharField(max_length=100)
    location_description = models.TextField(blank=True, null=True)
    total_capacity = models.CharField(max_length=100, help_text="Total storage capacity (e.g. '500 sq.ft' or '10 cubic ft')", null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_rooms'
    )
    company = models.ForeignKey('settings_app.Company', on_delete=models.CASCADE, null=True, blank=True, related_name='storage_rooms')
    branch = models.ForeignKey('settings_app.Branch', on_delete=models.CASCADE, null=True, blank=True, related_name='storage_rooms')
    department = models.ForeignKey('rarenett_app.Department', on_delete=models.SET_NULL, null=True, blank=True, related_name='storage_rooms')

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name}"



class Shelf(models.Model):
    room = models.ForeignKey(StorageRoom, on_delete=models.CASCADE, related_name='shelves')
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_shelves')

    class Meta:
        ordering = ['name']
        verbose_name_plural = "Shelves"

    def __str__(self):
        return f"{self.name} ({self.room.name})"


class Rack(models.Model):
    shelf = models.ForeignKey(Shelf, on_delete=models.CASCADE, related_name='racks')
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    custodian = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='rack_custodians')
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_racks')

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.shelf.name})"


class AssetType(models.Model):
    name = models.CharField(max_length=100, unique=True, null=True, blank=True)
    description = models.TextField(blank=True, null=True)
    code_prefix = models.CharField(
        max_length=10,
        null=True, blank=True,
        help_text="Prefix for asset codes (IT, VEH, INF etc.)"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_asset_types')

    def __str__(self):
        return str(self.name)


class AssetCategory(models.Model):
    asset_type = models.ForeignKey(
        AssetType,
        on_delete=models.CASCADE,
        related_name='categories',
        null=True, blank=True
    )
    name = models.CharField(max_length=100, unique=True, null=True, blank=True)
    description = models.TextField(blank=True, null=True)
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children'
    )
    default_incharge = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='category_default_incharge'
    )
    is_repairable = models.BooleanField(default=False)
    is_maintainable = models.BooleanField(default=False)
    is_allocatable = models.BooleanField(default=True)
    is_location_asset = models.BooleanField(default=False)
    is_renewable = models.BooleanField(
        default=False,
        help_text="Assets that require periodic renewal (licenses, insurance, subscriptions)"
    )
    is_active = models.BooleanField(default=True)
    code_prefix = models.CharField(
        max_length=10,
        null=True, blank=True,
        help_text="Prefix used when generating asset codes"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return str(self.name)


class Asset(models.Model):
    STATUS_CHOICES = [
        ('available', 'Available'),
        ('allocated', 'Allocated'),
        ('maintenance', 'Under Maintenance'),
        ('repair', 'Under Repair'),
        ('retired', 'Retired'),
        ('disposed', 'Disposed'),
        ('lost', 'Lost'),
    ]

    CONDITION_CHOICES = [
        ('new', 'New'),
        ('good', 'Good'),
        ('fair', 'Fair'),
        ('damaged', 'Damaged'),
        ('scrap', 'Scrap'),
    ]

    asset_code = models.CharField(
        max_length=100,
        unique=True,
        null=True, blank=True
    )

    name = models.CharField(
        max_length=255,
        null=True, blank=True
    )

    category = models.ForeignKey(
        AssetCategory,
        on_delete=models.SET_NULL, # changed from PROTECT to allow null
        related_name='assets',
        null=True, blank=True
    )

    department = models.ForeignKey(
        'rarenett_app.Department',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    incharge = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assets_incharge'
    )

    renewal_date = models.DateField(
        null=True,
        blank=True,
        help_text="Next renewal date"
    )

    renewal_cycle_days = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Renewal cycle in days (e.g., 365 for yearly renewal)"
    )

    renewal_reminder_days = models.PositiveIntegerField(
        default=30,
        null=True, blank=True,
        help_text="Days before renewal to send reminder"
    )
    # Identification
    serial_number = models.CharField(
        max_length=255,
        null=True,
        blank=True
    )

    tag_number = models.CharField(
        max_length=100,
        null=True,
        blank=True
    )

    # Purchase information
    purchase_date = models.DateField(
        null=True,
        blank=True
    )

    purchase_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )

    purchase_narration = models.TextField(
        null=True,
        blank=True
    )

    # Warranty / lifecycle
    warranty_start_date = models.DateField(
        null=True,
        blank=True
    )

    warranty_end_date = models.DateField(
        null=True,
        blank=True
    )

    expiry_date = models.DateField(
        null=True,
        blank=True
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='available',
        null=True, blank=True
    )

    condition = models.CharField(
        max_length=20,
        choices=CONDITION_CHOICES,
        default='good',
        null=True, blank=True
    )

    description = models.TextField(
        blank=True,
        null=True
    )

    depreciation_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.0,
        null=True, blank=True
    )

    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_assets'
    )

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    def __str__(self):
        return f"{self.asset_code} - {self.name}"

    def save(self, *args, **kwargs):
        if not self.asset_code:
            prefix = "AST"
            if self.category and self.category.code_prefix:
                prefix = self.category.code_prefix
            
            # Generate code: PREFIX-YYYY-MM-XXXX
            now = timezone.now()
            year_month = now.strftime("%Y%m")
            
            last_asset = Asset.objects.filter(asset_code__startswith=f"{prefix}-{year_month}").order_by('-asset_code').first()
            
            if last_asset and last_asset.asset_code:
                try:
                    last_num = int(last_asset.asset_code.split('-')[-1])
                    new_num = last_num + 1
                except (ValueError, IndexError):
                    new_num = 1
            else:
                new_num = 1
                
            self.asset_code = f"{prefix}-{year_month}-{str(new_num).zfill(4)}"
            
        super(Asset, self).save(*args, **kwargs)


class AssetAttributeDefinition(models.Model):
    FIELD_TYPES = [
        ('text', 'Text'),
        ('number', 'Number'),
        ('date', 'Date'),
        ('boolean', 'Boolean'),
        ('file', 'File'),
    ]

    category = models.ForeignKey(
        AssetCategory,
        on_delete=models.CASCADE,
        related_name='attribute_definitions',
        null=True, blank=True
    )

    name = models.CharField(
        max_length=100,
        null=True, blank=True
    )

    field_type = models.CharField(
        max_length=20,
        choices=FIELD_TYPES,
        null=True, blank=True
    )

    is_required = models.BooleanField(default=False)

    display_order = models.PositiveIntegerField(default=0, null=True, blank=True)

    help_text = models.CharField(
        max_length=255,
        null=True,
        blank=True
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        ordering = ['display_order']

    def __str__(self):
        category_name = self.category.name if self.category else "Uncategorized"
        return f"{category_name} - {self.name}"


class AssetAttributeValue(models.Model):
    asset = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE,
        related_name='attribute_values',
        null=True, blank=True
    )

    attribute = models.ForeignKey(
        AssetAttributeDefinition,
        on_delete=models.CASCADE,
        null=True, blank=True
    )

    value_text = models.TextField(
        null=True,
        blank=True
    )

    value_number = models.FloatField(
        null=True,
        blank=True
    )

    value_date = models.DateField(
        null=True,
        blank=True
    )

    value_boolean = models.BooleanField(
        null=True,
        blank=True
    )

    value_file = models.FileField(
        upload_to="asset_attribute_files/",
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        unique_together = ('asset', 'attribute')

    def __str__(self):
        asset_code = self.asset.asset_code if self.asset else "Unknown Asset"
        attr_name = self.attribute.name if self.attribute else "Unknown Attribute"
        return f"{asset_code} - {attr_name}"


class AssetAllocation(models.Model):
    allocated_to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    allocated_to_department = models.ForeignKey(
        'rarenett_app.Department',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    allocated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='asset_allocated_by'
    )

    allocated_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    due_date = models.DateTimeField(null=True, blank=True)

    returned_at = models.DateTimeField(null=True, blank=True)

    purpose = models.CharField(max_length=255, null=True, blank=True)

    remarks = models.TextField(null=True, blank=True)

    status = models.CharField(
        max_length=20,
        default='Allocated',
        null=True, blank=True
    )


class AssetAllocationItem(models.Model):
    allocation = models.ForeignKey(
        AssetAllocation,
        on_delete=models.CASCADE,
        related_name='items',
        null=True, blank=True
    )

    asset = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE,
        null=True, blank=True
    )

    condition_when_allocated = models.CharField(max_length=50, null=True, blank=True)

    condition_when_returned = models.CharField(max_length=50, null=True, blank=True)

    returned_at = models.DateTimeField(null=True, blank=True)


class AssetDocument(models.Model):
    DOCUMENT_TYPES = [
        ('invoice', 'Invoice'),
        ('warranty', 'Warranty'),
        ('manual', 'Manual'),
        ('repair', 'Repair bill'),
    ]

    asset = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE,
        related_name='documents',
        null=True, blank=True
    )

    document_name = models.CharField(max_length=255, null=True, blank=True)

    file = models.FileField(upload_to="asset_documents/", null=True, blank=True)

    uploaded_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)


class AssetTransfer(models.Model):
    asset = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE,
        related_name='transfers',
        null=True, blank=True
    )

    from_department = models.ForeignKey(
        'rarenett_app.Department',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='transfer_from'
    )

    to_department = models.ForeignKey(
        'rarenett_app.Department',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='transfer_to'
    )

    transferred_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True
    )

    transfer_date = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    remarks = models.TextField(null=True, blank=True)


class AssetMaintenance(models.Model):
    asset = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE,
        related_name='maintenances',
        null=True, blank=True
    )

    maintenance_type = models.CharField(max_length=100, null=True, blank=True)

    scheduled_date = models.DateField(null=True, blank=True)

    completed_date = models.DateField(null=True, blank=True)

    technician = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True
    )

    cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )

    remarks = models.TextField(null=True, blank=True)


class File(models.Model):
    PRIORITY_CHOICES = [
        ('Low', 'Low'),
        ('Medium', 'Medium'),
        ('High', 'High'),
        ('Critical', 'Critical'),
    ]
    file_type = models.ForeignKey(AssetType, on_delete=models.SET_NULL, related_name='files', null=True, blank=True)
    file_name = models.CharField(max_length=255)
    department = models.ForeignKey('rarenett_app.Department', on_delete=models.SET_NULL, null=True, blank=True, related_name='files')
    rack = models.ForeignKey(Rack, on_delete=models.SET_NULL, null=True, blank=True, related_name='files')
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='owned_files')
    current_holder = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='held_files')
    status = models.CharField(max_length=50, default='Available')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='Low')
    holder_response = models.CharField(max_length=50, default='Pending')
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_files')

    def __str__(self):
        return f"{self.file_name}"


class FileAllocation(models.Model):
    file = models.ForeignKey(File, on_delete=models.CASCADE, related_name='allocations')
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='file_allocations')
    allocated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='made_file_allocations')
    allocated_at = models.DateTimeField(auto_now_add=True)
    due_date = models.DateTimeField()
    returned_at = models.DateTimeField(null=True, blank=True)
    return_remarks = models.TextField(blank=True, null=True)
    holder_response = models.CharField(max_length=20, default='Pending')
    remarks = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, default='Allocated')
    is_active = models.BooleanField(default=True)
    allow_reallocation = models.BooleanField(default=True)
    reallocated_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='received_file_reallocations'
    )

    class Meta:
        ordering = ['-allocated_at']

    def __str__(self):
        return f"{self.file.file_name} -> {self.assigned_to.email}"

class Key(models.Model):
    STATUS_CHOICES = (
        ('Available', 'Available'),
        ('In Use', 'In Use'),
    )
    
    HOLDER_RESPONSE_CHOICES = (
        ('No Holder', 'No Holder'),
        ('Pending', 'Pending'),
        ('Accepted', 'Accepted'),
        ('Rejected', 'Rejected'),
    )

    asset_type = models.ForeignKey(AssetType, on_delete=models.PROTECT, related_name='keys', null=True, blank=True)
    key_name = models.CharField(max_length=255)
    department = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    rack = models.ForeignKey(Rack, on_delete=models.SET_NULL, null=True, blank=True, related_name='keys')
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='owned_keys')
    current_holder = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='held_keys')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Available')
    holder_response = models.CharField(max_length=20, choices=HOLDER_RESPONSE_CHOICES, default='No Holder', null=True)
    return_status = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_keys')

    def __str__(self):
        return f"{self.key_name} ({self.asset_type.name if self.asset_type else 'No Type'})"


class KeyAllocation(models.Model):
    HOLDER_RESPONSE_CHOICES = (
        ('Pending', 'Pending'),
        ('Accepted', 'Accepted'),
        ('Rejected', 'Rejected'),
    )

    key = models.ForeignKey(Key, on_delete=models.CASCADE, related_name='allocations')
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='key_assigned_to')
    allocated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='key_allocations_made')
    allocated_at = models.DateTimeField(auto_now_add=True)
    due_date = models.DateTimeField(null=True, blank=True)
    returned_at = models.DateTimeField(null=True, blank=True)
    return_remarks = models.TextField(null=True, blank=True)
    remarks = models.TextField(blank=True)
    status = models.CharField(max_length=20, default='Allocated')
    holder_response = models.CharField(max_length=20, choices=HOLDER_RESPONSE_CHOICES, default='Pending', null=True)
    return_status = models.BooleanField(default=False)
    allow_reallocation = models.BooleanField(default=True)
    reallocated_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='received_key_reallocations'
    )
    
    def is_returned(self):
        return self.returned_at is not None
 
    class Meta:
        ordering = ['-allocated_at']

    def __str__(self):
        return f"{self.key.key_name} -> {self.assigned_to.email if self.assigned_to else 'N/A'}"