from django.db import models
from django.urls import reverse
from register_app.models import CustomUser
from rarenett_app.models import Department

# ─────────────────────────────────────────────
# GATE
# ─────────────────────────────────────────────

class Gate(models.Model):
    name = models.CharField(max_length=255, null=True, blank=True)
    gate_no = models.CharField(max_length=50, null=True, unique=True)
    location = models.CharField(max_length=255, null=True, blank=True)
    date = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, null=True, blank=True, related_name='created_gate'
    )

    def get_absolute_url(self):
        return reverse('gate_list')

    def __str__(self):
        return f"{self.name or self.gate_no}"


# ─────────────────────────────────────────────
# CATEGORY & SUBCATEGORY
# ─────────────────────────────────────────────

class GateCategory(models.Model):
    """
    Visitor category (e.g. Vendor, Client, Industrial Visit, Contractor).
    colour_code is used to drive color-coded badge/tag printout on the UI.
    """
    category_no = models.CharField(max_length=255, null=True, blank=True)
    name = models.CharField(max_length=255, null=True, unique=True)
    narration = models.TextField(null=True, blank=True)
    colour_code = models.CharField(max_length=20, null=True, blank=True)  # e.g. #FF5733
    date = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, null=True, blank=True, related_name='created_gate_category'
    )

    def get_absolute_url(self):
        return reverse('gate_category_list')

    def __str__(self):
        return f"{self.name}"


class GateSubCategory(models.Model):
    category = models.ForeignKey(
        GateCategory, null=True, on_delete=models.CASCADE, related_name='subcategories'
    )
    subcategory_no = models.CharField(max_length=255, null=True, blank=True)
    name = models.CharField(max_length=255, null=True)
    date = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, null=True, blank=True, related_name='created_gate_subcat'
    )

    def get_absolute_url(self):
        return reverse('gate_subcategory_list')

    def __str__(self):
        return f"{self.name}"


# ─────────────────────────────────────────────
# TAG MANAGEMENT (simplified)
# ─────────────────────────────────────────────

class EntryTag(models.Model):
    """
    Represents a batch/book of physical tags issued to the gate.
    e.g. "Visitor Tags - Book 3 (sl 201–300)"
    """
    tag_code = models.CharField(max_length=255, null=True, blank=True)
    category = models.ForeignKey(
        GateCategory, on_delete=models.CASCADE, null=True, related_name='entry_tags'
    )
    subcategory = models.ForeignKey(
        GateSubCategory, on_delete=models.CASCADE, null=True, blank=True,
        related_name='entry_tags'
    )
    tag_type = models.CharField(max_length=255, null=True)       # e.g. "Visitor", "Contractor"
    sl_no_from = models.PositiveIntegerField(null=True, blank=True)
    sl_no_to = models.PositiveIntegerField(null=True, blank=True)
    tag_image = models.ImageField(upload_to='tag_images/', null=True, blank=True)
    date = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, null=True, blank=True, related_name='created_entrytag'
    )

    def get_absolute_url(self):
        return reverse('entry_tag_list')

    def __str__(self):
        return f"{self.tag_type} ({self.sl_no_from}–{self.sl_no_to})"


class GeneratedTag(models.Model):
    """
    Individual physical tag. Created in bulk from EntryTag.
    Tracks whether the tag is available, in use, or lost.
    """
    STATUS_CHOICES = [
        ('Available', 'Available'),
        ('Unavailable', 'Unavailable'),
        ('Lost', 'Lost'),
    ]
    entry_tag = models.ForeignKey(
        EntryTag, on_delete=models.CASCADE, related_name='generated_tags'
    )
    tag_number = models.CharField(max_length=255, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Available')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('entry_tag', 'tag_number')
        ordering = ['tag_number']

    def get_absolute_url(self):
        return reverse('generated_tags_list')

    def __str__(self):
        return f"{self.entry_tag.tag_type}-{self.tag_number} ({self.status})"

# ─────────────────────────────────────────────
# VISITOR
# ─────────────────────────────────────────────

class Visitor(models.Model):
    """
    A Visitor is a person record — reusable across multiple visits.
    Category/subcategory have been REMOVED from here because they are
    visit-level concepts, not visitor-level. They now live on GateEntry.

    Search by mobile_no to find returning visitors quickly.
    """
    visitor_name = models.CharField(max_length=255, null=True)
    mobile_no = models.CharField(max_length=20, null=True, db_index=True)   # primary search key
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='department_visitors')
    email = models.EmailField(null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    company_name = models.CharField(max_length=255, null=True, blank=True)  # replaces represented_for
    visitor_photo = models.ImageField(upload_to='visitor_photo/', null=True, blank=True)
    id_card_photo = models.ImageField(upload_to='id_photo/', null=True, blank=True)
    visiting_card_photo = models.ImageField(upload_to='visiting_card/', null=True, blank=True)
    narration = models.TextField(null=True, blank=True)

    # Security control
    is_blacklisted = models.BooleanField(default=False)
    blacklist_reason = models.TextField(null=True, blank=True)

    date = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, null=True, blank=True, related_name='created_visitor'
    )

    def get_absolute_url(self):
        return reverse('visitor_list')

    def __str__(self):
        return f"{self.visitor_name} ({self.mobile_no})"

# ─────────────────────────────────────────────
# GATE ENTRY
# ─────────────────────────────────────────────

class GateEntry(models.Model):
    entry_gate = models.ForeignKey(
        Gate, on_delete=models.CASCADE, null=True, blank=True, related_name='gates_entry'
    )
    visitor = models.ForeignKey(
        Visitor, on_delete=models.CASCADE, related_name="gate_entries"
    )
    entry_tag = models.ForeignKey(
        EntryTag, on_delete=models.SET_NULL, null=True, blank=True
    )
    generated_tag = models.ForeignKey(
        GeneratedTag, on_delete=models.SET_NULL, null=True, blank=True
    )
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, null=True, blank=True
    )
    employee = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='employee_visits'
    )
    appointment = models.OneToOneField(
        'appointment_app.Appointment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='gate_entry'
    )
    
    purpose_of_visit = models.TextField(null=True, blank=True)
    entry_time = models.DateTimeField(auto_now_add=True)
    narration = models.TextField(null=True, blank=True)

    verification_status = models.CharField(
        max_length=20,
        choices=[
            ("pending", "Pending"),
            ("verified", "Verified"),
            ("reassigned", "Reassigned"),
            ("completed", "Completed"),
        ],
        default="pending",
    )
    is_permission_required = models.BooleanField(default=False)
    number_of_persons = models.IntegerField(default=1)
    persons_inside = models.IntegerField(null=True, blank=True)
    partial_exit_logs = models.JSONField(default=list, blank=True)
    expected_time_of_exit = models.TimeField(null=True, blank=True)
    permission_status = models.CharField(
        max_length=20,
        choices=[
            ("pending", "Pending"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
        ],
        default="pending",
        null=True, blank=True
    )
    exit_time = models.DateTimeField(null=True, blank=True)
    exit_gate = models.ForeignKey(
        Gate, on_delete=models.CASCADE, null=True, blank=True, related_name='gates_exit'
    )
    tag_number = models.CharField(max_length=255, null=True, blank=True)
    movement_completed_at = models.DateTimeField(null=True, blank=True)
    movement_completed_by = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='completed_movements'
    )
    movement_notes = models.TextField(null=True, blank=True)
    equipments = models.ManyToManyField(
        'Equipment',
        blank=True,
        related_name='gate_entries'
    )
    equipment_notes = models.TextField(null=True, blank=True)
    generated_tags = models.ManyToManyField(
        GeneratedTag,
        blank=True,
        related_name='multi_gate_entries',
    )
    park_area = models.ForeignKey(
        'ParkArea', on_delete=models.SET_NULL, null=True, blank=True, related_name='gate_entries'
    )
    parking_slot = models.ForeignKey(
        'ParkingSlot', on_delete=models.SET_NULL, null=True, blank=True, related_name='gate_entries'
    )

    created_by = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, null=True, blank=True, related_name='created_gateentry'
    )

    def save(self, *args, **kwargs):
        if self.generated_tag:
            if not self.tag_number and self.generated_tag.tag_number:
                self.tag_number = str(self.generated_tag.tag_number)
            if not self.entry_tag and self.generated_tag.entry_tag:
                self.entry_tag = self.generated_tag.entry_tag
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        return reverse('gate_entry_list')

    def __str__(self):
        visitor_name = self.visitor.visitor_name if self.visitor else "Unknown"
        return f"GateEntry {self.id} - {visitor_name}"

class GateEntryVehicle(models.Model):
    """
    Accompanied vehicles registered during a GateEntry.
    Captures vehicle number, driver name, and captured vehicle photo.
    Supports multiple vehicles per gate entry.
    """
    gate_entry = models.ForeignKey(
        GateEntry, on_delete=models.CASCADE, related_name='vehicles'
    )
    vehicle_number = models.CharField(max_length=255)
    driver_name = models.CharField(max_length=255, null=True, blank=True)
    vehicle_photo = models.ImageField(upload_to='gate_entry_vehicles/', null=True, blank=True)
    park_area = models.ForeignKey(
        'ParkArea', on_delete=models.SET_NULL, null=True, blank=True, related_name='gate_entry_vehicles'
    )
    parking_slot = models.ForeignKey(
        'ParkingSlot', on_delete=models.SET_NULL, null=True, blank=True, related_name='gate_entry_vehicles'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"{self.vehicle_number} ({self.driver_name or 'No Driver'})"

class GateEntryReallocation(models.Model):
    """
    Audit log for visitors/vehicles reallocated between employees/departments inside the campus.
    """
    gate_entry = models.ForeignKey(
        GateEntry, on_delete=models.CASCADE, null=True, blank=True, related_name='reallocations'
    )
    vehicle_entry = models.ForeignKey(
        'VehicleEntry', on_delete=models.CASCADE, null=True, blank=True, related_name='reallocations'
    )
    from_employee = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='reallocations_from'
    )
    to_employee = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='reallocations_to'
    )
    from_department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='reallocations_from_dept'
    )
    to_department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='reallocations_to_dept'
    )
    reason = models.TextField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending Approval'),
            ('approved', 'Approved'),
            ('rejected', 'Rejected'),
            ('cancelled', 'Cancelled')
        ],
        default='pending'
    )
    responded_at = models.DateTimeField(null=True, blank=True)
    response_notes = models.TextField(null=True, blank=True)
    reallocated_by = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='reallocations_performed'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        from_name = f"{self.from_employee.first_name} {self.from_employee.last_name}".strip() if self.from_employee else "N/A"
        to_name = f"{self.to_employee.first_name} {self.to_employee.last_name}".strip() if self.to_employee else "N/A"
        entry_target = f"GateEntry #{self.gate_entry_id}" if self.gate_entry_id else f"VehicleEntry #{self.vehicle_entry_id}"
        return f"Reallocation #{self.id} for {entry_target}: {from_name} -> {to_name}"

# ─────────────────────────────────────────────
# VEHICLE GATE MANAGEMENT
# ─────────────────────────────────────────────

class VehicleType(models.Model):
    name = models.CharField(max_length=255, unique=True)
    date = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, null=True, blank=True, related_name='created_vehicletype'
    )

    def __str__(self):
        return f"{self.name}"

class Vehicle(models.Model):
    vehicle_number = models.CharField(max_length=255, unique=True, db_index=True)
    vehicle_type = models.ForeignKey(VehicleType, on_delete=models.SET_NULL, null=True, blank=True)
    company = models.CharField(max_length=255, null=True, blank=True)
    driver = models.CharField(max_length=255, null=True, blank=True)
    employee = models.ForeignKey(
        'rarenett_app.Employee', on_delete=models.SET_NULL, null=True, blank=True, related_name='vehicles'
    )
    is_preferred = models.BooleanField(default=False)
    vehicle_photo = models.ImageField(upload_to='vehicle_photo/', null=True, blank=True)
    date = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, null=True, blank=True, related_name='created_vehicle'
    )

    def save(self, *args, **kwargs):
        if self.employee and self.is_preferred:
            Vehicle.objects.filter(employee=self.employee, is_preferred=True).exclude(pk=self.pk).update(is_preferred=False)
        elif self.employee and not self.is_preferred and self.pk:
            other_preferred = Vehicle.objects.filter(employee=self.employee, is_preferred=True).exclude(pk=self.pk).exists()
            if not other_preferred:
                first_other = Vehicle.objects.filter(employee=self.employee).exclude(pk=self.pk).first()
                if first_other:
                    first_other.is_preferred = True
                    first_other.save()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.vehicle_number}"

class VehicleEntry(models.Model):
    vehicles = models.ManyToManyField(Vehicle, related_name='entries')
    driver = models.CharField(max_length=255, null=True, blank=True)
    company = models.CharField(max_length=255, null=True, blank=True)
    purpose = models.TextField(null=True, blank=True)
    material_details = models.TextField(null=True, blank=True)
    parking_location = models.CharField(max_length=255, null=True, blank=True)
    park_area = models.ForeignKey(
        'ParkArea', on_delete=models.SET_NULL, null=True, blank=True, related_name='vehicle_entries'
    )
    parking_slot = models.ForeignKey(
        'ParkingSlot', on_delete=models.SET_NULL, null=True, blank=True, related_name='vehicle_entries'
    )
    document_photo = models.ImageField(upload_to='vehicle_documents/', null=True, blank=True)
    vehicle_pass = models.ForeignKey(GeneratedTag, on_delete=models.SET_NULL, null=True, blank=True)
    
    entry_gate = models.ForeignKey(Gate, on_delete=models.CASCADE, null=True, blank=True, related_name='vehicle_entry_gates')
    exit_gate = models.ForeignKey(Gate, on_delete=models.CASCADE, null=True, blank=True, related_name='vehicle_exit_gates')
    
    entry_time = models.DateTimeField(auto_now_add=True)
    exit_time = models.DateTimeField(null=True, blank=True)
    checkout_purpose = models.CharField(
        max_length=50,
        choices=[
            ("delivery", "Delivery"),
            ("servicing", "Servicing"),
            ("other", "Other Purpose"),
        ],
        null=True,
        blank=True
    )
    purpose_note = models.TextField(null=True, blank=True)
    delivery_note_number = models.CharField(max_length=100, null=True, blank=True)
    delivery_note_photo = models.ImageField(upload_to='delivery_notes/', null=True, blank=True)
    
    status = models.CharField(
        max_length=20,
        choices=[
            ("pending", "Pending"),
            ("completed", "Completed"),
        ],
        default="pending",
    )
    
    created_by = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, null=True, blank=True, related_name='created_vehicle_entry'
    )
    
    number_of_persons = models.IntegerField(default=1)
    persons_inside = models.IntegerField(null=True, blank=True)
    partial_exit_logs = models.JSONField(default=list, blank=True)
    expected_time_of_exit = models.TimeField(null=True, blank=True)

    department = models.ForeignKey(
        'rarenett_app.Department', on_delete=models.SET_NULL, null=True, blank=True, related_name='vehicle_entries'
    )
    employee = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='vehicle_entries_concerned'
    )
    appointment = models.ForeignKey(
        'appointment_app.Appointment', on_delete=models.SET_NULL, null=True, blank=True, related_name='vehicle_entries'
    )
    verification_status = models.CharField(
        max_length=20,
        choices=[
            ("pending", "Pending"),
            ("verified", "Verified"),
            ("reassigned", "Reassigned"),
            ("completed", "Completed"),
        ],
        default="pending",
    )
    movement_completed_at = models.DateTimeField(null=True, blank=True)
    movement_completed_by = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='completed_vehicle_movements'
    )
    movement_notes = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"VehicleEntry {self.id}"

    @property
    def vehicle_number(self):
        first_v = self.vehicles.first()
        return first_v.vehicle_number if first_v else ''


class VehicleEntryDocument(models.Model):
    vehicle_entry = models.ForeignKey(
        VehicleEntry, on_delete=models.CASCADE, related_name='documents'
    )
    document_photo = models.ImageField(upload_to='vehicle_documents/')
    document_name = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"Document {self.id} for VehicleEntry {self.vehicle_entry_id}"


class EmployeeGateEntry(models.Model):
    """
    Tracks campus entry and exit logs for company employees using their
    barcode / employment_no from EmploymentDetails.
    Supports instant check-in / check-out with zero form filling.
    """
    STATUS_CHOICES = [
        ('inside', 'Inside'),
        ('exited', 'Exited'),
    ]

    VERIFICATION_CHOICES = [
        ('barcode', 'Barcode / ID'),
        ('face', 'Face Recognition'),
        ('manual', 'Manual'),
    ]

    employment_detail = models.ForeignKey(
        'rarenett_app.EmploymentDetails',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employee_gate_entries'
    )
    employee = models.ForeignKey(
        'rarenett_app.Employee',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employee_gate_entries'
    )
    vehicle = models.ForeignKey(
        'Vehicle',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employee_gate_entries'
    )
    vehicle_entry = models.ForeignKey(
        'VehicleEntry',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employee_gate_entries'
    )
    park_area = models.ForeignKey(
        'ParkArea',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employee_gate_entries'
    )
    parking_slot = models.ForeignKey(
        'ParkingSlot',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employee_gate_entries'
    )
    entry_gate = models.ForeignKey(
        Gate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employee_entries'
    )
    entry_time = models.DateTimeField(auto_now_add=True)
    exit_time = models.DateTimeField(null=True, blank=True)
    exit_gate = models.ForeignKey(
        Gate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employee_exits'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='inside'
    )
    verification_method = models.CharField(
        max_length=20,
        choices=VERIFICATION_CHOICES,
        default='barcode'
    )
    face_match_score = models.FloatField(null=True, blank=True)
    snapshot_image = models.ImageField(upload_to='gate_entries/employee_snapshots/', null=True, blank=True)
    remarks = models.TextField(null=True, blank=True)
    recorded_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_employee_entries'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-entry_time']

    def __str__(self):
        emp_no = (self.employment_detail.employment_no if self.employment_detail else None) or (f"EMP{self.employee.id}" if self.employee else 'N/A')
        return f"EmployeeEntry #{self.id} ({emp_no} - {self.status} via {self.verification_method})"


# ─────────────────────────────────────────────
# APPROVELESS ENTRY CONFIGURATION
# ─────────────────────────────────────────────

class ApprovelessEntryConfig(models.Model):
    """
    Configuration to bypass approval for visitors or vehicles visiting
    a designated employee within a specific department.
    """
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='approveless_configs'
    )
    employee = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='approveless_configs'
    )
    is_active = models.BooleanField(default=True)
    notes = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_approveless_configs'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('department', 'employee')
        ordering = ['-created_at']

    def __str__(self):
        return f"Approveless Entry: {self.employee} ({self.department})"


# ─────────────────────────────────────────────
# EQUIPMENT / TOOL MASTER
# ─────────────────────────────────────────────

class Equipment(models.Model):
    """
    Master model for tools and equipments brought in or carried by visitors/contractors/employees.
    """
    name = models.CharField(max_length=255, unique=True)
    code = models.CharField(max_length=50, null=True, blank=True)
    image = models.ImageField(upload_to='equipment_images/', null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_equipments'
    )

    class Meta:
        ordering = ['-created_at']

# ─────────────────────────────────────────────
# PARK AREA
# ─────────────────────────────────────────────
class ParkArea(models.Model):
    name = models.CharField(max_length=255)
    is_main_area = models.BooleanField(default=False)
    number_of_slots = models.PositiveIntegerField(null=True, blank=True)
    parent_area = models.ForeignKey('self', on_delete=models.PROTECT, null=True, blank=True, related_name='child_areas')
    nature = models.CharField(max_length=50, default='Park')
    sort_order = models.IntegerField(default=0, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class ParkingSlot(models.Model):
    park_area = models.ForeignKey(ParkArea, on_delete=models.CASCADE, related_name='slots')
    slot_number = models.PositiveIntegerField()
    status = models.CharField(max_length=50, default='Available')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['slot_number']
        unique_together = ('park_area', 'slot_number')

    def __str__(self):
        return f"{self.park_area.name} - Slot {self.slot_number}"


# ─────────────────────────────────────────────
# ENTRY CARD
# ─────────────────────────────────────────────
class EntryCard(models.Model):
    vehicle_number = models.CharField(max_length=50)
    entry_time = models.DateTimeField()
    park_area = models.ForeignKey(ParkArea, on_delete=models.SET_NULL, null=True, blank=True)
    parking_slot = models.ForeignKey(ParkingSlot, on_delete=models.SET_NULL, null=True, blank=True)
    signature = models.ImageField(upload_to='entry_card/signatures/', blank=True, null=True)
    gate_entry = models.ForeignKey('GateEntry', on_delete=models.SET_NULL, null=True, blank=True, related_name='entry_cards')
    vehicle_entry = models.ForeignKey('VehicleEntry', on_delete=models.SET_NULL, null=True, blank=True, related_name='entry_cards')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.vehicle_number

class ExitCard(models.Model):
    entry_card = models.ForeignKey('EntryCard', on_delete=models.CASCADE, related_name='exit_cards')
    exit_time = models.DateTimeField()
    parking_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    signature = models.ImageField(upload_to='exit_card/signatures/', blank=True, null=True)
    gate_entry = models.ForeignKey('GateEntry', on_delete=models.SET_NULL, null=True, blank=True, related_name='exit_cards')
    vehicle_entry = models.ForeignKey('VehicleEntry', on_delete=models.SET_NULL, null=True, blank=True, related_name='exit_cards')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'gate_app_exitcard'

    def __str__(self):
        return f"Exit for {self.entry_card.vehicle_number}"

# ─────────────────────────────────────────────
# PARKING FEE MASTER
# ─────────────────────────────────────────────
class ParkingFee(models.Model):
    min_minutes = models.IntegerField(default=0)
    max_minutes = models.IntegerField(null=True, blank=True)
    fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['min_minutes']

    def __str__(self):
        max_val = f"{self.max_minutes} min" if self.max_minutes else "No Limit"
        return f"{self.min_minutes} min - {max_val} : {self.fee}"
