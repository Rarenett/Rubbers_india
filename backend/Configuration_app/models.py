from django.db import models

class DynamicTableConfiguration(models.Model):
    table_name = models.CharField(max_length=255)
    form_name = models.CharField(max_length=255)
    settings = models.JSONField(default=dict, blank=True)

    class Meta:
        unique_together = ('table_name', 'form_name')
        verbose_name = "Dynamic Table Configuration"
        verbose_name_plural = "Dynamic Table Configurations"

    def __str__(self):
        return f"{self.table_name} Configuration"
