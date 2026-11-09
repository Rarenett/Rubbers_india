from django.db import models
from django.conf import settings

import uuid

STATUS_CHOICES = [
    ('Pending', 'Pending'),
    ('In Progress', 'In Progress'),
    ('Resolved', 'Resolved'),
    ('Closed', 'Closed'),
]

PRIORITY_CHOICES = [
    ('Low', 'Low'),
    ('Medium', 'Medium'),
    ('High', 'High'),
    ('Critical', 'Critical'),
]

class ComplaintCategory(models.Model):
    category_code = models.CharField(max_length=50, unique=True, blank=True, null=True)
    category_name = models.CharField(max_length=150, unique=True, null=True, blank=True)
    narration = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    def __str__(self):
        return f"{self.category_code} - {self.category_name}"

    class Meta:
        verbose_name_plural = "Complaint Categories"


       
class PatternType(models.TextChoices):
    SINGLE = "Single", "Single"
    MULTIPLE = "Multiple", "Multiple"
    HOD = "HOD", "HOD"
    BOD = "BOD", "BOD"
    ASSIGN = "Assign", "Assign"
class Pattern(models.Model):
    pattern_no = models.CharField(max_length=50, unique=True, null=True, blank=True)
    category = models.ForeignKey(ComplaintCategory, on_delete=models.CASCADE, null=True, blank=True, related_name='patterns')
    pattern_head = models.CharField(max_length=150, null=True, blank=True)
    cutoff_days = models.PositiveIntegerField(default=0, null=True, blank=True)
    pattern_type = models.CharField(max_length=50, choices=PatternType.choices, null=True, blank=True)

    # Selection mode (Single/Multiple/HOD/BOD) used specifically for the Final Decision
    # Makers (evaluators) list — independent of pattern_type, which governs routing.

    decision_type = models.CharField(max_length=50, choices=PatternType.choices, default='Single', null=True, blank=True)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='Medium', null=True, blank=True)
    is_active = models.BooleanField(default=True, null=True, blank=True)
    
    departments = models.ManyToManyField('rarenett_app.Department', blank=True, related_name='comment_patterns')
    designations = models.ManyToManyField('rarenett_app.Designation', blank=True, related_name='comment_patterns')
    employees = models.ManyToManyField('rarenett_app.Employee', blank=True, related_name='comment_patterns')

    # Departments used to filter the FINAL DECISION MAKERS (evaluators) employee list below.
    # Independent of the `departments` field above, which filters routing/responder employees.

    decision_departments = models.ManyToManyField('rarenett_app.Department', blank=True, related_name='decision_department_patterns')

    # Employees allowed to make the FINAL decision/evaluation (Admin Decision) for
    # complaints raised under this category + pattern. Independent of the
    # departments/designations/employees fields above, which govern routing to responders.
    
    decision_makers = models.ManyToManyField('rarenett_app.Employee', blank=True, related_name='final_decision_patterns')
    
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    def __str__(self):
        return f"{self.pattern_no} - {self.pattern_head}"

    class Meta:
        verbose_name_plural = "Patterns"
        ordering = ['-created_at']   

        
class Complaint(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='complaints', null=True, blank=True)
    category = models.ForeignKey(ComplaintCategory, on_delete=models.CASCADE, null=True, blank=True)
    pattern = models.ForeignKey(Pattern, on_delete=models.SET_NULL, null=True, blank=True, related_name='complaints')
    title = models.CharField(max_length=200, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending', null=True, blank=True)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='Medium', null=True, blank=True)
    attachment = models.FileField(upload_to='complaints/', blank=True, null=True)
    
    # Tracking
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_complaints')
    
    # Decision Workflow Fields
    positive_feedback = models.TextField(null=True, blank=True)
    negative_feedback = models.TextField(null=True, blank=True)
    decision_type = models.CharField(max_length=20, choices=[('Yes', 'Yes'), ('No', 'No'), ('Neutral', 'Neutral')], null=True, blank=True)
    responder_remarks = models.TextField(null=True, blank=True)
    responder_attachment = models.FileField(upload_to='complaint_responses/', null=True, blank=True)

    ADMIN_DECISION_CHOICES = (
        ('Pending', 'Pending'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
        ('On Hold', 'On Hold'),
    )
    admin_decision = models.CharField(max_length=20, choices=ADMIN_DECISION_CHOICES, default='Pending', null=True, blank=True)
    admin_remarks = models.TextField(null=True, blank=True)

    cutoff_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    def __str__(self):
        return f"#{self.id} - {self.title}"

class ComplaintUpdate(models.Model):
    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE, related_name='updates', null=True, blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)
    remark = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, null=True, blank=True)
    attachment = models.FileField(upload_to='complaint_updates/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    def __str__(self):
        return f"Update for Complaint #{self.complaint.id} by {self.user.email}"

class CommentAction(models.Model):
    DECISION_CHOICES = [
        ('YES', 'YES'),
        ('NO', 'NO'),
        ('NEUTRAL', 'NEUTRAL'),
    ]

    complaint_post = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name="actions",
        null=True,
        blank=True
    )

    comment_name = models.CharField(max_length=255, null=True, blank=True)

    positive_feedback = models.TextField(blank=True, null=True)
    negative_feedback = models.TextField(blank=True, null=True)

    decision = models.CharField(max_length=10, choices=DECISION_CHOICES, null=True, blank=True)
    notes = models.TextField(blank=True, null=True)

    supporting_document = models.FileField(upload_to="complaint_docs/", blank=True, null=True)
    cutoff_date = models.DateField(null=True, blank=True)
    narration = models.TextField(blank=True, null=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    

    @property
    def pattern_details(self):
        if self.complaint_post and self.complaint_post.pattern:
            return self.complaint_post.pattern
        return None

    @property
    def designations_list(self):
        pattern = self.pattern_details
        if pattern:
            return pattern.designations.all()
        return []

    @property
    def designation_ids(self):
        ids = [str(d.id) for d in self.designations_list]
        return ", ".join(ids) if ids else "-"

    def __str__(self):
        if self.complaint_post and self.complaint_post.pattern:
            return f"Action on {self.complaint_post.pattern.pattern_no} - {self.comment_name}"
        return f"Action - {self.comment_name}"

class PriorityRule(models.Model):
    PRIORITY_LEVEL_CHOICES = [
        ('Low', 'Low'),
        ('Medium', 'Medium'),
        ('High', 'High'),
        ('Critical', 'Critical'),
    ]

    rule_name = models.CharField(max_length=150, unique=True, null=True, blank=True)
    priority_level = models.CharField(max_length=20, choices=PRIORITY_LEVEL_CHOICES, default='Medium', null=True, blank=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    def __str__(self):
        return f"{self.rule_name} ({self.priority_level})"

    class Meta:
        verbose_name_plural = "Priority Rules"
        ordering = ['priority_level', '-created_at']
