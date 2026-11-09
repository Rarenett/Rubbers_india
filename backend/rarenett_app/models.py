from django.db import models
from django.db.models import Avg
from django.urls import reverse
from django.utils import timezone
from django.conf import settings
from dateutil.relativedelta import relativedelta
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey

from settings_app.models import Branch, Company, Factory, Warehouse


class Department(models.Model):
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="departments", null=True
    )
    name = models.CharField(max_length=150, unique=True, null=True)
    is_active = models.BooleanField(default=True)
    requires_visitor_approval = models.BooleanField(default=False)
    branches = models.ManyToManyField('settings_app.Branch', related_name='departments', blank=True)
    contact_person = models.CharField(max_length=150, null=True, blank=True)
    contact_number = models.CharField(max_length=20, null=True, blank=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='user_department')

    class Meta:
        ordering = ['name']
        unique_together = ['company', 'name']

    def get_absolute_url(self):
        return reverse('department_list')

    def __str__(self):
        return self.name


class Designation(models.Model):
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="designations", null=True
    )
    name = models.CharField(max_length=150, null=True)
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='user_designation')

    class Meta:
        unique_together = ['company', 'name']
        ordering = ['name']

    def get_absolute_url(self):
        return reverse('department_list')

    def __str__(self):
        return f"{self.name}"


class DepartmentDesignation(models.Model):

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="department_designations", null=True
    )

    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name="department_designations", null=True
    )

    designation = models.ForeignKey(
        Designation,
        on_delete=models.CASCADE,
        related_name="designation_departments", null=True
    )

    level = models.PositiveIntegerField(default=1, null=True, blank=True)

    class Meta:
        unique_together = ['company', 'department', 'designation']

    def __str__(self):
        return f"{self.department.name} - {self.designation.name}"



class Candidate(models.Model):

    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Selected', 'Selected'),
        ('Rejected', 'Rejected'),
        ('Waitlisted', 'Waitlisted'),
        ('Resigned', 'Resigned'),
        ('Others', 'Others')
    ]

    GENDER_CHOICES = [
        ('Male', 'Male'),
        ('Female', 'Female'),
        ('Other', 'Other')
    ]

    BLOOD_GROUP_CHOICES = [
        ('A+', 'A+'),
        ('A-', 'A-'),
        ('B+', 'B+'),
        ('B-', 'B-'),
        ('O+', 'O+'),
        ('O-', 'O-'),
        ('AB+', 'AB+'),
        ('AB-', 'AB-'),
    ]

    # Basic Details
    first_name = models.CharField(max_length=100, null=True)
    last_name = models.CharField(max_length=100, null=True, blank=True)
    gender = models.CharField(max_length=20, choices=GENDER_CHOICES, null=True)
    blood_group = models.CharField(max_length=5, choices=BLOOD_GROUP_CHOICES, null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    email = models.EmailField(unique=True, null=True)
    mobile_number = models.CharField(max_length=15, null=True)
    address = models.TextField(null=True, blank=True)
    photo = models.ImageField(upload_to='candidate_photos/', null=True, blank=True)

    # Recruitment Details
    position_applied = models.ForeignKey(Designation, on_delete=models.SET_NULL, null=True, related_name='candidates_applied')
    department_applied = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, related_name='candidates_applied')
    expected_salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    notice_period = models.CharField(max_length=50, null=True, blank=True)
    experience_years = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    qualification = models.CharField(max_length=100, null=True, blank=True)
    skills = models.TextField(null=True, blank=True)
    resume = models.FileField(upload_to='candidate_resumes/', null=True, blank=True)
    interview_date = models.DateTimeField(null=True, blank=True)
    interviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='candidate_interviews')

    # Selection Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='Pending'
    )

    # System Details
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    @property
    def full_name(self):
        if self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.first_name or ""

    def get_absolute_url(self):
        return reverse('candidate_list')

    def __str__(self):
        try:
            position = self.position_applied.name if self.position_applied_id else "No Position"
        except Exception:
            position = "Unknown Position"
        return f"{self.full_name} ({position})"



class Employee(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,null=True)

    company = models.ForeignKey(Company, on_delete=models.CASCADE, null=True, related_name="company_employees")
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, null=True, related_name="branch_employees")
    factory = models.ForeignKey(Factory, on_delete=models.PROTECT, null=True, blank=True, related_name="factory_employees")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, null=True, blank=True, related_name="warehouse_employees")

    dept_designation = models.ForeignKey(DepartmentDesignation, on_delete=models.PROTECT, null=True, related_name="dept_employees")
    
    date_of_joining = models.DateField(default=timezone.now)
    qualifications = models.TextField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    profile_picture = models.ImageField(upload_to='profile_pics/', blank=True, null=True)
    email = models.EmailField(max_length=254, blank=True, null=True)  # Store employee's work email
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='emp_created')
    
    candidate = models.OneToOneField(Candidate, on_delete=models.SET_NULL, null=True, blank=True, related_name='employee_profile')
    bod = models.OneToOneField('BoardOfDirector', on_delete=models.SET_NULL, null=True, blank=True, related_name='employee_profile')

    def get_absolute_url(self):
        return reverse('user_list')

    def __str__(self):
        if self.user:
            return self.user.get_full_name() or self.user.username or self.user.email
        if self.candidate:
            return self.candidate.full_name
        return f"Employee {self.id}"


class EmployeeDepartmentHistory(models.Model):
    employee = models.ForeignKey(
        'Employee',
        on_delete=models.CASCADE,
        related_name='department_history',
        null=True,
        blank=True
    )
    candidate = models.ForeignKey(
        'Candidate',
        on_delete=models.CASCADE,
        related_name='department_history',
        null=True,
        blank=True
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='employee_department_histories'
    )
    designation = models.ForeignKey(
        Designation,
        on_delete=models.CASCADE,
        related_name='employee_designation_histories'
    )
    effective_from = models.DateField()
    remarks = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='emp_dept_histories_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-effective_from', '-id']

    def __str__(self):
        emp_name = str(self.employee or self.candidate or "Unknown")
        return f"{emp_name} - {self.department.name} - {self.designation.name} (from {self.effective_from})"


def sync_employee_department_designation(employee=None, candidate=None, target_date=None):
    """
    Syncs employee's dept_designation with the latest EmployeeDepartmentHistory
    whose effective_from <= target_date.
    Does NOT modify the candidate's original department_applied or position_applied.
    """
    if not employee and candidate:
        try:
            employee = candidate.employee_profile
        except Exception:
            employee = None

    if not employee:
        return

    if target_date is None:
        target_date = timezone.now().date()

    query = models.Q(effective_from__lte=target_date)
    cond = models.Q(employee=employee)
    if employee.candidate:
        cond |= models.Q(candidate=employee.candidate)
    histories = EmployeeDepartmentHistory.objects.filter(cond, query)

    latest_history = histories.order_by('-effective_from', '-id').first()
    if not latest_history:
        return

    dept = latest_history.department
    desig = latest_history.designation
    company = employee.company

    dept_desig = None
    if company:
        dept_desig = DepartmentDesignation.objects.filter(
            company=company,
            department=dept,
            designation=desig
        ).first()

    if not dept_desig:
        dept_desig = DepartmentDesignation.objects.filter(
            department=dept,
            designation=desig
        ).order_by(models.F('company').desc(nulls_last=True), '-level').first()

    if not dept_desig:
        dept_desig = DepartmentDesignation.objects.create(
            company=company,
            department=dept,
            designation=desig,
            level=1
        )

    update_fields = []
    if employee.dept_designation_id != dept_desig.id:
        employee.dept_designation = dept_desig
        update_fields.append('dept_designation')
    if not employee.company_id and dept_desig.company_id:
        employee.company = dept_desig.company
        update_fields.append('company')

    if update_fields:
        employee.save(update_fields=update_fields)




# Using Menu/SubMenu from register_app - imported via ForeignKey when needed



class Holiday(models.Model):
    date = models.DateField(unique=True)
    name = models.CharField(max_length=200)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='user_holiday')

    def get_absolute_url(self):
        return reverse('holiday_list')

    def __str__(self):
        return f"{self.name}"


# Note: MenuPermission is in register_app.models
# Note: Notification is in notifications_app.models  
# Note: Message/Email models are in emails_app


# HR Department


class EmploymentDetails(models.Model):
    EMPLOYMENT_TYPE_CHOICES = [
        ('Full Time', 'Full Time'),
        ('Part Time', 'Part Time'),
        ('Contract', 'Contract'),
    ]
    
    WORK_MODE_CHOICES = [
        ('WFH', 'Work From Home'),
        ('WFO', 'Work From Office'),
        ('FV', 'Field Visit'),
    ]

    user = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name='employment_details',null=True)
    employment_no = models.CharField(max_length=20, unique=True)
    date_of_joining = models.DateField()
    employment_type = models.CharField(max_length=20, choices=EMPLOYMENT_TYPE_CHOICES)
    probation_period = models.CharField(max_length=50, blank=True, null=True)
    notice_period = models.CharField(max_length=50, blank=True, null=True)
    work_mode = models.CharField(max_length=3, choices=WORK_MODE_CHOICES, default='WFO')
    roles = models.ManyToManyField('register_app.Role', blank=True)
    roles_applicable_date = models.DateField(null=True, blank=True)
    function = models.CharField(max_length=100, blank=True, null=True)
    office_location = models.CharField(max_length=100, blank=True, null=True)
    reporting_manager = models.ForeignKey('Employee', on_delete=models.CASCADE, related_name='employee_reporting',null=True)
    ic1_name = models.CharField(max_length=100, blank=True, null=True)
    ic1_relation = models.CharField(max_length=100, blank=True, null=True)
    ic1_number = models.CharField(max_length=50, blank=True, null=True)
    ic2_name = models.CharField(max_length=100, blank=True, null=True)
    ic2_relation = models.CharField(max_length=100, blank=True, null=True)
    ic2_number = models.CharField(max_length=50, blank=True, null=True)

    health_card_validity = models.DateField(blank=True, null=True)
    health_insurance_validity = models.DateField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.full_name} - {self.employment_no}"


class EmployeeRoleExpiry(models.Model):
    """Per-role expiry dates for additional roles assigned to an employee.
    Replaces the old single roles_applicable_date field on EmploymentDetails."""
    employment = models.ForeignKey(
        EmploymentDetails, on_delete=models.CASCADE, related_name='role_expiries'
    )
    role = models.ForeignKey(
        'register_app.Role', on_delete=models.CASCADE, related_name='employee_role_expiries'
    )
    expiry_date = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = ('employment', 'role')
        ordering = ['expiry_date']

    def __str__(self):
        return f"{self.employment} — {self.role.name} (expires {self.expiry_date})"


class EmployeeDocumentUpload(models.Model):
    user = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name='documents',null=True)
    document_type = models.CharField(max_length=100)  # e.g., Offer Letter, ID Proof
    document_file = models.FileField(upload_to='employee_documents/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    is_signed = models.BooleanField(default=False)

    def __str__(self):
        status = "Signed" if self.is_signed else "Not Signed"
        return f"{self.document_type} for {self.user.full_name} - {status}"


class BankDetails(models.Model):
    user = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name='bank_details',null=True)
    bank_name = models.CharField(max_length=100)
    account_no = models.CharField(max_length=20, unique=True)
    ifsc_code = models.CharField(max_length=20)
    mode_of_payment = models.CharField(max_length=50, blank=True, null=True)
    pan_no = models.CharField(max_length=10, unique=True, blank=True, null=True)
    uan_no = models.CharField(max_length=12, unique=True, blank=True, null=True)
    esic_no = models.CharField(max_length=20, unique=True, blank=True, null=True)
    aadhar_no = models.CharField(max_length=20, unique=True, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.full_name} - {self.bank_name}"







# Comment frontend

class Comment(models.Model):
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.phone}"




class BoardOfDirector(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='bod_profile')
    
    name = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20)
    designation = models.ForeignKey(Designation, on_delete=models.SET_NULL, null=True, related_name='bods')
    profile_picture = models.ImageField(upload_to='bod_profiles/', blank=True, null=True)
    
    bank_name = models.CharField(max_length=150, blank=True, null=True)
    account_name = models.CharField(max_length=150, blank=True, null=True)
    account_number = models.CharField(max_length=50, blank=True, null=True)
    ifsc_code = models.CharField(max_length=20, blank=True, null=True)
    branch_name = models.CharField(max_length=150, blank=True, null=True)
    
    pan_number = models.CharField(max_length=20, blank=True, null=True)
    aadhar_number = models.CharField(max_length=20, blank=True, null=True)
    
    is_employee = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class BODIdProof(models.Model):
    bod = models.ForeignKey(BoardOfDirector, on_delete=models.CASCADE, related_name='id_proofs')
    file = models.FileField(upload_to='bod_id_proofs/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"ID Proof for {self.bod.name}"

class EmployeeWorkExperience(models.Model):
    EMPLOYMENT_TYPE_CHOICES = [
        ("FULL_TIME", "Full Time"),
        ("PART_TIME", "Part Time"),
        ("CONTRACT", "Contract"),
        ("TEMPORARY", "Temporary"),
        ("INTERNSHIP", "Internship"),
        ("FREELANCE", "Freelance"),
    ]
    
    employee = models.ForeignKey(
        Candidate,
        on_delete=models.CASCADE,
        related_name="work_experiences"
    )

    company_name = models.CharField(max_length=200)
    designation = models.CharField(max_length=150)
    department = models.CharField(max_length=150, blank=True)

    employment_type = models.CharField(
        max_length=20,
        choices=EMPLOYMENT_TYPE_CHOICES,
        default="FULL_TIME"
    )

    industry = models.CharField(max_length=100, blank=True)
    company_location = models.CharField(max_length=200, blank=True)

    start_date = models.DateField()
    end_date = models.DateField()

    last_drawn_salary = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        blank=True,
        null=True
    )

    responsibilities = models.TextField(blank=True)
    achievements = models.TextField(blank=True)

    notice_period_served = models.BooleanField(default=False)

    experience_certificate = models.FileField(
        upload_to="employee/work_experience/certificates/",
        blank=True,
        null=True
    )

    relieving_letter = models.FileField(
        upload_to="employee/work_experience/relieving_letters/",
        blank=True,
        null=True
    )

    salary_slip = models.FileField(
        upload_to="employee/work_experience/salary_slips/",
        blank=True,
        null=True
    )

    reference_available = models.BooleanField(default=False)
    reference_name = models.CharField(max_length=150, blank=True)
    reference_contact = models.CharField(max_length=150, blank=True)

    verified = models.BooleanField(default=False)
    verification_remarks = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def experience_duration(self):
        if self.start_date and self.end_date:
            return relativedelta(self.end_date, self.start_date)
        return None

    def __str__(self):
        return f"{self.employee} - {self.company_name}"

