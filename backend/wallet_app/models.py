from decimal import Decimal
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator
from django.utils import timezone


def get_wallet_local_date():
    """
    Returns current date in configured application timezone (Asia/Kolkata).
    Safely handles both USE_TZ=True and USE_TZ=False.
    """
    now = timezone.now()
    if timezone.is_aware(now):
        return timezone.localdate()
    return now.date()


def get_wallet_local_time():
    """
    Returns current time in configured application timezone.
    Safely handles both USE_TZ=True and USE_TZ=False.
    """
    now = timezone.now()
    if timezone.is_aware(now):
        return timezone.localtime(now).time()
    return now.time()


def get_wallet_local_datetime():
    """
    Returns current datetime in configured application timezone.
    Safely handles both USE_TZ=True and USE_TZ=False.
    """
    now = timezone.now()
    if timezone.is_aware(now):
        return timezone.localtime(now)
    return now


class WalletMaster(models.Model):
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
    ]

    OWNER_TYPE_CHOICES = [
        ('Employee', 'Employee'),
        ('Vendor', 'Vendor'),
        ('Distributor', 'Distributor'),
    ]

    wallet_code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Unique identifier for the wallet (e.g. WLT-00001)"
    )
    owner_type = models.CharField(
        max_length=30,
        choices=OWNER_TYPE_CHOICES,
        default='Employee',
        db_index=True,
        help_text="Owner category: Employee, Vendor, or Distributor"
    )
    owner_id = models.CharField(
        max_length=50,
        db_index=True,
        blank=True,
        null=True,
        help_text="Unique identifier for the owner (e.g. EMP-0001, VND-0002, DST-0001)"
    )
    owner_record_id = models.PositiveBigIntegerField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Primary key of the related model record (Employee, HrVendor, or HrDistributor)"
    )
    wallet_name = models.CharField(
        max_length=150,
        help_text="Display name of the wallet"
    )
    mobile = models.CharField(
        max_length=30,
        blank=True,
        null=True,
        help_text="Owner contact mobile number"
    )
    email = models.EmailField(
        max_length=254,
        blank=True,
        null=True,
        help_text="Owner contact email address"
    )
    opening_points = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Opening points for the wallet (default: 0)"
    )
    daily_deduction_limit = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Daily deduction limit (0 means no limit)"
    )
    points_expiry_date = models.DateField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Points expiry date if applicable"
    )
    points_expiry_days = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Points expiry period in days (e.g. 30, 60, 90, 365)"
    )
    remarks = models.TextField(
        blank=True,
        null=True,
        help_text="Optional remarks or notes"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='Active',
        db_index=True,
        help_text="Status indicating whether this wallet is active for transactions"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_wallets'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'wallet_master'
        ordering = ['wallet_name']
        verbose_name = 'Wallet Master'
        verbose_name_plural = 'Wallet Masters'

    def __str__(self):
        return f"{self.wallet_name} ({self.wallet_code})"

    def get_balance(self):
        """
        Authoritative backend calculation of current wallet balance.
        Calculates:
          Sum(Credit) - Sum(Debit) from WalletTransaction (ledger)
          + Sum(Addition) - Sum(Deduction) from WalletPointsEntry (points ledger)
        """
        txn_credits = self.transactions.filter(
            status='Posted',
            transaction_type='Credit'
        ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0.00')

        txn_debits = self.transactions.filter(
            status='Posted',
            transaction_type='Debit'
        ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0.00')

        # Add points entry ledger balance if exists
        pts_additions = self.points_entries.filter(
            entry_type='Addition'
        ).aggregate(total=models.Sum('points'))['total'] or Decimal('0.00')

        pts_deductions = self.points_entries.filter(
            entry_type='Deduction'
        ).aggregate(total=models.Sum('points'))['total'] or Decimal('0.00')

        opening = self.opening_points or Decimal('0.00')
        return opening + (txn_credits - txn_debits) + (pts_additions - pts_deductions)


class WalletTransaction(models.Model):
    TYPE_CHOICES = [
        ('Credit', 'Credit'),
        ('Debit', 'Debit'),
    ]

    STATUS_CHOICES = [
        ('Posted', 'Posted'),
        ('Cancelled', 'Cancelled'),
    ]

    transaction_number = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Unique transaction identifier"
    )
    transaction_date = models.DateField(
        default=timezone.now,
        db_index=True,
        help_text="Date when transaction occurred"
    )
    wallet = models.ForeignKey(
        WalletMaster,
        on_delete=models.PROTECT,
        related_name='transactions',
        help_text="Wallet associated with this transaction"
    )
    transaction_type = models.CharField(
        max_length=10,
        choices=TYPE_CHOICES,
        db_index=True,
        help_text="Credit (inflow) or Debit (outflow)"
    )
    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Transaction monetary amount (must be > 0)"
    )
    reference_number = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        db_index=True,
        help_text="Optional external reference number"
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Optional description or remarks"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='Posted',
        db_index=True,
        help_text="Transaction lifecycle status"
    )
    cancellation_reason = models.TextField(
        blank=True,
        null=True,
        help_text="Reason if transaction is cancelled"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='wallet_transactions'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'wallet_transaction'
        ordering = ['-transaction_date', '-created_at']
        verbose_name = 'Wallet Transaction'
        verbose_name_plural = 'Wallet Transactions'

    def __str__(self):
        return f"{self.transaction_number} - {self.wallet.wallet_name} ({self.transaction_type} {self.amount})"


class WalletOwnerType(models.Model):
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
    ]

    owner_type = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
        help_text="Required owner type name (e.g. Employee, Customer, Vendor, Partner)"
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Optional description of the owner type"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='Active',
        db_index=True,
        help_text="Status indicating whether this owner type is active"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'wallet_ownertype'
        ordering = ['owner_type']
        verbose_name = 'Wallet Owner Type'
        verbose_name_plural = 'Wallet Owner Types'

    def __str__(self):
        return self.owner_type


class WalletScheme(models.Model):
    """
    Model mapping to the wallet_schemes database table in db_glendatest / db_glenda.
    """
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
    ]

    name = models.CharField(
        max_length=255,
        db_index=True,
        help_text="Required scheme name"
    )
    start_date = models.DateField(
        help_text="Scheme validity start date"
    )
    end_date = models.DateField(
        help_text="Scheme validity end date"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='Active',
        db_index=True,
        help_text="Status indicating whether this scheme is active or inactive"
    )
    CRITERIA_TYPE_CHOICES = [
        ('Quantity', 'Quantity Based'),
        ('Value', 'Value Based'),
        ('Both', 'Both (Quantity & Value)'),
    ]
    criteria_type = models.CharField(
        max_length=20,
        choices=CRITERIA_TYPE_CHOICES,
        default='Quantity',
        db_index=True,
        help_text="Criteria based on Quantity, Value, or Both"
    )
    is_consolidated = models.BooleanField(
        default=False,
        help_text="Whether this scheme criteria is evaluated on consolidated basis"
    )
    remarks = models.TextField(
        blank=True,
        null=True,
        help_text="Optional remarks/notes about the scheme"
    )
    criteria = models.TextField(
        blank=True,
        default='',
        help_text="Optional overall criteria summary or legacy criteria text"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'wallet_schemes'
        ordering = ['-created_at']
        verbose_name = 'Wallet Scheme'
        verbose_name_plural = 'Wallet Schemes'

    def __str__(self):
        return self.name

    def is_expired(self, on_date=None):
        """Returns True if the scheme's End Date has passed."""
        target_date = on_date or get_wallet_local_date()
        return target_date > self.end_date

    def is_upcoming(self, on_date=None):
        """Returns True if the current date is before the scheme's Start Date."""
        target_date = on_date or get_wallet_local_date()
        return target_date < self.start_date

    def is_currently_active(self, on_date=None):
        """
        Business rules:
        - Before the Start Date: the scheme is not active.
        - From the Start Date through the End Date, inclusive: eligible to be active, provided not manually deactivated.
        - After the End Date: treated as expired and inactive automatically.
        - A manually deactivated scheme remains inactive even if within date range.
        """
        target_date = on_date or get_wallet_local_date()
        if self.status != 'Active':
            return False
        if target_date < self.start_date or target_date > self.end_date:
            return False
        return True

    @property
    def effective_status(self):
        """
        Determines the authoritative status taking End Date expiry into account.
        """
        today = get_wallet_local_date()
        if self.status != 'Active' or today > self.end_date:
            return 'Inactive'
        return 'Active'

    @classmethod
    def deactivate_expired(cls):
        """
        Database synchronization: Updates any scheme whose End Date has passed
        and is still marked 'Active' to 'Inactive'.
        Returns the number of updated records.
        """
        today = get_wallet_local_date()
        return cls.objects.filter(status='Active', end_date__lt=today).update(status='Inactive')

    @property
    def scheme_criteria(self):
        return self.criteria_rows


class WalletSchemeCriteria(models.Model):
    CRITERIA_GROUP_CHOICES = [
        ('criteria', 'Criteria'),
        ('criteria_2', 'Criteria 2'),
    ]

    scheme = models.ForeignKey(
        WalletScheme,
        on_delete=models.CASCADE,
        related_name='criteria_rows',
        help_text="Parent Wallet Scheme"
    )
    criteria_group = models.CharField(
        max_length=50,
        choices=CRITERIA_GROUP_CHOICES,
        default='criteria',
        db_index=True,
        help_text="Identifies which criteria tab/group this record belongs to (criteria or criteria_2)"
    )
    product = models.ForeignKey(
        'inventory_app.StockItem',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='wallet_scheme_criteria',
        help_text="Associated StockItem product"
    )
    percentage = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Percentage value for the criterion"
    )
    value = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Monetary or numeric criterion value"
    )
    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Required quantity"
    )
    points = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Points associated with the criterion"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'wallet_scheme_criteria'
        ordering = ['id']
        verbose_name = 'Wallet Scheme Criteria'
        verbose_name_plural = 'Wallet Scheme Criteria'

    def __str__(self):
        prod = self.product.name if self.product else "All Products"
        return f"{self.scheme.name} - {prod} (Percentage: {self.percentage}%, Value: {self.value})"


class WalletCriteriaValue(models.Model):
    """
    Model mapping to the wallet_criteria_values database table.
    Stores value-based criteria rows for Wallet Schemes (Tab 3: Scheme Criteria Value Based).
    """
    scheme = models.ForeignKey(
        WalletScheme,
        on_delete=models.CASCADE,
        related_name='criteria_values',
        help_text="Parent Wallet Scheme"
    )
    product = models.ForeignKey(
        'inventory_app.StockItem',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='wallet_criteria_values',
        help_text="Associated StockItem product"
    )
    value = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Threshold purchase value for the criterion"
    )
    discount_percentage = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Discount percentage (%)"
    )
    discount_value = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Discount monetary value"
    )
    points = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Points associated with the criterion"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'wallet_criteria_values'
        ordering = ['id']
        verbose_name = 'Wallet Criteria Value'
        verbose_name_plural = 'Wallet Criteria Values'

    def __str__(self):
        prod = self.product.name if self.product else "All Products"
        return f"{self.scheme.name} - {prod} (Value: {self.value}, Discount%: {self.discount_percentage}%, Discount Val: {self.discount_value})"


class WalletReason(models.Model):
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
    ]

    reason = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
        help_text="Required manually entered reason"
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Optional description or notes for the reason"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='Active',
        db_index=True,
        help_text="Status indicating whether this reason is active"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'wallet_reason'
        ordering = ['reason']
        verbose_name = 'Wallet Reason'
        verbose_name_plural = 'Wallet Reasons'

    def __str__(self):
        return self.reason


class WalletPointsEntry(models.Model):
    """
    Dedicated points transaction ledger table for Wallet Points Entry.
    """
    ENTRY_TYPE_CHOICES = [
        ('Addition', '+ Addition'),
        ('Deduction', '− Deduction'),
    ]

    REASON_CHOICES = [
        ('Reward / Incentive', 'Reward / Incentive'),
        ('Purchase credit', 'Purchase credit'),
        ('Bulk allocation', 'Bulk allocation'),
        ('Refund / Reversal', 'Refund / Reversal'),
        ('Manual adjustment', 'Manual adjustment'),
    ]

    entry_number = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        null=True,
        blank=True,
        help_text="Unique sequential identifier for points entry (e.g. PE-00001)"
    )
    wallet = models.ForeignKey(
        WalletMaster,
        on_delete=models.PROTECT,
        related_name='points_entries',
        db_index=True,
        help_text="Wallet associated with this points entry"
    )
    scheme = models.ForeignKey(
        WalletScheme,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='points_entries',
        db_index=True,
        help_text="Scheme associated with this points entry"
    )
    entry_type = models.CharField(
        max_length=20,
        choices=ENTRY_TYPE_CHOICES,
        default='Addition',
        db_index=True,
        help_text="Addition or Deduction"
    )
    points = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Points entered (must be > 0)"
    )
    reason = models.CharField(
        max_length=50,
        choices=REASON_CHOICES,
        default='Reward / Incentive',
        db_index=True,
        help_text="Reason for the points entry"
    )
    reference_no = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        db_index=True,
        help_text="Invoice, order, or ticket reference"
    )
    entry_date = models.DateField(
        default=timezone.now,
        db_index=True,
        help_text="Date of points entry"
    )
    remarks = models.TextField(
        blank=True,
        null=True,
        help_text="Optional remarks or notes"
    )
    balance_before = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        help_text="Authoritative wallet balance before this entry"
    )
    balance_after = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        help_text="Authoritative wallet balance after this entry"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='wallet_points_entries',
        help_text="User who posted the entry"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'wallet_points_entry'
        ordering = ['-entry_date', '-created_at']
        verbose_name = 'Wallet Points Entry'
        verbose_name_plural = 'Wallet Points Entries'

    def __str__(self):
        return f"PointsEntry #{self.id} - {self.wallet.wallet_name} ({self.entry_type} {self.points})"


class WalletWorkingSettings(models.Model):
    """
    Global configuration for Inactivity Detection & Break/Idle Tracking.
    Singleton pattern (id=1).
    """
    inactivity_timeout_minutes = models.PositiveIntegerField(
        default=10,
        validators=[MinValueValidator(1)],
        help_text="Time without qualifying user interaction before prompt / idle (minutes)"
    )
    confirmation_countdown_seconds = models.PositiveIntegerField(
        default=30,
        validators=[MinValueValidator(5)],
        help_text="Time allowed to click Yes before a break starts (seconds)"
    )
    break_tracking_enabled = models.BooleanField(
        default=True,
        help_text="Enable or disable automatic break tracking"
    )
    break_start_behavior = models.CharField(
        max_length=50,
        default='Automatic',
        help_text="Define how a break is recorded after timeout ('Automatic')"
    )
    monitoring_enabled = models.BooleanField(
        default=True,
        help_text="Enable or disable inactivity monitoring"
    )
    # Background Idle Status Tracker configuration fields
    idle_threshold_minutes = models.PositiveIntegerField(
        default=10,
        validators=[MinValueValidator(1)],
        help_text="Inactivity threshold in minutes before desktop agent marks status as IDLE (default: 10 min)"
    )
    check_interval_seconds = models.PositiveIntegerField(
        default=60,
        validators=[MinValueValidator(5)],
        help_text="Interval in seconds at which the background desktop agent samples keyboard/mouse inactivity (default: 60 sec)"
    )
    heartbeat_timeout_minutes = models.PositiveIntegerField(
        default=15,
        validators=[MinValueValidator(1)],
        help_text="Threshold in minutes before agent connection is considered OFFLINE (default: 15 min)"
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='wallet_working_settings_updates',
        help_text="User who last updated the settings"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'wallet_working_settings'
        verbose_name = 'Wallet Working Settings'
        verbose_name_plural = 'Wallet Working Settings'

    @classmethod
    def get_settings(cls):
        settings_obj, _ = cls.objects.get_or_create(id=1)
        return settings_obj

    def __str__(self):
        return f"Working Settings (Idle Threshold: {self.idle_threshold_minutes}m, Interval: {self.check_interval_seconds}s)"


class EmployeeWorkingStatus(models.Model):
    """
    Maintains the current active/idle tracking status per authorized employee & device.
    Updated only when the status changes, or on heartbeat.
    """
    STATUS_CHOICES = [
        ('ACTIVE', 'ACTIVE'),
        ('IDLE', 'IDLE'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='working_statuses',
        help_text="Authorized employee"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='ACTIVE',
        db_index=True
    )
    last_change = models.DateTimeField(
        default=timezone.now,
        help_text="Timestamp when status last transitioned between ACTIVE and IDLE"
    )
    last_activity_at = models.DateTimeField(
        default=timezone.now,
        help_text="Timestamp of the most recent detected keyboard or mouse activity"
    )
    last_heartbeat_at = models.DateTimeField(
        default=timezone.now,
        help_text="Timestamp of the most recent agent heartbeat"
    )
    device_identifier = models.CharField(
        max_length=255,
        default='Windows Workstation',
        help_text="Hostname or unique device identifier of the workstation"
    )
    agent_version = models.CharField(
        max_length=50,
        default='1.0.0',
        help_text="Desktop tracking agent version"
    )
    custom_idle_threshold_minutes = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Custom idle threshold in minutes for this employee. If null, global settings value is used."
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'wallet_employee_working_status'
        verbose_name = 'Employee Working Status'
        verbose_name_plural = 'Employee Working Statuses'
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'device_identifier'],
                name='unique_user_device_working_status'
            )
        ]

    def __str__(self):
        return f"{self.user} on {self.device_identifier}: {self.status}"

    def is_online(self, timeout_minutes=15):
        if not self.last_heartbeat_at:
            return False
        now = timezone.now()
        lh = self.last_heartbeat_at
        if timezone.is_aware(now) and timezone.is_naive(lh):
            now = timezone.make_naive(now)
        elif timezone.is_naive(now) and timezone.is_aware(lh):
            lh = timezone.make_naive(lh)
        delta_sec = (now - lh).total_seconds()
        return delta_sec <= (timeout_minutes * 60)

    def connection_status(self, timeout_minutes=15):
        return "ONLINE" if self.is_online(timeout_minutes) else "OFFLINE"


class WorkingStatusHistory(models.Model):
    """
    Audit log of status transitions between ACTIVE and IDLE.
    Recorded ONLY when the status actually changes.
    """
    STATUS_CHOICES = [
        ('ACTIVE', 'ACTIVE'),
        ('IDLE', 'IDLE'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='working_status_histories',
        help_text="Authorized employee"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        db_index=True
    )
    changed_at = models.DateTimeField(
        default=timezone.now,
        db_index=True,
        help_text="Timestamp when the transition occurred"
    )
    last_activity_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last recorded keyboard/mouse interaction at transition time"
    )
    device_identifier = models.CharField(
        max_length=255,
        default='Windows Workstation',
        help_text="Workstation hostname"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'wallet_working_status_history'
        ordering = ['-changed_at', '-created_at']
        verbose_name = 'Working Status History'
        verbose_name_plural = 'Working Status Histories'

    def __str__(self):
        return f"{self.user} changed to {self.status} at {self.changed_at}"


class WorkingSession(models.Model):
    """
    Tracks an employee's working session.
    """
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('On Break', 'On Break'),
        ('Ended', 'Ended'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='working_sessions',
        help_text="Authenticated user / employee"
    )
    session_start = models.DateTimeField(default=timezone.now)
    session_end = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'wallet_working_session'
        ordering = ['-created_at']

    def __str__(self):
        return f"Session #{self.id} for {self.user} ({self.status})"


class WorkingBreak(models.Model):
    """
    Tracks individual break periods for employees.
    """
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Completed', 'Completed'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='working_breaks'
    )
    session = models.ForeignKey(
        WorkingSession,
        on_delete=models.CASCADE,
        related_name='breaks',
        null=True,
        blank=True
    )
    break_start = models.DateTimeField(default=timezone.now)
    break_end = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    threshold_minutes = models.PositiveIntegerField(null=True, blank=True, help_text="Threshold in minutes assigned for this break / employee")
    break_source = models.CharField(max_length=50, default='INACTIVITY_TIMEOUT')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'wallet_working_break'
        ordering = ['-created_at']

    def __str__(self):
        return f"Break #{self.id} for {self.user} ({self.break_source}) - {self.status}"


class InactivityEvent(models.Model):
    """
    Logs inactivity prompts and their outcomes.
    """
    OUTCOME_CHOICES = [
        ('PENDING', 'PENDING'),
        ('CONFIRMED', 'CONFIRMED'),
        ('TIMED_OUT', 'TIMED_OUT'),
        ('DISMISSED', 'DISMISSED'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='inactivity_events'
    )
    session = models.ForeignKey(
        WorkingSession,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inactivity_events'
    )
    prompt_time = models.DateTimeField(default=timezone.now)
    response_deadline = models.DateTimeField(null=True, blank=True)
    response_time = models.DateTimeField(null=True, blank=True)
    outcome = models.CharField(max_length=20, choices=OUTCOME_CHOICES, default='TIMED_OUT')
    related_break = models.ForeignKey(
        WorkingBreak,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inactivity_events'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'wallet_inactivity_event'
        ordering = ['-created_at']

    def __str__(self):
        return f"InactivityEvent #{self.id} for {self.user} ({self.outcome})"


class ScreenshotAgentHeartbeat(models.Model):
    """
    Tracks persistent liveness and registration for authorized Windows Desktop Screenshot Agents.
    Guarantees cross-process and persistent agent status reporting.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='screenshot_agent_heartbeat'
    )
    hostname = models.CharField(max_length=255, default='Windows Workstation')
    version = models.CharField(max_length=50, default='1.2.0')
    last_seen = models.DateTimeField(default=timezone.now, db_index=True)
    status = models.CharField(max_length=30, default='online')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'wallet_screenshot_agent_heartbeat'
        verbose_name = 'Screenshot Agent Heartbeat'

    def __str__(self):
        return f"Agent for {self.user} ({self.hostname}) - Last seen: {self.last_seen}"


class ScreenshotSchedule(models.Model):
    """
    Stores scheduled screenshot capture times configured per date and user.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='wallet_screenshot_schedules',
        help_text="User/Employee for whom the screenshot is scheduled"
    )
    scheduled_date = models.DateField(
        db_index=True,
        help_text="Calendar date for screenshot capture (YYYY-MM-DD)"
    )
    scheduled_time = models.TimeField(
        db_index=True,
        help_text="Target clock time for screenshot capture (HH:MM:SS or HH:MM)"
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Whether this schedule is currently active"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_screenshot_schedules',
        help_text="User who created this schedule"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'wallet_screenshot_schedule'
        ordering = ['scheduled_date', 'scheduled_time']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'scheduled_date', 'scheduled_time'],
                name='unique_active_user_date_time_schedule'
            )
        ]
        verbose_name = 'Screenshot Schedule'
        verbose_name_plural = 'Screenshot Schedules'

    def __str__(self):
        return f"{self.user} - {self.scheduled_date} at {self.scheduled_time} ({'Active' if self.is_active else 'Inactive'})"


class ScreenshotExecution(models.Model):
    """
    Audit log and historical record of scheduled screenshot captures and outcomes.
    Retains captured files, execution timestamps, and error messages.
    Preserved even if the original schedule is subsequently deleted or modified.
    """
    STATUS_CHOICES = [
        ('Scheduled', 'Scheduled'),
        ('Captured', 'Captured'),
        ('Failed', 'Failed'),
        ('Permission Required', 'Permission Required'),
        ('Missed', 'Missed'),
    ]

    schedule = models.ForeignKey(
        ScreenshotSchedule,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='executions',
        help_text="Associated schedule if still active"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='wallet_screenshot_executions',
        help_text="User/Employee whose screen was captured"
    )
    scheduled_date = models.DateField(
        db_index=True,
        help_text="Calendar date of the scheduled capture"
    )
    scheduled_time = models.TimeField(
        help_text="Clock time of the scheduled capture"
    )
    scheduled_datetime = models.DateTimeField(
        db_index=True,
        help_text="Combined timestamp for ordering and scheduling logic"
    )
    executed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when capture execution was completed"
    )
    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default='Scheduled',
        db_index=True,
        help_text="Execution outcome: Scheduled, Captured, Failed, Permission Required, Missed"
    )
    screenshot_file = models.FileField(
        upload_to='wallet_screenshots/%Y/%m/%d/',
        null=True,
        blank=True,
        help_text="Captured screenshot image file"
    )
    error_message = models.TextField(
        null=True,
        blank=True,
        help_text="Diagnostic error or failure description"
    )
    capture_source = models.CharField(
        max_length=50,
        default='Browser Session',
        help_text="Capture agent mechanism (e.g. Browser Session, Desktop Agent)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'wallet_screenshot_execution'
        ordering = ['-scheduled_datetime', '-created_at']
        verbose_name = 'Screenshot Execution'
        verbose_name_plural = 'Screenshot Executions'

    def __str__(self):
        return f"Execution #{self.id} for {self.user} - {self.scheduled_date} {self.scheduled_time}: {self.status}"




