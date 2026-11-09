from django.db import models
from django_countries.fields import CountryField
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal
import pytz


# Create your models here.

class Currency(models.Model):
    code = models.CharField(max_length=3, unique=True, null=True)
    name = models.CharField(max_length=100, null=True)
    symbol = models.CharField(max_length=10, null=True)
    decimal_places = models.PositiveIntegerField(default=2, null=True)
    country = CountryField(blank_label="Select Country", blank=True, null=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['code']
        verbose_name_plural = "Currencies"

    def __str__(self):
        return f"{self.code} - {self.name}"
    

class ExchangeRate(models.Model):
    from_currency = models.ForeignKey(Currency, on_delete=models.CASCADE, null=True, related_name='rates_from')
    to_currency = models.ForeignKey(Currency, on_delete=models.CASCADE, null=True, related_name='rates_to')
    rate = models.DecimalField(max_digits=18, decimal_places=6, null=True)
    effective_date = models.DateField(default=timezone.now, null=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-effective_date']
        unique_together = ('from_currency', 'to_currency', 'effective_date')
        verbose_name = "Exchange Rate"
        verbose_name_plural = "Exchange Rates"

    def clean(self):
        # Prevent same currency conversion (USD → USD)
        if self.from_currency == self.to_currency:
            raise ValidationError("From Currency and To Currency cannot be the same.")

        # Rate must be positive
        if self.rate <= Decimal('0'):
            raise ValidationError("Exchange rate must be greater than zero.")

    def __str__(self):
        return f"1 {self.from_currency.code} = {self.rate} {self.to_currency.code} ({self.effective_date})"
    

class Language(models.Model):
    country = CountryField(blank_label="Select Country", blank=True, null=True)
    code = models.CharField(max_length=10, unique=True, null=True)
    name = models.CharField(max_length=100, null=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = "Languages"

    def __str__(self):
        return f"{self.name} ({self.code})"
    

class Company(models.Model):
    name = models.CharField(max_length=255)
    display_name = models.CharField(max_length=255, null=True, blank=True)
    company_code = models.CharField(max_length=50, unique=True)
    registration_no = models.CharField(max_length=100, null=True, blank=True)
    gst_no = models.CharField(max_length=50, null=True, blank=True)
    pan_no = models.CharField(max_length=50, null=True, blank=True)
    logo = models.FileField(upload_to='company_logos/', null=True, blank=True)
    website = models.URLField(null=True, blank=True)
    default_currency = models.ForeignKey(Currency, on_delete=models.SET_NULL, null=True, blank=True, related_name='companies')
    default_language = models.ForeignKey(Language, on_delete=models.SET_NULL, null=True, blank=True, related_name='companies')
    country = CountryField(blank_label="Select Country", blank=True, null=True)
    description = models.TextField(null=True, blank=True)
    vision = models.TextField(null=True, blank=True)
    mission = models.TextField(null=True, blank=True)

    letterhead = models.ImageField(
        upload_to='company_letterheads/',
        null=True,
        blank=True,
        help_text="Upload company letterhead image for document exports"
    )

    title_logo = models.ImageField(
        upload_to='company_title_logos/',
        null=True,
        blank=True,
        help_text="Upload company title logo (used in document headers/reports)"
    )

    
    TIMEZONE_CHOICES = tuple(zip(pytz.common_timezones, pytz.common_timezones))
    timezone = models.CharField(max_length=50, choices=TIMEZONE_CHOICES, default='UTC')
    
    DATE_FORMAT_CHOICES = (
        ('DD/MM/YYYY', 'DD/MM/YYYY'),
        ('MM/DD/YYYY', 'MM/DD/YYYY'),
        ('YYYY-MM-DD', 'YYYY-MM-DD'),
        ('DD-MM-YYYY', 'DD-MM-YYYY'),
        ('DD MMM YYYY', 'DD MMM YYYY'),
    )
    date_format = models.CharField(max_length=20, choices=DATE_FORMAT_CHOICES, default='DD/MM/YYYY')

    login_panel_color = models.CharField(
        max_length=20,
        default='#1a3a72',
        blank=True,
        help_text="Hex colour for the login page left panel overlay"
    )

    # Dashboard theme colours (persisted so they survive across browsers/devices)
    theme_nav_header_color = models.CharField(max_length=20, default='#2bc155', blank=True)
    theme_header_color     = models.CharField(max_length=20, default='#2bc155', blank=True)
    theme_sidebar_color    = models.CharField(max_length=20, default='#2bc155', blank=True)
    theme_sidebar_font_color = models.CharField(max_length=20, default='', blank=True)
    theme_primary_color    = models.CharField(max_length=20, default='#2bc155', blank=True)
    theme_bg_color         = models.CharField(max_length=20, default='',        blank=True)
    theme_font_color       = models.CharField(max_length=20, default='',        blank=True)
    theme_form_icon_color  = models.CharField(max_length=20, default='#2bc155', blank=True)
    theme_version          = models.CharField(max_length=10, default='light',   blank=True)

    has_branches = models.BooleanField(
        default=True,
        help_text="If unchecked, a default Branch and Factory will be automatically created using the company name."
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Companies"
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.company_code})"


class CompanyAddress(models.Model):

    ADDRESS_TYPES = (
        ('registered', 'Registered Office'),
        ('corporate', 'Corporate Office'),
        ('billing', 'Billing Address'),
        ('shipping', 'Shipping Address'),
        ('headquarters', 'HeadQuarters'),  
        ('other', 'Other'), 
    )

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='addresses',null=True,blank=True
    )

    address_type = models.CharField(
        max_length=20,
        choices=ADDRESS_TYPES
    )

    address_line_1 = models.CharField(max_length=255)
    address_line_2 = models.CharField(max_length=255, blank=True, null=True)

    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    pincode = models.CharField(max_length=20)

    is_default = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Company Address"
        verbose_name_plural = "Company Addresses"

    def __str__(self):
        return f"{self.company.display_name} - {self.get_address_type_display()}"   


class CompanyContact(models.Model):

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='contacts',null=True,blank=True
    )

    email = models.EmailField()

    phone = models.CharField(max_length=20)

    mobile = models.CharField(
        max_length=20,
        blank=True,
        null=True
    )

    support_email = models.EmailField(
        blank=True,
        null=True
    )

    is_primary = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Company Contact"
        verbose_name_plural = "Company Contacts"

    def clean(self):
        # Ensure only one primary contact per company
        if self.is_primary:
            exists = CompanyContact.objects.filter(
                company=self.company,
                is_primary=True
            ).exclude(pk=self.pk).exists()

            if exists:
                raise ValidationError("Primary contact already exists for this company.")

    def __str__(self):
        return f"{self.company.display_name} - {self.email}"
    

class CompanyFinancialYear(models.Model):

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='financial_years',null=True,blank=True
    )

    start_date = models.DateField()
    end_date = models.DateField()

    is_active = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('company', 'start_date', 'end_date')
        ordering = ['-start_date']
        verbose_name = "Company Financial Year"
        verbose_name_plural = "Company Financial Years"

    def save(self, *args, **kwargs):
        if self.is_active and self.company_id:
            CompanyFinancialYear.objects.filter(company_id=self.company_id, is_active=True).exclude(pk=self.pk).update(is_active=False)
        super().save(*args, **kwargs)

    def clean(self):
        # Ensure start_date < end_date
        if self.start_date >= self.end_date:
            raise ValidationError("Start date must be before end date.")

        # Prevent overlapping financial years for same company
        overlapping = CompanyFinancialYear.objects.filter(
            company=self.company,
            start_date__lte=self.end_date,
            end_date__gte=self.start_date
        ).exclude(pk=self.pk).exists()

        if overlapping:
            raise ValidationError("Financial year overlaps with an existing one.")

    def __str__(self):
        return f"{self.company.display_name} ({self.start_date} - {self.end_date})"


class Branch(models.Model):

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='branches',null=True,blank=True
    )

    name = models.CharField(max_length=255)

    branch_code = models.CharField(max_length=3)

    gst_number = models.CharField(
        max_length=50,
        blank=True,
        null=True
    )

    country = CountryField(blank_label="Select Country", blank=True, null=True)

    default_currency = models.ForeignKey(
        Currency,
        on_delete=models.PROTECT
    )

    timezone = models.CharField(
        max_length=100,
        choices=[(tz, tz) for tz in pytz.all_timezones],
        default='Asia/Kolkata'
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('company', 'branch_code')
        ordering = ['name']
        verbose_name = "Branch"
        verbose_name_plural = "Branches"

    def clean(self):
        if self.timezone not in pytz.all_timezones:
            raise ValidationError("Invalid timezone selected.")

    def __str__(self):
        return f"{self.name} ({self.company.display_name})"
    

class BranchAddress(models.Model):

    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name='addresses'
    )

    address_line_1 = models.CharField(max_length=255)
    address_line_2 = models.CharField(max_length=255, blank=True, null=True)

    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    pincode = models.CharField(max_length=20)

    is_default = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Branch Address"
        verbose_name_plural = "Branch Addresses"

    def clean(self):
        if self.is_default:
            exists = BranchAddress.objects.filter(
                branch=self.branch,
                is_default=True
            ).exclude(pk=self.pk).exists()

            if exists:
                raise ValidationError("Default address already exists for this branch.")

    def __str__(self):
        return f"{self.branch.name} - {self.city}"
    

class BranchContact(models.Model):

    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name='contacts'
    )

    email = models.EmailField()
    phone = models.CharField(max_length=20)

    mobile = models.CharField(max_length=20, blank=True, null=True)

    is_primary = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Branch Contact"
        verbose_name_plural = "Branch Contacts"

    def clean(self):
        if self.is_primary:
            exists = BranchContact.objects.filter(
                branch=self.branch,
                is_primary=True
            ).exclude(pk=self.pk).exists()

            if exists:
                raise ValidationError("Primary contact already exists for this branch.")

    def __str__(self):
        return f"{self.branch.name} - {self.email}"
    

class BranchBankAccount(models.Model):

    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name='bank_accounts'
    )

    bank_name = models.CharField(max_length=255)

    branch_name = models.CharField(max_length=255, blank=True, null=True)

    account_holder_name = models.CharField(max_length=255)

    account_number = models.CharField(max_length=100)

    ifsc_code = models.CharField(max_length=50, blank=True, null=True)
    swift_code = models.CharField(max_length=50, blank=True, null=True)

    is_primary = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Branch Bank Account"
        verbose_name_plural = "Branch Bank Accounts"

    def clean(self):
        if self.is_primary:
            exists = BranchBankAccount.objects.filter(
                branch=self.branch,
                is_primary=True
            ).exclude(pk=self.pk).exists()

            if exists:
                raise ValidationError("Primary bank account already exists for this branch.")

    def __str__(self):
        return f"{self.branch.name} - {self.bank_name}"


class Factory(models.Model):

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='factories',null=True,blank=True
    )

    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name='factories',
        null=True,
        blank=True
    )

    name = models.CharField(max_length=255)

    factory_code = models.CharField(max_length=50)

    license_number = models.CharField(
        max_length=100,
        blank=True,
        null=True
    )

    timezone = models.CharField(
        max_length=100,
        choices=[(tz, tz) for tz in pytz.all_timezones],
        blank=True,
        null=True
    )

    is_active = models.BooleanField(default=True)
    allowed_lunch_minutes = models.PositiveIntegerField(default=30, blank=True, null=True)
    allowed_tea_minutes = models.PositiveIntegerField(default=15, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('company', 'branch', 'factory_code')
        ordering = ['name']
        verbose_name = "Factory"
        verbose_name_plural = "Factories"

    def clean(self):
        # Ensure factory belongs to same company as branch
        if self.branch and self.company:
            if self.branch.company != self.company:
                raise ValidationError("Factory company must match branch company.")

        # Validate timezone if provided
        if self.timezone and self.timezone not in pytz.all_timezones:
            raise ValidationError("Invalid timezone selected.")

    def __str__(self):
        if self.branch:
            return f"{self.name} ({self.branch.name})"
        if self.company:
            return f"{self.name} ({self.company.display_name or self.company.name})"
        return self.name


class FactoryAddress(models.Model):

    factory = models.ForeignKey(
        Factory,
        on_delete=models.CASCADE,
        related_name='addresses'
    )

    address_line_1 = models.CharField(max_length=255)
    address_line_2 = models.CharField(max_length=255, blank=True, null=True)

    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    pincode = models.CharField(max_length=20)

    is_default = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Factory Address"
        verbose_name_plural = "Factory Addresses"

    def clean(self):
        if self.is_default:
            exists = FactoryAddress.objects.filter(
                factory=self.factory,
                is_default=True
            ).exclude(pk=self.pk).exists()

            if exists:
                raise ValidationError("Default address already exists for this factory.")

    def __str__(self):
        return f"{self.factory.name} - {self.city}"
    

class FactoryContact(models.Model):

    factory = models.ForeignKey(
        Factory,
        on_delete=models.CASCADE,
        related_name='contacts'
    )

    email = models.EmailField(blank=True, null=True)

    phone = models.CharField(max_length=20, blank=True, null=True)

    manager_name = models.CharField(max_length=255, blank=True, null=True)

    is_primary = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Factory Contact"
        verbose_name_plural = "Factory Contacts"

    def clean(self):
        if self.is_primary:
            exists = FactoryContact.objects.filter(
                factory=self.factory,
                is_primary=True
            ).exclude(pk=self.pk).exists()

            if exists:
                raise ValidationError("Primary contact already exists for this factory.")

    def __str__(self):
        return f"{self.factory.name} - {self.manager_name or self.email}"


class Warehouse(models.Model):

    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='warehouses',null=True,blank=True
    )

    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name='warehouses',
        blank=True,
        null=True
    )

    factory = models.ForeignKey(
        Factory,
        on_delete=models.CASCADE,
        related_name='warehouses',
        blank=True,
        null=True
    )

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)

    total_capacity = models.DecimalField(max_digits=15, decimal_places=2)

    capacity_unit = models.CharField(
        max_length=20,
        choices=[
            ('kg', 'Kilograms'),
            ('ton', 'Tons'),
            ('litre', 'Litres'),
            ('m3', 'Cubic Meter'),
            ('units', 'Units'),
        ]
    )

    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(
        default=False,
        help_text="Mark this warehouse as the system-wide default. Only one warehouse can be default at a time."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'code'],
                name='unique_company_warehouse_code'
            )
        ]
        ordering = ['name']

    def save(self, *args, **kwargs):
        if self.is_default:
            # Ensure no other warehouse is set as default
            Warehouse.objects.exclude(pk=self.pk).filter(is_default=True).update(is_default=False)
        super().save(*args, **kwargs)

    def clean(self):

        # Case 1: Company-level warehouse
        if not self.branch and not self.factory:
            return

        # Case 2: Branch-level warehouse
        if self.branch and not self.factory:
            if self.branch.company != self.company:
                raise ValidationError("Branch must belong to selected company.")
            return

        # Case 3: Factory-level warehouse
        if self.factory:
            if self.factory.company != self.company:
                raise ValidationError("Factory must belong to selected company.")
            if self.branch and self.factory.branch != self.branch:
                raise ValidationError("Factory does not belong to selected branch.")

        # Prevent branch empty but factory filled
        if self.factory and not self.branch:
            raise ValidationError("Branch must be selected when factory is selected.")

    def __str__(self):
        return f"{self.name} ({self.company.display_name})"


class WarehouseAddress(models.Model):

    warehouse = models.OneToOneField(
        Warehouse,
        on_delete=models.CASCADE,
        related_name='address'
    )

    address_line_1 = models.CharField(max_length=255)
    address_line_2 = models.CharField(max_length=255, blank=True, null=True)

    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    pincode = models.CharField(max_length=20)

    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        # Only allow address if warehouse is company-level
        if self.warehouse.branch or self.warehouse.factory:
            raise ValidationError(
                "Address is allowed only for company-level warehouses."
            )

    def __str__(self):
        return f"{self.warehouse.name} Address"
    

class WarehouseContact(models.Model):

    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name='contacts'
    )

    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    contact_person = models.CharField(max_length=255, blank=True, null=True)

    is_primary = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        if self.is_primary:
            exists = WarehouseContact.objects.filter(
                warehouse=self.warehouse,
                is_primary=True
            ).exclude(pk=self.pk).exists()

            if exists:
                raise ValidationError(
                    "Primary contact already exists for this warehouse."
                )

    def __str__(self):
        return f"{self.warehouse.name} - {self.contact_person or self.email}"


class PrefixType(models.Model):
    type_name = models.CharField(max_length=100, unique=True)
    subtype = models.ForeignKey(
        'finance_app.VoucherType',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='prefix_types'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['type_name']
        verbose_name = "Prefix Type"
        verbose_name_plural = "Prefix Types"

    def __str__(self):
        return self.type_name


class PrefixConfiguration(models.Model):
    voucher_type = models.ForeignKey(
        'finance_app.VoucherType',
        on_delete=models.PROTECT,
        related_name='prefix_configurations',
        null=True,
        blank=True
    )
    prefix = models.CharField(max_length=3)
    number_padding = models.PositiveIntegerField(
        help_text="Number of digits (e.g. 4 means 0001, 0002, ...)"
    )
    starting_number = models.PositiveIntegerField(default=1)
    postfix = models.CharField(max_length=50, blank=True, null=True)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name='prefix_configurations',
        null=True,
        blank=True
    )
    applicable_date = models.DateField(null=True, blank=True)
    ledger = models.ForeignKey(
        'finance_app.Ledger',
        on_delete=models.PROTECT,
        related_name='prefix_configurations',
        null=True,
        blank=True
    )
    gst_ledger = models.ManyToManyField(
        'finance_app.Ledger',
        related_name='gst_prefix_configurations',
        blank=True
    )
    subvoucher_type = models.ForeignKey(
        PrefixType,
        on_delete=models.PROTECT,
        related_name='prefix_configurations',
        null=True,
        blank=True
    )
    sub_type = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Sub-type name for the prefix (e.g. B2B, B2C, IGST or Stock Journal type)"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['voucher_type', 'prefix']
        verbose_name = "Prefix Configuration"
        verbose_name_plural = "Prefix Configurations"

    def clean(self):
        from django.core.exceptions import ValidationError
        total_length = len(self.prefix or '') + (self.number_padding or 0) + len(self.postfix or '')
        if total_length > 15:
            raise ValidationError("The total length of the final code generated should be maximum 15.")

    def __str__(self):
        sub_part = f" ({self.subvoucher_type})" if self.subvoucher_type else ""
        vtype = self.voucher_type.name if self.voucher_type else "Unknown"
        return f"{vtype}{sub_part} - {self.prefix}"


class DatabaseBackupSchedule(models.Model):
    FREQUENCY_CHOICES = [
        ('daily', 'Daily'),
        ('weekly', 'Weekly (Every Sunday)'),
        ('monthly', 'Monthly (1st of Month)'),
        ('disabled', 'Disabled'),
    ]
    FORMAT_CHOICES = [
        ('sql', 'SQL Dump (.sql)'),
        ('json', 'JSON Fixture (.json)'),
    ]

    is_enabled = models.BooleanField(default=False)
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES, default='daily')
    backup_time = models.CharField(max_length=10, default='02:00')
    export_format = models.CharField(max_length=10, choices=FORMAT_CHOICES, default='sql')
    retention_days = models.IntegerField(default=30)
    backup_path = models.CharField(max_length=500, default='backups')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Database Backup Schedule"
        verbose_name_plural = "Database Backup Schedules"

    def __str__(self):
        status = "Enabled" if self.is_enabled else "Disabled"
        return f"Backup Schedule ({self.frequency} at {self.backup_time}) - {status}"