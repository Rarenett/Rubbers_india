from django.db import models
from django.conf import settings

class LeadCategory(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name

class Lead(models.Model):
    LEAD_SOURCE_CHOICES = [
        ('Advertisement', 'Advertisement'),
        ('Cold Call', 'Cold Call'),
        ('Employee Referral', 'Employee Referral'),
        ('External Referral', 'External Referral'),
        ('Online Store', 'Online Store'),
        ('Twitter', 'Twitter'),
        ('Facebook', 'Facebook'),
        ('Partner', 'Partner'),
        ('Google+', 'Google+'),
        ('Public Relations', 'Public Relations'),
        ('Sales Email Alias', 'Sales Email Alias'),
        ('Seminar Partner', 'Seminar Partner'),
        ('Internal Seminar', 'Internal Seminar'),
        ('Trade Show', 'Trade Show'),
        ('Web Download', 'Web Download'),
        ('Web Research', 'Web Research'),
        ('Chat', 'Chat'),
    ]

    LEAD_STATUS_CHOICES = [
        ('Attempted to Contact', 'Attempted to Contact'),
        ('Contact in Future', 'Contact in Future'),
        ('Contacted', 'Contacted'),
        ('Junk Lead', 'Junk Lead'),
        ('Lost Lead', 'Lost Lead'),
        ('Not Contacted', 'Not Contacted'),
        ('Pre Qualified', 'Pre Qualified'),
        ('Not Qualified', 'Not Qualified'),
    ]

    INDUSTRY_CHOICES = [
        ('ASP', 'ASP'),
        ('Data/Telecom OEM', 'Data/Telecom OEM'),
        ('ERP', 'ERP'),
        ('Government/Military', 'Government/Military'),
        ('Large Enterprise', 'Large Enterprise'),
        ('ManagementISV', 'ManagementISV'),
        ('MSP (Management Service Provider)', 'MSP (Management Service Provider)'),
        ('Network Equipment Enterprise', 'Network Equipment Enterprise'),
        ('Non-management ISV', 'Non-management ISV'),
        ('Optical Networking', 'Optical Networking'),
        ('Service Provider', 'Service Provider'),
        ('Small/Medium Enterprise', 'Small/Medium Enterprise'),
        ('Storage Equipment', 'Storage Equipment'),
        ('Storage Service Provider', 'Storage Service Provider'),
        ('Systems Integrator', 'Systems Integrator'),
        ('Wireless Industry', 'Wireless Industry'),
    ]

    RATING_CHOICES = [
        ('Acquired', 'Acquired'),
        ('Active', 'Active'),
        ('Market Failed', 'Market Failed'),
        ('Project Cancelled', 'Project Cancelled'),
        ('Shut Down', 'Shut Down'),
    ]

    # Lead Information
    lead_owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='owned_leads')
    category = models.ForeignKey(LeadCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='leads')
    company = models.CharField(max_length=255, blank=True, null=True)
    first_name = models.CharField(max_length=255, blank=True, null=True)
    last_name = models.CharField(max_length=255)
    title = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    fax = models.CharField(max_length=50, blank=True, null=True)
    mobile = models.CharField(max_length=50, blank=True, null=True)
    website = models.URLField(max_length=255, blank=True, null=True)
    
    lead_source = models.CharField(max_length=100, blank=True, null=True)
    lead_status = models.CharField(max_length=100, choices=LEAD_STATUS_CHOICES, blank=True, null=True)
    industry = models.CharField(max_length=100, choices=INDUSTRY_CHOICES, blank=True, null=True)
    
    no_of_employees = models.IntegerField(blank=True, null=True)
    annual_revenue = models.DecimalField(max_digits=15, decimal_places=2, blank=True, null=True)
    rating = models.CharField(max_length=100, choices=RATING_CHOICES, blank=True, null=True)
    
    email_opt_out = models.BooleanField(default=False)
    skype_id = models.CharField(max_length=100, blank=True, null=True)
    secondary_email = models.EmailField(blank=True, null=True)
    twitter = models.CharField(max_length=100, blank=True, null=True)
    contact_preferences = models.CharField(max_length=255, blank=True, null=True, help_text="Comma-separated values: Phone, WhatsApp, Email")

    # Address Information
    country = models.CharField(max_length=100, blank=True, null=True)
    flat_house_no = models.CharField(max_length=255, blank=True, null=True)
    street_address = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    state_province = models.CharField(max_length=100, blank=True, null=True)
    zip_postal_code = models.CharField(max_length=20, blank=True, null=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)

    # Description Information
    description = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to='leads/profile_pics/', blank=True, null=True)
    attachment = models.FileField(upload_to='leads/attachments/', blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        first = self.first_name if self.first_name else ''
        return f"{first} {self.last_name} - {self.company}"

class TeleCallingProject(models.Model):
    name = models.CharField(max_length=255)
    category = models.ForeignKey(LeadCategory, on_delete=models.CASCADE, related_name='projects')
    team_leader = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='led_projects')
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='member_projects')
    target_date = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class LeadAssignment(models.Model):
    STATUS_CHOICES = [
        ('Not Contacted', 'Not Contacted'),
        ('Attempted', 'Attempted to Contact'),
        ('Contacted', 'Contacted / In Discussion'),
        ('Hold', 'Hold (Call Later)'),
        ('Opportunity', 'Lead Interested / Opportunity'),
        ('Disqualified', 'Disqualified'),
        ('Junk', 'Junk Lead'),
    ]

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='assignments')
    project = models.ForeignKey(TeleCallingProject, on_delete=models.CASCADE, related_name='lead_assignments')
    assignee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='assigned_leads', null=True, blank=True)
    target_time = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Not Contacted')
    remarks = models.TextField(blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Synchronize Assignment status with Master Lead status
        status_map = {
            'Not Contacted': 'Not Contacted',
            'Attempted': 'Attempted to Contact',
            'Contacted': 'Contacted',
            'Hold': 'Contact in Future',
            'Opportunity': 'Pre Qualified',
            'Disqualified': 'Not Qualified',
            'Junk': 'Junk Lead',
        }
        
        # Update Master Lead status if it exists in map
        if self.status in status_map:
            self.lead.lead_status = status_map[self.status]
            self.lead.save(update_fields=['lead_status'])
            
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.lead} - {self.assignee.username}"

class LeadInteractionLog(models.Model):
    assignment = models.ForeignKey(LeadAssignment, on_delete=models.CASCADE, related_name='logs')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='interaction_logs')
    status = models.CharField(max_length=50)
    remarks = models.TextField(blank=True, null=True)
    next_call_date = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.assignment.lead} - {self.status} at {self.created_at}"

class CallSession(models.Model):
    STATUS_CHOICES = [
        ('Dialing', 'Dialing'),
        ('Connected', 'Connected'),
        ('Completed', 'Completed'),
        ('Failed', 'Failed'),
        ('Busy', 'Busy'),
    ]

    assignment = models.ForeignKey(LeadAssignment, on_delete=models.CASCADE, related_name='call_sessions')
    caller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='made_calls')
    phone_number = models.CharField(max_length=20)
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(blank=True, null=True)
    duration = models.IntegerField(default=0, help_text="Duration in seconds")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Dialing')
    recording_url = models.URLField(blank=True, null=True)

    def __str__(self):
        return f"Call for {self.assignment.lead} by {self.caller.username} - {self.status}"


class DistributionZone(models.Model):
    name = models.CharField(max_length=200, null=True)
    pincode = models.CharField(max_length=20, null=True)
    district = models.CharField(max_length=100, null=True)
    state = models.CharField(max_length=100, null=True)
    remarks = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    def __str__(self):
        return self.name or "Unnamed Zone"



class BasePartnerLead(models.Model):
    full_name = models.CharField(max_length=255)
    contact_number = models.CharField(max_length=50)
    email = models.EmailField()
    designation = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255)
    website = models.URLField(blank=True, null=True)

    address = models.TextField()
    pincode = models.CharField(max_length=20)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    country = models.CharField(max_length=100, default='India')

    is_registered_business = models.BooleanField(default=False)
    gst_number = models.CharField(max_length=100, blank=True, null=True)
    fssai_license_number = models.CharField(max_length=100, blank=True, null=True)
    has_prior_experience = models.BooleanField(default=False)
    experience_description = models.TextField(blank=True, null=True)

    business_reg_cert = models.FileField(upload_to='leads/docs/', blank=True, null=True)
    gst_cert = models.FileField(upload_to='leads/docs/', blank=True, null=True)
    address_proof = models.FileField(upload_to='leads/docs/', blank=True, null=True)
    pan_card = models.FileField(upload_to='leads/docs/', blank=True, null=True)
    bank_statement = models.FileField(upload_to='leads/docs/', blank=True, null=True)
    proprietor_photo = models.ImageField(upload_to='leads/photos/', blank=True, null=True)
    proprietor_id_proof = models.FileField(upload_to='leads/docs/', blank=True, null=True)
    fssai_license = models.FileField(upload_to='leads/docs/', blank=True, null=True)

    lead_source = models.CharField(max_length=100, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True

class DistributorLead(BasePartnerLead):
    has_working_capital = models.BooleanField(default=False)
    initial_investment_capacity = models.CharField(max_length=255, blank=True, null=True)
    has_storage_facility = models.BooleanField(default=False)
    storage_facility_description = models.TextField(blank=True, null=True)
    has_delivery_infrastructure = models.BooleanField(default=False)
    delivery_infrastructure_description = models.TextField(blank=True, null=True)
    coverage_areas = models.ManyToManyField('DistributionZone', blank=True)

class VendorLead(BasePartnerLead):
    pan_number = models.CharField(max_length=100, blank=True, null=True)
    registration_number = models.CharField(max_length=255, blank=True, null=True)
    material_names = models.ManyToManyField('inventory_app.StockItem', blank=True)
