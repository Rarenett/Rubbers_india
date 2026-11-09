from django.db import models
from django.utils import timezone
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation

from inventory_app.models import ProductConfiguration, StockItem
from settings_app.models import PrefixConfiguration


class AccountGroup(models.Model):
    NATURE_CHOICES = [
        ('Asset', 'Asset'),
        ('Liability', 'Liability'),
        ('Income', 'Income'),
        ('Expense', 'Expense'),
    ]
    name = models.CharField(max_length=100, unique=True)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='subgroups')
    nature = models.CharField(max_length=20, choices=NATURE_CHOICES)
    sort_order = models.IntegerField(default=0)
    is_main_head = models.BooleanField(default=False)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL,  on_delete=models.SET_NULL, null=True, related_name='account_groups_created')
    edited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='account_groups_edited')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Account Group"
        verbose_name_plural = "Account Groups"


class Ledger(models.Model):
    name = models.CharField(max_length=100, unique=True)
    accountGroup=models.ForeignKey(AccountGroup, on_delete=models.SET_NULL, null=True, related_name='ledgers')
    maintain_biilwise_details=models.BooleanField(default=False)
    mailing_name=models.CharField(max_length=100, blank=True, null=True)
    address1=models.CharField(max_length=100, blank=True, null=True)
    address2=models.CharField(max_length=100, blank=True, null=True)
    address3=models.CharField(max_length=100, blank=True, null=True)
    address=models.CharField(max_length=100, blank=True, null=True)
    state=models.CharField(max_length=100, blank=True, null=True)
    country=models.CharField(max_length=100, blank=True, null=True)
    pincode=models.CharField(max_length=100, blank=True, null=True)
    phone=models.CharField(max_length=100, blank=True, null=True)
    email=models.EmailField(max_length=100, blank=True, null=True)
    gst_number=models.CharField(max_length=100, blank=True, null=True)
    pan_number=models.CharField(max_length=100, blank=True, null=True)
    credit_limit=models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    opening_balance=models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    OPENING_TYPE_CHOICES = [
        ('Dr', 'Dr'),
        ('Cr', 'Cr'),
    ]
    opening_balance_type = models.CharField(max_length=2, choices=OPENING_TYPE_CHOICES, default='Dr', blank=True, null=True)
    placeofsupply=models.CharField(max_length=100, blank=True, null=True)

    closing_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)        

    REGISTRATION_CHOICES = [
        ('unknown', 'unknown'),
        ('registered', 'registered'),
        ('unregistered', 'unregistered'),
        ('composition','composition'),
 
    ]
    registration_type=models.CharField(max_length=100, choices=REGISTRATION_CHOICES, default='unknown')
    
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='ledgers_created')
    edited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='ledgers_edited')

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Ledger"
        verbose_name_plural = "Ledgers"


class LedgerGst(models.Model):
    ledger = models.ForeignKey(Ledger, on_delete=models.CASCADE, related_name='gst_details')
    applicable_date = models.DateField(blank=True, null=True)
    registration_type = models.CharField(max_length=100, blank=True, null=True)
    gst_number = models.CharField(max_length=100, blank=True, null=True)
    place_of_supply = models.CharField(max_length=100, blank=True, null=True)
    gst_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    hsn_code = models.CharField(max_length=50, blank=True, null=True)

    def __str__(self):
        return f"GST Details for {self.ledger.name}"


class LedgerContactDetail(models.Model):
    ledger = models.ForeignKey(Ledger, on_delete=models.CASCADE, related_name='contact_details')
    contact_name = models.CharField(max_length=100, blank=True, null=True)
    phone_no = models.CharField(max_length=50, blank=True, null=True)
    primary_mobile = models.CharField(max_length=50, blank=True, null=True)
    fax_no = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    cc = models.EmailField(blank=True, null=True)
    website = models.URLField(blank=True, null=True)
    whatsapp_no = models.CharField(max_length=50, blank=True, null=True)
    whatsapp_marketing = models.BooleanField(default=False)

    def __str__(self):
        return f"Contact Details for {self.ledger.name}"


class LedgerBankDetail(models.Model):
    ledger = models.ForeignKey(Ledger, on_delete=models.CASCADE, related_name='bank_details')
    bank_account_no = models.CharField(max_length=100, blank=True, null=True)
    bank_name = models.CharField(max_length=100, blank=True, null=True)
    branch = models.CharField(max_length=100, blank=True, null=True)
    ifsc_code = models.CharField(max_length=50, blank=True, null=True)
    micr_code = models.CharField(max_length=50, blank=True, null=True)
    bank_phone_no = models.CharField(max_length=50, blank=True, null=True)
    attachments = models.FileField(upload_to='ledger_bank_attachments/', blank=True, null=True)

    def __str__(self):
        return f"Bank Details for {self.ledger.name}"


class VoucherType(models.Model):
    """
    Represents a transaction document type (e.g. Sales Order, Purchase Order).
    Managed exclusively from the backend/admin — the frontend only reads this list.
    """
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(
        max_length=50,
        unique=True,
        help_text="Short code identifier, e.g. 'SO' for Sales Order"
    )
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = "Voucher Type"
        verbose_name_plural = "Voucher Types"

    def __str__(self):
        return f"{self.name} ({self.code})"


class ServiceInvoice(models.Model):
    BILL_TYPE_CHOICES = [
        ('b2b', 'B2B'),
        ('b2c', 'B2C'),
        ('igst', 'IGST'),
    ]
    invoice_no = models.CharField(max_length=50, unique=True)
    invoice_date = models.DateField()
    customer = models.ForeignKey(Ledger, on_delete=models.CASCADE, related_name='service_invoices')
    bill_type = models.CharField(max_length=20, choices=BILL_TYPE_CHOICES, default='b2b')

    cgst = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    sgst = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    igst = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)

    gst_ledger_1 = models.ForeignKey(Ledger, on_delete=models.SET_NULL, null=True, blank=True, related_name='service_invoice_gst1')
    gst_ledger_2 = models.ForeignKey(Ledger, on_delete=models.SET_NULL, null=True, blank=True, related_name='service_invoice_gst2')

    other_charges = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    round_off = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    net_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    narration = models.TextField(null=True, blank=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='service_invoices_created')
    edited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='service_invoices_edited')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Invoice {self.invoice_no} - {self.customer.name}"

    class Meta:
        verbose_name = "Service Invoice"
        verbose_name_plural = "Service Invoices"


class ServiceInvoiceDetail(models.Model):
    invoice = models.ForeignKey(ServiceInvoice, on_delete=models.CASCADE, related_name='details')
    service_ledger = models.ForeignKey(Ledger, on_delete=models.CASCADE, related_name='service_invoice_details')
    rate = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    hsn = models.CharField(max_length=50, blank=True, null=True)
    gst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    gross = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    cgst = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    sgst = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    igst = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)

    def __str__(self):
        return f"Detail for Invoice {self.invoice.invoice_no}"


class JournalVoucher(models.Model):
    voucher_no = models.CharField(max_length=50, unique=True)
    voucher_date = models.DateField()
    narration = models.TextField(null=True, blank=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='journal_vouchers_created')
    edited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='journal_vouchers_edited')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Journal Voucher {self.voucher_no}"

    class Meta:
        verbose_name = "Journal Voucher"
        verbose_name_plural = "Journal Vouchers"


class JournalVoucherDetail(models.Model):
    ENTRY_TYPE_CHOICES = [
        ('Dr', 'Debit'),
        ('Cr', 'Credit'),
    ]
    voucher = models.ForeignKey(JournalVoucher, on_delete=models.CASCADE, related_name='details')
    entry_type = models.CharField(max_length=10, choices=ENTRY_TYPE_CHOICES, default='Dr')
    ledger = models.ForeignKey(Ledger, on_delete=models.CASCADE, related_name='journal_details')
    debit_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    credit_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    narration = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self):
        return f"Detail for Journal {self.voucher.voucher_no} - {self.ledger.name}"


class ReceiptVoucher(models.Model):
    voucher_no = models.CharField(max_length=50, unique=True)
    voucher_date = models.DateField()
    narration = models.TextField(null=True, blank=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='receipt_vouchers_created')
    edited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='receipt_vouchers_edited')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Receipt Voucher {self.voucher_no}"

    class Meta:
        verbose_name = "Receipt Voucher"
        verbose_name_plural = "Receipt Vouchers"


class ReceiptVoucherDetail(models.Model):
    ENTRY_TYPE_CHOICES = [
        ('Dr', 'Debit'),
        ('Cr', 'Credit'),
    ]
    voucher = models.ForeignKey(ReceiptVoucher, on_delete=models.CASCADE, related_name='details')
    entry_type = models.CharField(max_length=10, choices=ENTRY_TYPE_CHOICES, default='Dr')
    ledger = models.ForeignKey(Ledger, on_delete=models.CASCADE, related_name='receipt_details')
    debit_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    credit_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    narration = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self):
        return f"Detail for Receipt {self.voucher.voucher_no} - {self.ledger.name}"


class PaymentVoucher(models.Model):
    voucher_no = models.CharField(max_length=50, unique=True)
    voucher_date = models.DateField()
    narration = models.TextField(null=True, blank=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='payment_vouchers_created')
    edited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='payment_vouchers_edited')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Payment Voucher {self.voucher_no}"

    class Meta:
        verbose_name = "Payment Voucher"
        verbose_name_plural = "Payment Vouchers"


class PaymentVoucherDetail(models.Model):
    ENTRY_TYPE_CHOICES = [
        ('Dr', 'Debit'),
        ('Cr', 'Credit'),
    ]
    voucher = models.ForeignKey(PaymentVoucher, on_delete=models.CASCADE, related_name='details')
    entry_type = models.CharField(max_length=10, choices=ENTRY_TYPE_CHOICES, default='Dr')
    ledger = models.ForeignKey(Ledger, on_delete=models.CASCADE, related_name='payment_details')
    debit_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    credit_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    narration = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self):
        return f"Detail for Payment {self.voucher.voucher_no} - {self.ledger.name}"


class BillAllocation(models.Model):
    ALLOCATION_TYPES = [
        ('Agst Ref', 'Against Reference'),
        ('New Ref', 'New Reference'),
        ('Advance', 'Advance'),
        ('On Account', 'On Account'),
    ]
    payment_detail = models.ForeignKey(
        PaymentVoucherDetail, 
        on_delete=models.CASCADE, 
        related_name='bill_allocations', 
        null=True, 
        blank=True
    )
    receipt_detail = models.ForeignKey(
        ReceiptVoucherDetail, 
        on_delete=models.CASCADE, 
        related_name='bill_allocations', 
        null=True, 
        blank=True
    )
    journal_detail = models.ForeignKey(
        JournalVoucherDetail, 
        on_delete=models.CASCADE, 
        related_name='bill_allocations', 
        null=True, 
        blank=True
    )
    against_purchase_invoice = models.ForeignKey(
        'purchase_app.PurchaseInvoice', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='bill_allocations'
    )
    against_sales_invoice = models.ForeignKey(
        'sales_app.SalesInvoice', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='bill_allocations'
    )
    allocation_type = models.CharField(max_length=20, choices=ALLOCATION_TYPES)
    name = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=15, decimal_places=2)

    def save(self, *args, **kwargs):
        if self.amount is not None:
            from decimal import Decimal
            self.amount = Decimal(str(self.amount)).quantize(Decimal('0.00'))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.allocation_type} - {self.name} - {self.amount}"


class ContraVoucher(models.Model):
    voucher_no = models.CharField(max_length=50, unique=True)
    voucher_date = models.DateField()
    narration = models.TextField(null=True, blank=True)

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='contra_vouchers_created')
    edited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='contra_vouchers_edited')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Contra Voucher {self.voucher_no}"

    class Meta:
        verbose_name = "Contra Voucher"
        verbose_name_plural = "Contra Vouchers"


class ContraVoucherDetail(models.Model):
    ENTRY_TYPE_CHOICES = [
        ('Dr', 'Debit'),
        ('Cr', 'Credit'),
    ]
    voucher = models.ForeignKey(ContraVoucher, on_delete=models.CASCADE, related_name='details')
    entry_type = models.CharField(max_length=10, choices=ENTRY_TYPE_CHOICES, default='Dr')
    ledger = models.ForeignKey(Ledger, on_delete=models.CASCADE, related_name='contra_details')
    debit_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    credit_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    narration = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self):
        return f"Detail for Contra {self.voucher.voucher_no} - {self.ledger.name}"


class VoucherExtraCharge(models.Model):
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    voucher = GenericForeignKey('content_type', 'object_id')
    
    ledger = models.ForeignKey('finance_app.Ledger', on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"{self.ledger.name} - {self.amount}"



class Quotation(models.Model):
    order_type = models.CharField(max_length=100, default='STATE', null=True, blank=True)

    quotation_no = models.CharField(max_length=50, unique=True)
    entry_date = models.DateField(default=timezone.now)
    customer_ledger = models.ForeignKey('finance_app.Ledger', on_delete=models.CASCADE, related_name='quotations', null=True)

    gst_ledger_1 = models.ForeignKey('finance_app.Ledger', on_delete=models.CASCADE, related_name='quotation_gst1', null=True, blank=True)
    gst_amount_1 = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    gst_ledger_2 = models.ForeignKey('finance_app.Ledger', on_delete=models.CASCADE, related_name='quotation_gst2', null=True, blank=True)
    gst_amount_2 = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    narration = models.TextField(null=True, blank=True)
    is_posted = models.BooleanField(default=False)

    other_reference = models.CharField(max_length=200, null=True, blank=True)
    terms_of_delivery = models.CharField(max_length=200, null=True, blank=True)
    dispatch_through = models.CharField(max_length=200, null=True, blank=True)
    document_no = models.CharField(max_length=200, null=True, blank=True)
    document_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, related_name='quotations_created')
    edited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='quotations_edited')
    updated_at = models.DateTimeField(auto_now=True)

    extra_charges = GenericRelation(VoucherExtraCharge, related_query_name='quotation')

    def __str__(self):
        return self.quotation_no


class QuotationItem(models.Model):
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name='items', null=True)
    product = models.ForeignKey('inventory_app.StockItem', on_delete=models.CASCADE, null=True)
    warehouse = models.ForeignKey('settings_app.Warehouse', on_delete=models.CASCADE, null=True, blank=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    rate = models.DecimalField(max_digits=12, decimal_places=2)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    gst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    gst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    cgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    sgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    igst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    amount = models.DecimalField(max_digits=15, decimal_places=2)  # Base amount

    per = models.ForeignKey(
        'inventory_app.Unit',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quotation_items',
        help_text="Unit of measurement (e.g. NOS, KGS)"
    )

    batch_number = models.CharField(max_length=100, blank=True, null=True)
    manufacture_date = models.DateField(blank=True, null=True)
    expiry_date = models.DateField(blank=True, null=True)
    hsn = models.CharField(max_length=50, blank=True, null=True)

    def save(self, *args, **kwargs):
        if self.product:
            from inventory_app.models import StockItemHSN, StockGroupHSN, StockCategoryHSN
            order_date = None
            if self.quotation:
                order_date = self.quotation.entry_date

            hsn_number = None

            # 1. Try to find applicable StockItemHSN
            qs = StockItemHSN.objects.filter(stock_item=self.product)
            if order_date:
                qs = qs.filter(applicable_date__lte=order_date)
            rec = qs.order_by('-applicable_date').first()
            if rec:
                hsn_number = rec.hsn_number

            # 2. Try to find applicable StockGroupHSN
            if not hsn_number and self.product.stock_group:
                qs = StockGroupHSN.objects.filter(stock_group=self.product.stock_group)
                if order_date:
                    qs = qs.filter(applicable_date__lte=order_date)
                rec = qs.order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number

            # 3. Try to find applicable StockCategoryHSN
            if not hsn_number and self.product.stock_category:
                qs = StockCategoryHSN.objects.filter(stock_category=self.product.stock_category)
                if order_date:
                    qs = qs.filter(applicable_date__lte=order_date)
                rec = qs.order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number

            # 4. Fallback to latest StockItemHSN overall
            if not hsn_number:
                rec = StockItemHSN.objects.filter(stock_item=self.product).order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number

            # 5. Fallback to latest StockGroupHSN overall
            if not hsn_number and self.product.stock_group:
                rec = StockGroupHSN.objects.filter(stock_group=self.product.stock_group).order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number

            # 6. Fallback to latest StockCategoryHSN overall
            if not hsn_number and self.product.stock_category:
                rec = StockCategoryHSN.objects.filter(stock_category=self.product.stock_category).order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number

            if hsn_number:
                self.hsn = hsn_number
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product.name} - {self.quantity}"


class QuotationTransaction(models.Model):
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name='transactions', help_text="The Quotation being consumed", null=True)
    product = models.ForeignKey('inventory_app.StockItem', on_delete=models.CASCADE, null=True)
    transaction_date = models.DateField(default=timezone.now)
    quantity_ordered = models.DecimalField(max_digits=12, decimal_places=3, default=0.000, help_text="Quantity consumed by this PO")
    quantity_remaining = models.DecimalField(max_digits=12, decimal_places=3, default=0.000, help_text="Quantity left in the quotation after this PO")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['quotation', 'product'])]

    def __str__(self):
        return f"{self.quotation.quotation_no} - {self.product.name}: {self.quantity_ordered} ordered"


class StockJournalType(models.Model):
    MOVEMENT_TYPE_CHOICES = (
        ('IN', 'Production'),
        ('OUT', 'Consumption'),
        ('IN & OUT', 'Production/Consumption'),
    )

    stock_journal_type = models.CharField(max_length=100, unique=True)
    movement_type = models.CharField(
        max_length=20,
        choices=MOVEMENT_TYPE_CHOICES
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['stock_journal_type']
        verbose_name = "Stock Journal Type"
        verbose_name_plural = "Stock Journal Types"

    def __str__(self):
        return self.stock_journal_type


class StockJournal(models.Model):
    journal_no = models.CharField(max_length=100, unique=True)
    journal_date = models.DateField()
    stock_journal_type = models.ForeignKey(
        'StockJournalType',
        on_delete=models.PROTECT,
        related_name='stock_journals'
    )
    narration = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-journal_date', '-id']
        verbose_name = 'Stock Journal'
        verbose_name_plural = 'Stock Journals'

    def __str__(self):
        return f"{self.journal_no} - {self.journal_date}"


class StockJournalDetails(models.Model):
    stock_journal = models.ForeignKey(
        'StockJournal',
        on_delete=models.CASCADE,
        related_name='details'
    )
    stock_item = models.ForeignKey(
        StockItem,
        on_delete=models.PROTECT,
        related_name='stock_journal_details'
    )
    configuration = models.ForeignKey(
        ProductConfiguration,
        on_delete=models.PROTECT,
        related_name='stock_journal_details',
        null=True,
        blank=True
    )
    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=3,
        default=0
    )
    rate = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0
    )
    amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0
    )

    # Batch / Location details (optional — controlled by ProductConfiguration)
    warehouse = models.ForeignKey(
        'settings_app.Warehouse',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stock_journal_details'
    )
    batch_number = models.CharField(max_length=100, null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    manufacture_date = models.DateField(null=True, blank=True)
    entry_type = models.CharField(
        max_length=10,
        choices=(('OUT', 'Consumption'), ('IN', 'Production')),
        default='IN'
    )

    class Meta:
        verbose_name = 'Stock Journal Detail'
        verbose_name_plural = 'Stock Journal Details'

    def __str__(self):
        return f"{self.stock_journal} - {self.stock_item}"


class ManufacturalJournalType(models.Model):
    MOVEMENT_TYPE_CHOICES = (
        ('IN', 'Production'),
        ('OUT', 'Consumption'),
        ('IN & OUT', 'Production/Consumption'),
    )

    manufactural_journal_type = models.CharField(max_length=100, unique=True)
    movement_type = models.CharField(
        max_length=20,
        choices=MOVEMENT_TYPE_CHOICES
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['manufactural_journal_type']
        verbose_name = "Manufactural Journal Type"
        verbose_name_plural = "Manufactural Journal Types"

    def __str__(self):
        return self.manufactural_journal_type


class ManufacturalJournal(models.Model):
    journal_no = models.CharField(max_length=100, unique=True)
    journal_date = models.DateField()
    manufactural_journal_type = models.ForeignKey(
        'ManufacturalJournalType',
        on_delete=models.PROTECT,
        related_name='manufactural_journals'
    )
    narration = models.TextField(blank=True, null=True)
    batch_number = models.CharField(max_length=100, null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    rnd_entry = models.ForeignKey(
        'rd_app.RnDEntry',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='manufactural_journals'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-journal_date', '-id']
        verbose_name = 'Manufactural Journal'
        verbose_name_plural = 'Manufactural Journals'

    def __str__(self):
        return f"{self.journal_no} - {self.journal_date}"


class ManufacturalJournalDetails(models.Model):
    manufactural_journal = models.ForeignKey(
        'ManufacturalJournal',
        on_delete=models.CASCADE,
        related_name='details'
    )
    stock_item = models.ForeignKey(
        StockItem,
        on_delete=models.PROTECT,
        related_name='manufactural_journal_details'
    )
    configuration = models.ForeignKey(
        ProductConfiguration,
        on_delete=models.PROTECT,
        related_name='manufactural_journal_details',
        null=True,
        blank=True
    )
    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=3,
        default=0
    )
    rate = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0
    )
    amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0
    )

    # Batch / Location details (optional — controlled by ProductConfiguration)
    warehouse = models.ForeignKey(
        'settings_app.Warehouse',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='manufactural_journal_details'
    )
    batch_number = models.CharField(max_length=100, null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    manufacture_date = models.DateField(null=True, blank=True)
    entry_type = models.CharField(
        max_length=10,
        choices=(('OUT', 'Consumption'), ('IN', 'Production')),
        default='IN'
    )

    class Meta:
        verbose_name = 'Manufactural Journal Detail'
        verbose_name_plural = 'Manufactural Journal Details'

    def __str__(self):
        return f"{self.manufactural_journal} - {self.stock_item}"

