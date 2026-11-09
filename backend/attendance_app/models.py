from django.db import models
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from rarenett_app.models import Employee
from register_app.models import CustomUser

# Create your models here.

class LeaveType(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=30, unique=True)
    is_paid = models.BooleanField(default=True)
    annual_limit = models.DecimalField(max_digits=6, decimal_places=2, default=0)

    is_cumulative = models.BooleanField(default=False)
    max_limit = models.IntegerField(default=0)
    can_surrender = models.BooleanField(default=False)
    apply_before_days = models.IntegerField(default=0)

    need_approval = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'attendance_app_leavetype'
        verbose_name = 'Leave Type'
        verbose_name_plural = 'Leave Types'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code})"


class LeaveRequest(models.Model):
    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("FORWARDED", "Forwarded"),
        ("APPROVED", "Approved"),
        ("PARTIALLY_APPROVED", "Partially Approved"),
        ("REJECTED", "Rejected"),
        ("CANCELLED", "Cancelled"),
    ]

    EMPLOYEE_DECISION_CHOICES = [
        ("PENDING", "Pending"),
        ("ACCEPTED", "Accepted"),
        ("DECLINED", "Declined"),
    ]

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="leave_requests")
    leave_type = models.ForeignKey(LeaveType, on_delete=models.PROTECT, related_name="leave_requests")
    total_days = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")

    # Current reviewer / assigned recipient (e.g. reporting manager or forwarded user)
    current_handler = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="received_leave_requests"
    )

    # Final approval
    approved_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_leave_requests")
    approved_at = models.DateTimeField(null=True, blank=True)
    decision_remarks = models.TextField(null=True, blank=True)

    # Employee response to approved leave
    employee_decision = models.CharField(
        max_length=20,
        choices=EMPLOYEE_DECISION_CHOICES,
        null=True,
        blank=True,
        default=None
    )
    employee_accepted_at = models.DateTimeField(null=True, blank=True)
    employee_declined_at = models.DateTimeField(null=True, blank=True)
    employee_decline_reason = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        emp_name = str(self.employee) if self.employee else 'Unknown'
        return f"{emp_name} - {self.leave_type} ({self.status})"


class LeaveRequestDate(models.Model):
    DATE_STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
    ]

    leave_request = models.ForeignKey(LeaveRequest, on_delete=models.CASCADE, related_name="leave_dates")
    date = models.DateField()
    status = models.CharField(max_length=20, choices=DATE_STATUS_CHOICES, default="PENDING")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["leave_request", "date"],
                name="unique_leave_request_date"
            )
        ]
        ordering = ["date"]

    def __str__(self):
        return f"{self.leave_request} - {self.date}"


class LeaveRequestForwarding(models.Model):
    leave_request = models.ForeignKey(LeaveRequest, on_delete=models.CASCADE, related_name="forwarding_history")
    forwarded_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, related_name="leave_requests_forwarded")
    forwarded_to = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, related_name="leave_requests_received")
    forwarded_at = models.DateTimeField(auto_now_add=True)
    remarks = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["forwarded_at"]

    def __str__(self):
        return (
            f"{self.leave_request} - "
            f"{self.forwarded_by} → {self.forwarded_to}"
        )


class LeaveRequestDocument(models.Model):
    leave_request = models.ForeignKey(
        LeaveRequest,
        on_delete=models.CASCADE,
        related_name="documents"
    )
    file = models.FileField(upload_to="leave_documents/")
    original_name = models.CharField(max_length=255, blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'attendance_app_leaverequestdocument'
        ordering = ['id']

    def __str__(self):
        return self.original_name or str(self.file.name)


class EmployeeLeaveType(models.Model):
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="employee_leave_types"
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.CASCADE,
        related_name="employee_mappings"
    )
    effective_from = models.DateField()
    annual_limit = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Custom annual limit for this employee. Defaults to leave_type.annual_limit if not specified."
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'attendance_app_employeeleavetype'
        ordering = ['-effective_from', 'leave_type__name', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['employee', 'leave_type', 'effective_from'],
                name='unique_employee_leave_type_effective'
            )
        ]
        verbose_name = 'Employee Leave Type'
        verbose_name_plural = 'Employee Leave Types'

    def __str__(self):
        return f"{self.employee} - {self.leave_type.name} (Effective: {self.effective_from})"


class EmployeeLeaveTransaction(models.Model):
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="leave_transactions"
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.CASCADE,
        related_name="leave_transactions"
    )
    date = models.DateField()
    IN = models.DecimalField(max_digits=7, decimal_places=2, default=0.0)
    OUT = models.DecimalField(max_digits=7, decimal_places=2, default=0.0)
    is_approved = models.BooleanField(default=False)

    employee_leave_type = models.ForeignKey(
        EmployeeLeaveType,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="transactions"
    )
    leave_request = models.ForeignKey(
        LeaveRequest,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="transactions"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'attendance_app_employeeleavetransaction'
        ordering = ['-date', '-id']
        verbose_name = 'Employee Leave Transaction'
        verbose_name_plural = 'Employee Leave Transactions'

    def __str__(self):
        emp_name = str(self.employee) if self.employee else 'Unknown'
        lt_name = self.leave_type.name if self.leave_type else 'Unknown'
        return f"{emp_name} - {lt_name} on {self.date}: IN={self.IN}, OUT={self.OUT}"


@receiver(post_save, sender=EmployeeLeaveType)
def sync_employee_leave_transaction_on_save(sender, instance, created, **kwargs):
    annual_limit = 0.0
    if instance.annual_limit is not None:
        annual_limit = instance.annual_limit
    elif instance.leave_type_id:
        try:
            leave_type = instance.leave_type
            annual_limit = leave_type.annual_limit or 0.0
        except Exception:
            annual_limit = 0.0

    EmployeeLeaveTransaction.objects.update_or_create(
        employee_leave_type=instance,
        defaults={
            'employee_id': instance.employee_id,
            'leave_type_id': instance.leave_type_id,
            'date': instance.effective_from,
            'IN': annual_limit,
            'OUT': 0.0,
            'is_approved': False,
        }
    )


@receiver(post_delete, sender=EmployeeLeaveType)
def cleanup_employee_leave_transaction_on_delete(sender, instance, **kwargs):
    EmployeeLeaveTransaction.objects.filter(employee_leave_type=instance).delete()
