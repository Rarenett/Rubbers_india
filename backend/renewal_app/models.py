from django.db import models
from django.conf import settings
from django.utils import timezone


class RenewalSubject(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_renewal_subjects'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class RenewalReminder(models.Model):
    branch = models.ForeignKey(
        'settings_app.Branch',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='renewal_reminders'
    )
    renewal_subject = models.ForeignKey(
        RenewalSubject,
        on_delete=models.PROTECT,
        related_name='reminders'
    )
    name = models.CharField(max_length=255)
    department = models.ForeignKey(
        'rarenett_app.Department',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='renewal_reminders'
    )
    allocated_to = models.ManyToManyField(
        'rarenett_app.Employee',
        blank=True,
        related_name='assigned_renewal_reminders'
    )
    renewal_date = models.DateField(null=True, blank=True)
    reminder_days = models.PositiveIntegerField(default=30)
    remarks = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    status = models.IntegerField(default=1, db_index=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_renewal_reminders'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-renewal_date', '-id']

    def __str__(self):
        return f"{self.name} ({self.renewal_subject.name})"
