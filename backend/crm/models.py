from django.db import models
from django.conf import settings
from django.utils import timezone
class LeadSource(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Lead Source'
        verbose_name_plural = 'Lead Sources'

    def __str__(self):
        return self.name


class CrmService(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'CRM Service'
        verbose_name_plural = 'CRM Services'

    def __str__(self):
        return self.name

# Alias for convenience
Service = CrmService


class LeadCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Lead Category'
        verbose_name_plural = 'Lead Categories'

    def __str__(self):
        return self.name

# Alias for convenience
Category = LeadCategory


class Industry(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Industry'
        verbose_name_plural = 'Industries'

    def __str__(self):
        return self.name

# Alias for convenience
LeadIndustry = Industry


class CrmPurpose(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'CRM Purpose'
        verbose_name_plural = 'CRM Purposes'

    def __str__(self):
        return self.name

# Alias for convenience
Purpose = CrmPurpose


class CrmOffer(models.Model):
    OFFER_TYPE_CHOICES = [
        ('Percentage', 'Percentage'),
        ('Flat amount', 'Flat amount'),
        ('Buy X Get Y', 'Buy X Get Y'),
        ('Free gift', 'Free gift'),
        ('Free service', 'Free service'),
        ('Bundle/combo', 'Bundle/combo'),
    ]

    STATUS_CHOICES = [
        ('Draft', 'Draft'),
        ('Active', 'Active'),
        ('Expired', 'Expired'),
        ('Cancelled', 'Cancelled'),
    ]

    CRITERIA_TYPE_CHOICES = [
        ('Amount Based', 'Amount Based'),
        ('Product Based', 'Product Based'),
        ('Service Based', 'Service Based'),
    ]

    title = models.CharField(max_length=255, help_text='Offer name, e.g. "Diwali 20% Off"')
    code = models.CharField(max_length=100, unique=True, null=True, blank=True, help_text='Coupon or reference code, e.g. DIWALI20')
    category = models.ForeignKey(
        LeadCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='crm_offers',
        help_text='Applicable Lead Category (optional, all categories if blank)'
    )
    criteria_type = models.CharField(
        max_length=50,
        choices=CRITERIA_TYPE_CHOICES,
        default='Amount Based',
        help_text='Qualification scenario: Amount Based, Product Based, or Service Based'
    )
    criteria_rows = models.JSONField(
        default=list,
        blank=True,
        null=True,
        help_text='Dynamic criteria rows based on criteria_type'
    )
    description = models.TextField(blank=True, null=True, help_text='Short pitch for callers to read out')
    terms_and_conditions = models.TextField(blank=True, null=True, help_text='Conditions and exclusions')
    offer_type = models.CharField(max_length=50, choices=OFFER_TYPE_CHOICES, default='Percentage')
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text='Used when type is Percentage')
    discount_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, help_text='Used when type is Flat')
    max_discount_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, help_text='Cap for percentage offers')
    min_purchase_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, help_text='Minimum order value to qualify')
    start_date = models.DateField(null=True, blank=True, help_text='When it begins')
    end_date = models.DateField(null=True, blank=True, help_text='When it expires')
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Active')
    is_active = models.BooleanField(default=True, help_text='Matches your other masters')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='crm_offers',
        help_text='Who created it'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'CRM Offer'
        verbose_name_plural = 'CRM Offers'

    def clean(self):
        if not self.code or (isinstance(self.code, str) and not self.code.strip()):
            self.code = None

    def save(self, *args, **kwargs):
        if not self.code or (isinstance(self.code, str) and not self.code.strip()):
            self.code = None
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} ({self.code})" if self.code else self.title

# Alias for convenience
Offer = CrmOffer




class Lead(models.Model):
    LEAD_STATUS_CHOICES = [
        ('Attempted to Contact', 'Attempted to Contact'),
        ('Contact in Future', 'Contact in Future'),
        ('Contacted', 'Contacted'),
        ('Junk Lead', 'Junk Lead'),
        ('Lost Lead', 'Lost Lead'),
        ('Not Contacted', 'Not Contacted'),
        ('Pre Qualified', 'Pre Qualified'),
        ('Not Qualified', 'Not Qualified'),
        ('Escalated', 'Escalated'),
    ]

    RATING_CHOICES = [
        ('Acquired', 'Acquired'),
        ('Active', 'Active'),
        ('Market Failed', 'Market Failed'),
        ('Project Cancelled', 'Project Cancelled'),
        ('Shut Down', 'Shut Down'),
        ('Hot', 'Hot'),
        ('Warm', 'Warm'),
        ('Cold', 'Cold'),
    ]

    PRIORITY_CHOICES = [
        ('High', 'High'),
        ('Medium', 'Medium'),
        ('Low', 'Low'),
    ]

    # Owner details
    lead_owner = models.ForeignKey(
        'register_app.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='crm_new_leads'
    )
    other_owner_name = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Name of the person if not an employee"
    )

    # Classification
    category = models.ForeignKey(
        LeadCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='crm_leads'
    )
    lead_source = models.ForeignKey(
        LeadSource,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='crm_leads'
    )

    # Core details
    company = models.CharField(max_length=255, blank=True, null=True)
    first_name = models.CharField(max_length=255, blank=True, null=True)
    last_name = models.CharField(max_length=255, blank=True, null=True)
    title = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=50)  # Mandatory
    fax = models.CharField(max_length=50, blank=True, null=True)
    mobile = models.CharField(max_length=50, blank=True, null=True)
    website = models.URLField(max_length=255, blank=True, null=True)

    lead_status = models.CharField(max_length=100, choices=LEAD_STATUS_CHOICES, blank=True, null=True, default='Not Contacted')
    industry = models.ForeignKey(
        Industry,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='crm_leads'
    )
    no_of_employees = models.IntegerField(blank=True, null=True)
    annual_revenue = models.DecimalField(max_digits=15, decimal_places=2, blank=True, null=True)
    rating = models.CharField(max_length=100, choices=RATING_CHOICES, blank=True, null=True)

    email_opt_out = models.BooleanField(default=False)
    skype_id = models.CharField(max_length=100, blank=True, null=True)
    secondary_email = models.EmailField(blank=True, null=True)
    twitter = models.CharField(max_length=100, blank=True, null=True)
    contact_preferences = models.CharField(max_length=255, blank=True, null=True, help_text="Comma-separated: Phone, WhatsApp, Email")

    # Address
    country = models.CharField(max_length=100, blank=True, null=True)
    flat_house_no = models.CharField(max_length=255, blank=True, null=True)
    street_address = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    state_province = models.CharField(max_length=100, blank=True, null=True)
    zip_postal_code = models.CharField(max_length=20, blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)

    # Description & Profile Image
    description = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to='crm/leads/profile_pics/', blank=True, null=True)

    # Product and Service selection
    has_product_interest = models.BooleanField(default=False)
    has_service_interest = models.BooleanField(default=False)
    products = models.ManyToManyField('inventory_app.StockItem', blank=True, related_name='crm_leads')
    services = models.ManyToManyField(CrmService, blank=True, related_name='crm_leads')

    # Deal metrics & Sales attribution
    estimated_value = models.DecimalField(max_digits=15, decimal_places=2, blank=True, null=True)
    priority = models.CharField(max_length=50, choices=PRIORITY_CHOICES, blank=True, null=True, default='Medium')
    expected_closing_date = models.DateField(blank=True, null=True)
    assigned_sales_employees = models.TextField(blank=True, null=True, help_text="Assigned sales employees text field")

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Lead'
        verbose_name_plural = 'Leads'

    def __str__(self):
        full_name = f"{self.first_name or ''} {self.last_name or ''}".strip()
        return full_name or self.company or f"Lead #{self.id}"


class LeadAttachment(models.Model):
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='crm/leads/attachments/')
    file_name = models.CharField(max_length=255, blank=True, null=True)
    file_size = models.BigIntegerField(blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return self.file_name or (self.file.name if self.file else f"Attachment #{self.id}")


class LeadImage(models.Model):
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='crm/leads/images/')
    image_name = models.CharField(max_length=255, blank=True, null=True)
    image_size = models.BigIntegerField(blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']
        verbose_name = 'Lead Image'
        verbose_name_plural = 'Lead Images'

    def __str__(self):
        return self.image_name or (self.image.name if self.image else f"Image #{self.id}")

class CrmLeadFollowUp(models.Model):
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Working On Lead', 'Working On Lead'),
        ('Escalated', 'Escalated')
    ]

    lead = models.ForeignKey('project_app.MarketingLead', on_delete=models.CASCADE, related_name='crm_follow_ups')
    visit_date = models.DateField(default=timezone.now)
    remarks = models.TextField(blank=True, null=True)
    category = models.ForeignKey(LeadCategory, on_delete=models.SET_NULL, null=True, blank=True)
    telecaller = models.ForeignKey('register_app.CustomUser', on_delete=models.SET_NULL, null=True, blank=True, related_name='crm_followups_as_telecaller')
    executive = models.ForeignKey('rarenett_app.Employee', on_delete=models.SET_NULL, null=True, blank=True)
    narration = models.TextField(blank=True, null=True)
    next_visit_date = models.DateField(blank=True, null=True)
    purpose = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Active')
    shop_photo = models.ImageField(upload_to='crm/follow_ups/photos/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"FollowUp #{self.id} for Lead {self.lead_id}"


class LeadImportBatch(models.Model):
    STATUS_CHOICES = [
        ('UPLOADED', 'UPLOADED'),
        ('HAS_ISSUES', 'HAS_ISSUES'),
        ('READY', 'READY'),
        ('PUSHED', 'PUSHED'),
        ('CANCELLED', 'CANCELLED'),
    ]

    uploaded_by = models.ForeignKey(
        'register_app.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='crm_lead_import_batches'
    )
    file_name = models.CharField(max_length=255)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='UPLOADED')
    total_rows = models.IntegerField(default=0)
    valid_rows = models.IntegerField(default=0)
    invalid_rows = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    pushed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Lead Import Batch'
        verbose_name_plural = 'Lead Import Batches'

    def __str__(self):
        return f"Batch #{self.id} - {self.file_name} ({self.status})"


class LeadImportStaging(models.Model):
    VALIDATION_CHOICES = [
        ('PENDING', 'PENDING'),
        ('VALID', 'VALID'),
        ('INVALID', 'INVALID'),
        ('PUSHED', 'PUSHED'),
    ]

    batch = models.ForeignKey(
        LeadImportBatch,
        on_delete=models.CASCADE,
        related_name='rows'
    )
    row_number = models.IntegerField()

    # Raw text fields as uploaded in Excel
    phone = models.CharField(max_length=255, blank=True, null=True)
    first_name = models.CharField(max_length=255, blank=True, null=True)
    last_name = models.CharField(max_length=255, blank=True, null=True)
    company = models.CharField(max_length=255, blank=True, null=True)
    email = models.CharField(max_length=255, blank=True, null=True)
    mobile = models.CharField(max_length=255, blank=True, null=True)
    title = models.CharField(max_length=255, blank=True, null=True)
    category_name = models.CharField(max_length=255, blank=True, null=True)
    source_name = models.CharField(max_length=255, blank=True, null=True)
    industry_name = models.CharField(max_length=255, blank=True, null=True)
    lead_status = models.CharField(max_length=255, blank=True, null=True)
    rating = models.CharField(max_length=255, blank=True, null=True)
    priority = models.CharField(max_length=255, blank=True, null=True)
    estimated_value = models.CharField(max_length=255, blank=True, null=True)
    no_of_employees = models.CharField(max_length=255, blank=True, null=True)
    annual_revenue = models.CharField(max_length=255, blank=True, null=True)
    website = models.CharField(max_length=255, blank=True, null=True)
    country = models.CharField(max_length=255, blank=True, null=True)
    state_province = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=255, blank=True, null=True)
    street_address = models.CharField(max_length=255, blank=True, null=True)
    zip_postal_code = models.CharField(max_length=255, blank=True, null=True)
    description = models.TextField(blank=True, null=True)

    # Normalized phone for duplicate detection & index
    normalized_phone = models.CharField(max_length=50, blank=True, null=True, db_index=True)

    # Resolved FKs (null until matched)
    category = models.ForeignKey(LeadCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='staging_leads')
    lead_source = models.ForeignKey(LeadSource, on_delete=models.SET_NULL, null=True, blank=True, related_name='staging_leads')
    industry = models.ForeignKey(Industry, on_delete=models.SET_NULL, null=True, blank=True, related_name='staging_leads')

    validation_status = models.CharField(max_length=50, choices=VALIDATION_CHOICES, default='PENDING')
    error_messages = models.JSONField(default=list, blank=True)
    is_duplicate_in_file = models.BooleanField(default=False)
    existing_lead = models.ForeignKey(Lead, on_delete=models.SET_NULL, null=True, blank=True, related_name='staging_matches')

    class Meta:
        ordering = ['row_number']
        unique_together = ('batch', 'row_number')
        verbose_name = 'Lead Import Staging Row'
        verbose_name_plural = 'Lead Import Staging Rows'

    def __str__(self):
        return f"Batch #{self.batch_id} Row #{self.row_number} - {self.phone} ({self.validation_status})"
class CrmTelecalling(models.Model):
    name = models.CharField(max_length=255)
    category = models.ForeignKey(LeadCategory, on_delete=models.CASCADE, related_name='crm_telecalling_projects')
    team_leader = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='crm_led_projects')
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='crm_member_projects')
    target_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=50, default='In Progress')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'crm_telecalling'

    def __str__(self):
        return self.name


class TelecallingTeam(models.Model):
    name = models.CharField(max_length=255)
    team_leader = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='crm_telecalling_teams_led')
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='crm_telecalling_teams')
    status = models.CharField(max_length=50, default='In Progress')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'crm_telecalling_team'

    def __str__(self):
        return self.name

class TelecallingLeadAssignment(models.Model):
    team = models.ForeignKey(TelecallingTeam, on_delete=models.CASCADE, null=True, blank=True, related_name='lead_assignments')
    employee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='crm_individual_lead_assignments')
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='crm_individual_assigned_by_leads')
    lead_id = models.IntegerField()
    lead_source = models.CharField(max_length=100)
    closing_date = models.DateField(null=True, blank=True)
    active_caller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='crm_active_lead_calls')
    active_call_started_at = models.DateTimeField(null=True, blank=True)
    assigned_caller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='crm_team_assigned_leads')
    reassignment_reason = models.TextField(blank=True, null=True)
    reassignment_requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='crm_reassignment_requests')
    reassignment_requested_at = models.DateTimeField(null=True, blank=True)
    reassignment_status = models.CharField(max_length=50, default='NONE')  # 'NONE', 'REQUESTED', 'REASSIGNED'
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'crm_telecalling_lead_assignment'

    def __str__(self):
        target = self.team.name if self.team else (f"Employee {self.employee}" if self.employee else "Unassigned")
        return f"{target} - Lead {self.lead_id} ({self.lead_source})"

    @property
    def lead(self):
        try:
            return Lead.objects.filter(id=self.lead_id).first()
        except Exception:
            return None


class CallerCallLog(models.Model):
    """Stores each individual call session by a caller for an assigned lead."""

    CALL_OUTCOME_CHOICES = [
        ('Not Answered', 'Not Answered'),
        ('Busy', 'Busy'),
        ('Wrong Number', 'Wrong Number'),
        ('Contacted', 'Contacted'),
        ('Interested', 'Interested'),
        ('Not Interested', 'Not Interested'),
        ('Call Back Later', 'Call Back Later'),
        ('Converted', 'Converted to Opportunity'),
        ('Converted to Opportunity', 'Converted to Opportunity'),
    ]

    assignment = models.ForeignKey(
        TelecallingLeadAssignment,
        on_delete=models.CASCADE,
        related_name='call_logs'
    )
    caller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='crm_call_logs'
    )
    call_outcome = models.CharField(max_length=50, choices=CALL_OUTCOME_CHOICES, default='Contacted')
    duration_seconds = models.IntegerField(null=True, blank=True, help_text="Call duration in seconds")
    notes = models.TextField(blank=True, null=True, help_text="Notes / remarks after the call")
    follow_up_date = models.DateField(null=True, blank=True, help_text="Next follow-up date if applicable")
    called_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-called_at']
        db_table = 'crm_caller_call_log'
        verbose_name = 'Caller Call Log'
        verbose_name_plural = 'Caller Call Logs'

    def __str__(self):
        return f"CallLog #{self.id} - Assignment {self.assignment_id} by {self.caller}"


class OpportunityAccount(models.Model):
    """
    Dedicated model for storing Converted Opportunity profile data (Distributor/Vendor)
    created from converted CRM telecalling leads into a separate CRM table.
    """
    lead = models.ForeignKey(
        'Lead',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='opportunity_accounts'
    )
    assignment = models.ForeignKey(
        'TelecallingLeadAssignment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='opportunity_accounts'
    )
    name = models.CharField(max_length=255)
    accountGroup = models.CharField(max_length=255, blank=True, null=True)
    account_group_name = models.CharField(max_length=255, blank=True, null=True)
    classification = models.CharField(max_length=50, default='Distributor')  # 'Distributor' | 'Vendor'
    maintain_biilwise_details = models.BooleanField(default=True)
    mailing_name = models.CharField(max_length=255, blank=True, null=True)

    address1 = models.CharField(max_length=255, blank=True, null=True)
    address2 = models.CharField(max_length=255, blank=True, null=True)
    address3 = models.CharField(max_length=255, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True, default='Kerala')
    country = models.CharField(max_length=100, blank=True, null=True, default='India')
    pincode = models.CharField(max_length=50, blank=True, null=True)

    phone = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(max_length=255, blank=True, null=True)
    gst_number = models.CharField(max_length=50, blank=True, null=True)
    pan_number = models.CharField(max_length=50, blank=True, null=True)

    credit_limit = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    opening_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    opening_balance_type = models.CharField(max_length=10, default='Dr', blank=True, null=True)
    placeofsupply = models.CharField(max_length=100, blank=True, null=True)
    registration_type = models.CharField(max_length=100, default='unknown', blank=True, null=True)

    gst_details = models.JSONField(default=list, blank=True)
    contact_details = models.JSONField(default=list, blank=True)
    bank_details = models.JSONField(default=list, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='crm_opportunity_accounts_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'crm_opportunity_account'
        ordering = ['-created_at']
        verbose_name = 'Opportunity Account'
        verbose_name_plural = 'Opportunity Accounts'

    def __str__(self):
        return f"{self.name} ({self.classification})"


class OpportunityApproval(models.Model):
    """
    Model for managing approval workflow of converted opportunities.
    When a telecaller clicks 'Approve', it sends the opportunity here.
    An approver can review and either 'Accept' or put 'On Hold'.
    """
    STATUS_CHOICES = [
        ('PENDING', 'Pending Approval'),
        ('ACCEPTED', 'Accepted'),
        ('ON_HOLD', 'On Hold'),
    ]

    lead = models.ForeignKey(
        'Lead',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='opportunity_approvals'
    )
    assignment = models.ForeignKey(
        'TelecallingLeadAssignment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='opportunity_approvals'
    )
    opportunity_account = models.ForeignKey(
        'OpportunityAccount',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approvals'
    )
    classification = models.CharField(max_length=50, default='Distributor')  # 'Distributor' | 'Vendor'
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')

    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='submitted_opportunity_approvals'
    )
    submitted_at = models.DateTimeField(auto_now_add=True)

    action_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='actioned_opportunity_approvals'
    )
    action_at = models.DateTimeField(null=True, blank=True)
    remarks = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'crm_opportunity_approval'
        ordering = ['-submitted_at']
        verbose_name = 'Opportunity Approval'
        verbose_name_plural = 'Opportunity Approvals'

    def __str__(self):
        return f"Approval #{self.id} - Lead {self.lead_id} ({self.status})"

