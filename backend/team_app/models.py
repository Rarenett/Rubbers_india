from django.db import models
from django.conf import settings
from rarenett_app.models import Department

class Team(models.Model):
    name = models.CharField(max_length=150, unique=True)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="teams")
    lead = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="led_teams")
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="member_teams", blank=True)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.department.name})"
