from django.db import models
from django.conf import settings

# Create your models here.

class DutyName(models.Model):
    name = models.CharField(max_length=150)
    remarks = models.TextField(blank=True, null=True)
    
    class Meta:
        verbose_name = "Duty Name"
        verbose_name_plural = "Duty Names"

    def __str__(self):
        return self.name

class Responsibility(models.Model):
    name = models.CharField(max_length=150)
    dutyname = models.ForeignKey(
        DutyName,
        on_delete=models.CASCADE,
        related_name="responsibilities"
    )
    remarks = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name = "Responsibility"
        verbose_name_plural = "Responsibilities"

    def __str__(self):
        return self.name
        
class AssignDutyandResponsibility(models.Model):
    dutyname = models.ForeignKey(
        DutyName,
        on_delete=models.CASCADE,
        related_name="assign_duty_and_responsibilities"
    )
    responsibility = models.ManyToManyField(
        Responsibility,
        related_name="assign_duty_and_responsibilities"
    )
    department_name = models.ManyToManyField(
        'rarenett_app.Department',
        related_name="assign_duty_and_responsibilities"
    )
    person_name = models.ManyToManyField(
        'rarenett_app.Employee',
        related_name="assign_duty_and_responsibilities"
    )
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = "Assign Duty and Responsibility"
        verbose_name_plural = "Assign Duty and Responsibilities"
        ordering = ['dutyname__name']

    def __str__(self):
        return f"{self.dutyname.name} - Multiple Assignments"


class EmployeeDutyStatus(models.Model):
    assignment = models.ForeignKey('AssignDutyandResponsibility', on_delete=models.CASCADE, related_name='duty_statuses')
    employee = models.ForeignKey('rarenett_app.Employee', on_delete=models.CASCADE, related_name='duty_statuses')
    duty_name = models.ForeignKey('DutyName', on_delete=models.CASCADE)
    responsibility = models.ForeignKey('Responsibility', on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    ended_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('assignment', 'employee', 'responsibility')
        verbose_name = 'Employee Duty Status'
        verbose_name_plural = 'Employee Duty Statuses'

    def __str__(self):
        return f"{self.employee} - {self.responsibility} ({'Active' if self.is_active else 'Ended'})"


class CustomerType(models.Model):
    name = models.CharField(max_length=100)
    details_needed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class AbstractHrCustomer(models.Model):
    name = models.CharField(max_length=255)
    address = models.TextField(blank=True, null=True)
    pincode = models.CharField(max_length=20, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    district = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, default='India')
    contact_person = models.CharField(max_length=255, blank=True, null=True)
    contact_number = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    customer_type = models.ForeignKey(CustomerType, on_delete=models.SET_NULL, null=True, blank=True)
    remarks = models.TextField(blank=True, null=True)
    login_required = models.BooleanField(default=False)
    linked_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True

class HrDistributor(AbstractHrCustomer):
    pass

class HrVendor(AbstractHrCustomer):
    pass

class HrOtherCustomer(AbstractHrCustomer):
    pass


class ResponsibilityReminderMaster(models.Model):
    responsibility = models.ForeignKey(Responsibility, on_delete=models.CASCADE, related_name='reminders')
    department = models.ForeignKey('rarenett_app.Department', on_delete=models.CASCADE, related_name='responsibility_reminders')
    employees = models.ManyToManyField('rarenett_app.Employee', related_name='responsibility_reminders')
    start_date = models.DateField()
    end_date = models.DateField()
    frequency_days = models.PositiveIntegerField()
    remind_me_before = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Responsibility Reminder Master"
        verbose_name_plural = "Responsibility Reminders Master"
        ordering = ['start_date']

    def __str__(self):
        return f"Master: {self.responsibility.name} ({self.start_date})"

class ResponsibilityReminderDetail(models.Model):
    master = models.ForeignKey(ResponsibilityReminderMaster, on_delete=models.CASCADE, related_name='details')
    reminder_date = models.DateField()
    is_acknowledged = models.BooleanField(default=False)

    class Meta:
        ordering = ['reminder_date']

    def __str__(self):
        return f"Detail: {self.master.responsibility.name} on {self.reminder_date}"

class ResponsibilityUpdate(models.Model):
    reminder = models.ForeignKey(ResponsibilityReminderDetail, on_delete=models.CASCADE, related_name='updates')
    employee = models.ForeignKey('rarenett_app.Employee', on_delete=models.CASCADE, related_name='responsibility_updates')
    update_date = models.DateField()
    remarks = models.TextField()
    file_upload = models.FileField(upload_to='responsibility_updates/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Responsibility Update"
        verbose_name_plural = "Responsibility Updates"
        ordering = ['-created_at']

    def __str__(self):
        return f"Update for {self.reminder.master.responsibility.name} by {self.employee.id}"
