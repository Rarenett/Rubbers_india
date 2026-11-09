from django.db import models
from django.conf import settings
from rarenett_app.models import Department, Designation

class Appointment(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='created_appointments',
        null=True,
        blank=True,
    )
    department = models.ForeignKey(
        Department, 
        on_delete=models.CASCADE, 
        related_name='appointments',
        null=True,
        blank=True,
    )
    designation = models.ForeignKey(
        Designation, 
        on_delete=models.CASCADE, 
        related_name='appointments'
    )
    visitor_category = models.ForeignKey(
        'gate_app.GateCategory',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='appointments'
    )
    concerned_staff = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='assigned_appointments',
        null=True,
        blank=True,
    )
    contact_person = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='contact_person_appointments',
        null=True,
        blank=True
    )
    contact_number = models.CharField(max_length=20, null=True, blank=True)
    
    visitor = models.ForeignKey(
        'gate_app.Visitor',
        on_delete=models.CASCADE,
        related_name='appointments',
        null=True,
        blank=True
    )
    vehicle = models.ForeignKey(
        'gate_app.Vehicle',
        on_delete=models.CASCADE,
        related_name='appointments',
        null=True,
        blank=True
    )
    
    # Keeping these for backward compatibility or caching
    visitor_name = models.CharField(max_length=255, blank=True, null=True)
    visitor_phone = models.CharField(max_length=20, blank=True, null=True)
    vehicle_number = models.CharField(max_length=255, blank=True, null=True)
    purpose_of_visit = models.TextField()
    
    appointment_date = models.DateField()
    appointment_time = models.TimeField()
    
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='pending'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-appointment_date', '-appointment_time']

    def __str__(self):
        v_name = self.visitor_name
        if self.visitor:
            v_name = self.visitor.visitor_name
        elif self.vehicle:
            v_name = self.vehicle.vehicle_number
        elif self.vehicle_number:
            v_name = self.vehicle_number
            
        staff_name = self.concerned_staff.get_full_name() if self.concerned_staff else "Unknown Staff"
        return f"Appointment for {v_name} with {staff_name}"
