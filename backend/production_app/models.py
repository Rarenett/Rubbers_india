from django.db import models
from datetime import datetime, timedelta

from rarenett_app.models import DepartmentDesignation, Employee
from register_app.models import CustomUser
from inventory_app.models import StockItem

# Create your models here.

class EmployeeGroup(models.Model):
    group_name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)

    created_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["group_name"]

    def __str__(self):
        return self.group_name


class EmployeeGroupMember(models.Model):
    group = models.ForeignKey(
        EmployeeGroup,
        on_delete=models.CASCADE,
        related_name="members"
    )

    employee = models.OneToOneField(
        Employee,
        on_delete=models.CASCADE,
        related_name="employee_group"
    )

    designation = models.ForeignKey(
        DepartmentDesignation,
        on_delete=models.PROTECT
    )

    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["designation__designation__name", "employee__user__first_name"]

    def save(self, *args, **kwargs):
        self.designation = self.employee.dept_designation
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.group.group_name} - {self.employee}"


class Shift(models.Model):
    name = models.CharField(max_length=100)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_active = models.BooleanField(default=True)
    factory = models.ForeignKey(
        'settings_app.Factory',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='shifts'
    )
    allowed_break_types = models.ManyToManyField(
        'BreakTypeMaster',
        blank=True,
        related_name='shifts'
    )

    class Meta:
        ordering = ["start_time"]
        unique_together = ("name", "factory")

    def __str__(self):
        return self.name

class ProductionLine(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    allowed_lunch_minutes = models.PositiveIntegerField(default=30, blank=True, null=True)
    allowed_tea_minutes = models.PositiveIntegerField(default=15, blank=True, null=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

class ShiftPlan(models.Model):
    plan_name = models.CharField(max_length=200)
    from_date = models.DateField()
    to_date = models.DateField()
    remarks = models.TextField(blank=True, null=True)
    factory = models.ForeignKey(
        'settings_app.Factory',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='shift_plans'
    )

    created_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-from_date"]
        unique_together = ("plan_name", "factory")

    def __str__(self):
        return self.plan_name

class ShiftPlanDay(models.Model):
    shift_plan = models.ForeignKey(
        ShiftPlan,
        on_delete=models.CASCADE,
        related_name="days"
    )
    plan_date = models.DateField()
    shift = models.ForeignKey(Shift, on_delete=models.PROTECT)
    remarks = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ("plan_date", "shift")
        ordering = ["plan_date", "shift__start_time"]

    def __str__(self):
        return f"{self.plan_date} - {self.shift.name}"

class ShiftProductionLine(models.Model):
    STATUS_CHOICES = (
        ('PLANNED', 'Planned'),
        ('RUNNING', 'Running'),
        ('COMPLETED', 'Completed'),
    )

    shift_day = models.ForeignKey(
        ShiftPlanDay,
        on_delete=models.CASCADE,
        related_name="production_lines"
    )
    production_line = models.ForeignKey(ProductionLine, on_delete=models.PROTECT)
    stock_item = models.ForeignKey(StockItem, on_delete=models.PROTECT)
    planned_quantity = models.DecimalField(max_digits=10, decimal_places=2)
    start_time = models.TimeField()
    end_time = models.TimeField()
    employee_group = models.ForeignKey(EmployeeGroup, on_delete=models.SET_NULL, null=True, blank=True)
    remarks = models.TextField(blank=True, null=True)
    priority = models.IntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PLANNED')

    class Meta:
        unique_together = ("shift_day", "production_line")
        ordering = ["start_time", "priority"]

    def __str__(self):
        return f"{self.production_line.name} ({self.shift_day})"

class ShiftProductionEmployee(models.Model):
    ATTENDANCE_CHOICES = (
        ('PRESENT', 'Present'),
        ('ABSENT', 'Absent'),
        ('LATE', 'Late'),
        ('HALF_DAY', 'Half Day'),
    )

    production_line = models.ForeignKey(
        ShiftProductionLine,
        on_delete=models.CASCADE,
        related_name="employees"
    )
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT)
    added_from_group = models.ForeignKey(EmployeeGroup, on_delete=models.SET_NULL, null=True, blank=True)
    attendance_status = models.CharField(max_length=20, choices=ATTENDANCE_CHOICES, default='PRESENT')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("production_line", "employee")

    def __str__(self):
        return f"{self.employee} -> {self.production_line}"


class ProductionAttendance(models.Model):
    STATUS_CHOICES = (
        ('PRESENT', 'Present'),
        ('ABSENT', 'Absent'),
        ('LATE', 'Late'),
        ('HALF_DAY', 'Half Day'),
        ('LEAVE', 'On Leave'),
    )

    employee = models.ForeignKey(
        Employee, 
        on_delete=models.CASCADE, 
        related_name="production_attendance"
    )
    shift_day = models.ForeignKey(
        ShiftPlanDay, 
        on_delete=models.CASCADE, 
        related_name="attendance_records",
        null=True, blank=True
    )
    production_line = models.ForeignKey(
        ProductionLine, 
        on_delete=models.CASCADE, 
        related_name="attendance_records"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PRESENT')
    check_in_time = models.DateTimeField(null=True, blank=True)
    check_out_time = models.DateTimeField(null=True, blank=True)
    
    total_work_minutes = models.PositiveIntegerField(default=0)
    total_break_minutes = models.PositiveIntegerField(default=0)
    net_work_minutes = models.PositiveIntegerField(default=0)
    overtime_minutes = models.PositiveIntegerField(default=0)
    is_overtime_approved = models.BooleanField(default=False)
    
    verified_by = models.ForeignKey(
        CustomUser, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True
    )
    remarks = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("employee", "shift_day", "production_line")
        ordering = ["-shift_day__plan_date", "employee"]

    def __str__(self):
        return f"{self.employee} - {self.production_line.name} ({self.shift_day.plan_date if self.shift_day else ''})"

    def recalculate_times(self):
        # 1. Total break minutes (only those that reduce from total hours)
        break_logs = self.breaks.filter(end_time__isnull=False, break_type__reduce_from_total_hours=True)
        total_breaks = sum(b.duration_minutes for b in break_logs)
        self.total_break_minutes = total_breaks

        # 2. Total work minutes
        if self.check_in_time and self.check_out_time:
            from django.utils import timezone
            t_in = self.check_in_time
            t_out = self.check_out_time
            if timezone.is_aware(t_in):
                t_in = timezone.make_naive(t_in)
            if timezone.is_aware(t_out):
                t_out = timezone.make_naive(t_out)
                
            work_delta = t_out - t_in
            self.total_work_minutes = max(0, int(work_delta.total_seconds() / 60))
            self.net_work_minutes = max(0, self.total_work_minutes - self.total_break_minutes)

            # 3. Overtime calculation
            self.overtime_minutes = 0
            if self.shift_day and self.production_line:
                try:
                    shift_line = ShiftProductionLine.objects.get(
                        shift_day=self.shift_day,
                        production_line=self.production_line
                    )
                    if shift_line.start_time and shift_line.end_time:
                        date_ref = self.shift_day.plan_date
                        dt_start = datetime.combine(date_ref, shift_line.start_time)
                        dt_end = datetime.combine(date_ref, shift_line.end_time)
                        if dt_end < dt_start:
                            dt_end += timedelta(days=1)
                        
                        scheduled_minutes = max(0, int((dt_end - dt_start).total_seconds() / 60))
                        if self.net_work_minutes > scheduled_minutes:
                            self.overtime_minutes = self.net_work_minutes - scheduled_minutes
                except ShiftProductionLine.DoesNotExist:
                    pass
        else:
            self.total_work_minutes = 0
            self.net_work_minutes = 0
            self.overtime_minutes = 0
        
        ProductionAttendance.objects.filter(pk=self.pk).update(
            total_break_minutes=self.total_break_minutes,
            total_work_minutes=self.total_work_minutes,
            net_work_minutes=self.net_work_minutes,
            overtime_minutes=self.overtime_minutes
        )

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.recalculate_times()


class BreakTypeMaster(models.Model):
    name = models.CharField(max_length=100, unique=True)
    duration_minutes = models.PositiveIntegerField(default=15)
    reduce_from_total_hours = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

class ProductionBreakLog(models.Model):
    attendance = models.ForeignKey(
        ProductionAttendance, 
        on_delete=models.CASCADE, 
        related_name="breaks"
    )
    break_type = models.ForeignKey(
        BreakTypeMaster,
        on_delete=models.PROTECT,
        related_name="break_logs"
    )
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.PositiveIntegerField(default=0)
    allowed_duration_minutes = models.PositiveIntegerField(default=0)
    exceeded_minutes = models.PositiveIntegerField(default=0)
    remarks = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["start_time"]

    def __str__(self):
        return f"{self.attendance.employee} - {self.break_type.name} ({self.start_time})"

    def save(self, *args, **kwargs):
        if self.start_time and self.end_time:
            from django.utils import timezone
            t_start = self.start_time
            t_end = self.end_time
            if timezone.is_aware(t_start):
                t_start = timezone.make_naive(t_start)
            if timezone.is_aware(t_end):
                t_end = timezone.make_naive(t_end)
            delta = t_end - t_start
            self.duration_minutes = max(0, int(delta.total_seconds() / 60))
            if self.duration_minutes > self.allowed_duration_minutes:
                self.exceeded_minutes = self.duration_minutes - self.allowed_duration_minutes
            else:
                self.exceeded_minutes = 0
        else:
            self.duration_minutes = 0
            self.exceeded_minutes = 0
        super().save(*args, **kwargs)
        if self.attendance:
            self.attendance.recalculate_times()


class PostProductionEntry(models.Model):
    PRODUCTION_TYPE_CHOICES = (
        ('REGULAR', 'Regular'),
        ('ADJUSTMENT', 'Adjustment'),
    )

    production_line = models.OneToOneField(
        ShiftProductionLine,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="post_production_entry"
    )
    production_type = models.CharField(
        max_length=20,
        choices=PRODUCTION_TYPE_CHOICES,
        default='REGULAR'
    )
    stock_item = models.ForeignKey(
        StockItem,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="post_production_entries"
    )
    manufactured_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    damaged_quantity = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, default=0)
    damaged_unit = models.ForeignKey(
        'inventory_app.Unit',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+"
    )
    balance = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, default=0)
    balance_primary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, default=0)
    balance_alternate = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, default=0)
    actual_use_quantity = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, default=0)
    rd_rejected_quantity = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    batch_number = models.CharField(max_length=100, null=True, blank=True)
    expiry_after = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if self.production_line and not self.stock_item:
            self.stock_item = getattr(self.production_line, 'stock_item', None)
        if self.production_type == 'REGULAR':
            if (self.balance_primary == 0 or self.balance_primary is None) and self.balance and self.balance > 0 and (self.balance_alternate == 0 or self.balance_alternate is None):
                self.balance_primary = self.balance
        if not self.batch_number:
            date_val = None
            if self.production_line and getattr(self.production_line, 'shift_day', None):
                date_val = getattr(self.production_line.shift_day, 'plan_date', None)
            if not date_val and self.created_at:
                date_val = self.created_at.date()
            if not date_val:
                from django.utils import timezone
                date_val = timezone.now().date()
            self.batch_number = date_val.strftime('%Y%m%d')
        super().save(*args, **kwargs)

    def __str__(self):
        if self.production_type == 'ADJUSTMENT':
            stock_name = self.stock_item.name if self.stock_item else "Unknown"
            return f"Adjustment Entry #{self.id} - {stock_name} ({self.manufactured_quantity})"
        return f"Post Production - {self.production_line}"


class PostProductionDamagedMaterial(models.Model):
    post_production_entry = models.ForeignKey(
        PostProductionEntry,
        on_delete=models.CASCADE,
        related_name="damaged_materials"
    )
    raw_material = models.ForeignKey(StockItem, on_delete=models.CASCADE)
    damaged_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.raw_material.name} - {self.damaged_quantity}"


class PostProductionResponsibility(models.Model):
    production_line = models.OneToOneField(
        ShiftProductionLine,
        on_delete=models.CASCADE,
        related_name="post_production_responsibility"
    )
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="post_production_responsibilities"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.employee} -> {self.production_line}"