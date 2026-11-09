from django.db import models

from django.conf import settings

# Create your models here.


class PayrollUnit(models.Model):
    symbol = models.CharField(max_length=20)
    formal_name = models.CharField(max_length=100)
    decimals = models.IntegerField(default=2)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Pay Unit"
        verbose_name_plural = "Pay Units"
        ordering = ['formal_name']

    def __str__(self):
        return f"{self.symbol} ({self.formal_name})"


class PayrollCompoundUnit(models.Model):
    compound_unit = models.ForeignKey(
        PayrollUnit,
        on_delete=models.PROTECT,
        related_name='compound_units'
    )
    base_unit = models.ForeignKey(
        PayrollUnit,
        on_delete=models.PROTECT,
        related_name='base_units'
    )
    conversion_factor = models.DecimalField(
        max_digits=12,
        decimal_places=4
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Compound Pay Unit"
        verbose_name_plural = "Compound Pay Units"
        ordering = ['compound_unit']

    def __str__(self):
        return f"{self.compound_unit} = {self.conversion_factor} {self.base_unit}"


class AttendanceProductionType(models.Model):

    class TypeChoices(models.TextChoices):
        ATTENDANCE_LEAVE_WITH_PAY = "attendance_leave_with_pay", "Paid Attendance / Leave"
        LEAVE_WITHOUT_PAY = "leave_without_pay", "Unpaid Leave / Loss of Pay (LOP)"
        PRODUCTION = "production", "Piece-rate / Output Production"
        USER_DEFINED_CALENDAR = "user_defined_calendar", "Custom Working Calendar"

    class PeriodChoices(models.TextChoices):
        DAYS = "days", "Days"
        WEEKS = "weeks", "Weeks"
        MONTHS = "months", "Months"

    name = models.CharField(max_length=100)

    type = models.CharField(
        max_length=50,
        choices=TypeChoices.choices
    )

    period_type = models.CharField(
        max_length=50,
        choices=PeriodChoices.choices,
        default=PeriodChoices.DAYS,
        blank=True
    )

    payroll_unit = models.ForeignKey(
        PayrollUnit,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="attendance_production_types"
    )

    compound_unit = models.ForeignKey(
        PayrollCompoundUnit,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="attendance_production_types"
    )
    
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Attendance & Output Type"
        verbose_name_plural = "Attendance & Output Types"
        ordering = ["name"]

    def __str__(self):
        return self.name


class CalculationType(models.Model):
    name = models.CharField(max_length=100, unique=True)
    is_calculation_period_required = models.BooleanField(
        default=False,
        help_text="Check if Calculation Period field is required for this calculation type"
    )
    payroll_units = models.ManyToManyField(
        PayrollUnit,
        related_name="calculation_types",
        blank=True
    )
    attendance_production_types = models.ManyToManyField(
        AttendanceProductionType,
        related_name="calculation_types",
        blank=True
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Calculation Method"
        verbose_name_plural = "Calculation Methods"
        ordering = ["name"]

    def __str__(self):
        return self.name


class PayHead(models.Model):
    PAY_HEAD_TYPE_CHOICES = [
        ("NOT_APPLICABLE", "Not Applicable"),
        ("DEDUCTION", "Employee Deductions"),
        ("EARNING", "Employee Earnings"),
        ("EMPLOYEE_STATUTORY_DEDUCTION", "Statutory Deductions (Employee)"),
        ("EMPLOYER_STATUTORY_CONTRIBUTION", "Statutory Contributions (Employer)"),
        ("GRATUITY", "Gratuity Benefit"),
        ("LOAN_ADVANCE", "Loan & Advance Recoveries"),
        ("REIMBURSEMENT", "Employee Reimbursements"),
    ]

    INCOME_TYPE_CHOICES = [
        ("FIXED", "Fixed"),
        ("VARIABLE", "Variable"),
    ]

    name = models.CharField(max_length=100, unique=True)
    pay_head_type = models.CharField(
        max_length=50, choices=PAY_HEAD_TYPE_CHOICES
    )
    income_type = models.CharField(
        max_length=20, choices=INCOME_TYPE_CHOICES, default="FIXED"
    )
    under = models.ForeignKey(
        "finance_app.AccountGroup",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="pay_heads"
    )
    affect_net_salary = models.BooleanField(default=True)
    use_for_gratuity = models.BooleanField(default=False)
    calculation_type = models.ForeignKey(
        CalculationType,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="pay_heads"
    )
    calculation_period = models.ForeignKey(
        PayrollUnit,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="pay_heads_as_period"
    )
    attendance_production_type = models.ForeignKey(
        AttendanceProductionType,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="pay_heads"
    )
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL,  on_delete=models.SET_NULL, null=True, related_name='payheads_created')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Pay Component"
        verbose_name_plural = "Pay Components"

    def __str__(self):
        return self.name


class PayHeadComputation(models.Model):
    COMPUTE_METHOD_CHOICES = [
        ("on_current_deductions_total", "Total Current Deductions"),
        ("on_current_earnings_total", "Total Current Earnings"),
        ("on_current_subtotal", "Current Subtotal / Gross"),
        ("on_specified_formula", "Custom Formula"),
    ]

    pay_head = models.OneToOneField(
        PayHead,
        on_delete=models.CASCADE,
        related_name="computation"
    )
    compute_method = models.CharField(
        max_length=50,
        choices=COMPUTE_METHOD_CHOICES,
        default="on_current_earnings_total"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Pay Component Computation"
        verbose_name_plural = "Pay Component Computations"

    def __str__(self):
        return f"{self.pay_head.name} - {self.get_compute_method_display()}"


class PayHeadComputationSlab(models.Model):
    SLAB_TYPE_CHOICES = [
        ("percentage", "Percentage"),
        ("value", "Value"),
    ]

    computation = models.ForeignKey(
        PayHeadComputation,
        on_delete=models.CASCADE,
        related_name="slabs"
    )
    effective_from = models.DateField(null=True, blank=True)
    amount_greater_than = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True, default=0
    )
    amount_up_to = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True
    )
    slab_type = models.CharField(
        max_length=20,
        choices=SLAB_TYPE_CHOICES,
        default="percentage"
    )
    value = models.DecimalField(
        max_digits=14, decimal_places=2, default=0
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["effective_from", "order", "id"]
        verbose_name = "Pay Component Computation Slab"
        verbose_name_plural = "Pay Component Computation Slabs"

    def __str__(self):
        return f"{self.computation.pay_head.name} Slab ({self.slab_type}: {self.value})"


class PayHeadComputationFormulaItem(models.Model):
    FUNCTION_CHOICES = [
        ("add_pay_head", "Add Pay Component"),
        ("subtract_pay_head", "Subtract Pay Component"),
        ("divide_by_attendance", "Divide by Attendance Units"),
        ("multiply_with_attendance", "Multiply by Attendance Units"),
    ]

    computation = models.ForeignKey(
        PayHeadComputation,
        on_delete=models.CASCADE,
        related_name="formula_items"
    )
    function = models.CharField(
        max_length=30,
        choices=FUNCTION_CHOICES,
        default="add_pay_head"
    )
    pay_head = models.ForeignKey(
        PayHead,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="used_in_computation_formulas"
    )
    attendance_type = models.ForeignKey(
        AttendanceProductionType,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="used_in_computation_formulas"
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        verbose_name = "Pay Component Computation Formula Item"
        verbose_name_plural = "Pay Component Computation Formula Items"

    def __str__(self):
        target = self.pay_head.name if self.pay_head else (self.attendance_type.name if self.attendance_type else "None")
        return f"{self.computation.pay_head.name} - {self.get_function_display()}: {target}"


class EmployeePayHead(models.Model):
    employee = models.ForeignKey(
        'rarenett_app.Employee',
        on_delete=models.CASCADE,
        related_name='employee_payheads'
    )
    effective_from = models.DateField(null=True, blank=True)
    pay_head = models.ForeignKey(
        PayHead,
        on_delete=models.CASCADE,
        related_name='employee_payheads'
    )
    rate = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True
    )
    per = models.CharField(max_length=50, blank=True, null=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['effective_from', 'order', 'id']
        verbose_name = 'Employee Pay Component'
        verbose_name_plural = 'Employee Pay Components'

    def __str__(self):
        return f"{self.employee} - {self.pay_head.name} ({self.rate}/{self.per})"


