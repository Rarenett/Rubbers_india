"""
Django ORM models for dynamic_db_app metadata tables.
These models map to the two system tables (dynamic_tables, dynamic_fields)
that were created via raw SQL migration — NOT via makemigrations.
managed = True so Django's ORM can read/write them normally.
"""
from django.db import models
from django.conf import settings


class DynamicTable(models.Model):
    """
    Stores metadata for each user-created dynamic table.
    table_name  — the logical name entered by the admin (e.g. "customer_feedback")
    db_table    — the actual MySQL table name with dyn_ prefix (e.g. "dyn_customer_feedback")
    """
    table_name  = models.CharField(max_length=64, unique=True)
    db_table    = models.CharField(max_length=70, unique=True)
    description = models.TextField(null=True, blank=True)
    created_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_dynamic_tables'
    )
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'dynamic_tables'
        managed  = True
        ordering = ['table_name']

    def __str__(self):
        return self.table_name


class DynamicField(models.Model):
    """
    Stores column metadata for each field in a dynamic table.
    Mirrors the actual MySQL column definition so the UI can reconstruct it.
    """
    DATA_TYPE_CHOICES = [
        ('VARCHAR',   'VARCHAR'),
        ('INT',       'INT'),
        ('BIGINT',    'BIGINT'),
        ('DECIMAL',   'DECIMAL'),
        ('FLOAT',     'FLOAT'),
        ('DATE',      'DATE'),
        ('DATETIME',  'DATETIME'),
        ('TIME',      'TIME'),
        ('BOOLEAN',   'BOOLEAN'),
        ('TEXT',      'TEXT'),
        ('LONGTEXT',  'LONGTEXT'),
    ]

    table         = models.ForeignKey(DynamicTable, on_delete=models.CASCADE, related_name='fields')
    field_name    = models.CharField(max_length=64)
    field_order   = models.SmallIntegerField(default=0)
    data_type     = models.CharField(max_length=20, choices=DATA_TYPE_CHOICES)
    length        = models.IntegerField(null=True, blank=True, help_text='For VARCHAR length')
    precision     = models.IntegerField(null=True, blank=True, help_text='For DECIMAL precision')
    scale         = models.IntegerField(null=True, blank=True, help_text='For DECIMAL scale')
    is_nullable   = models.BooleanField(default=True)
    is_unique     = models.BooleanField(default=False)
    is_primary    = models.BooleanField(default=False)
    auto_increment = models.BooleanField(default=False)
    default_value = models.CharField(max_length=255, null=True, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        db_table   = 'dynamic_fields'
        managed    = True
        ordering   = ['field_order', 'id']
        unique_together = [['table', 'field_name']]

    def __str__(self):
        return f"{self.table.table_name}.{self.field_name}"
