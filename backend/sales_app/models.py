from django.db import models
from django.utils import timezone
from django.contrib.contenttypes.fields import GenericRelation
from finance_app.models import VoucherExtraCharge


class DeliveryLocation(models.Model):
    """
    Stores named delivery locations linked to a customer (Ledger).
    """
    delivery_location = models.ForeignKey(
        'logistics_app.RouteStopMaster',
        on_delete=models.CASCADE,
        related_name='customer_mappings',
        verbose_name='Delivery Location (Route Stop)',
        null=True,
        blank=True
    )
    customer = models.ForeignKey(
        'finance_app.Ledger',
        on_delete=models.CASCADE,
        related_name='delivery_locations',
        verbose_name='Customer (Ledger)',
        null=True,
        blank=True
    )

    class Meta:
        ordering = ['delivery_location__stop_name']
        verbose_name = 'Delivery Location'
        verbose_name_plural = 'Delivery Locations'
        unique_together = ('delivery_location', 'customer')

    def __str__(self):
        customer_name = self.customer.name if self.customer else 'No Customer'
        loc_name = self.delivery_location.stop_name if self.delivery_location else 'Unknown Location'
        return f"{loc_name} ({customer_name})"




class SalesOrder(models.Model):
    order_type = models.CharField(max_length=100, default='STATE', null=True, blank=True)

    so_no = models.CharField(max_length=50, unique=True)
    entry_date = models.DateField(default=timezone.now)
    customer_ledger = models.ForeignKey('finance_app.Ledger', on_delete=models.CASCADE, related_name='sales_orders_customers', null=True)
    sales_ledger = models.ForeignKey('finance_app.Ledger', on_delete=models.CASCADE, related_name='sales_orders_sales_ledger', null=True, blank=True)

    gst_ledger_1 = models.ForeignKey('finance_app.Ledger', on_delete=models.CASCADE, related_name='sales_order_gst1', null=True, blank=True)
    gst_amount_1 = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    gst_ledger_2 = models.ForeignKey('finance_app.Ledger', on_delete=models.CASCADE, related_name='sales_order_gst2', null=True, blank=True)
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
    created_by = models.ForeignKey('register_app.CustomUser', on_delete=models.CASCADE, null=True, related_name='sales_orders_created')
    edited_by = models.ForeignKey('register_app.CustomUser', on_delete=models.SET_NULL, null=True, related_name='sales_orders_edited')
    updated_at = models.DateTimeField(auto_now=True)

    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Confirmed', 'Confirmed'),
        ('On Hold', 'On Hold'),
        ('Loading', 'Loading'),
        ('Partially Loaded', 'Partially Loaded'),
        ('Loaded', 'Loaded'),
        ('Shipped', 'Shipped'),
        ('In Transit', 'In Transit'),
        ('Delivered', 'Delivered'),
        ('Returned', 'Returned'),
        ('Cancelled', 'Cancelled'),
    ]
    PRIORITY_CHOICES = [
        ('Urgent', 'Urgent (High)'),
        ('Standard', 'Standard (Medium)'),
        ('Low', 'Low (Flexible)'),
    ]
    
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='Standard')
    preferred_delivery_date = models.DateTimeField(null=True, blank=True)
    delivery_location = models.ForeignKey(
        'logistics_app.RouteStopMaster',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales_orders',
        verbose_name="Delivery Location"
    )
    driver = models.ForeignKey('logistics_app.Driver', on_delete=models.SET_NULL, null=True, blank=True, related_name='sales_orders')
    vehicle = models.ForeignKey('logistics_app.Vehicle', on_delete=models.SET_NULL, null=True, blank=True, related_name='sales_orders')
    trip = models.ForeignKey('logistics_app.TripMaster', on_delete=models.SET_NULL, null=True, blank=True, related_name='loaded_sales_orders')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    
    APPROVAL_STATUS_CHOICES = [
        ('Approved', 'Approved'),
        ('Not Approved', 'Not Approved'),
    ]
    approval_status = models.CharField(max_length=20, choices=APPROVAL_STATUS_CHOICES, default='Approved')
    
    SYNC_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('queued', 'Queued'),
        ('processing', 'Processing'),
        ('synced', 'Synced'),
        ('failed', 'Failed'),
    ]
    sync_status = models.CharField(max_length=20, choices=SYNC_STATUS_CHOICES, default='pending')
    is_synced = models.BooleanField(default=False)
    # Persisted Tally REMOTEID/GUID set on the first successful Create push.
    # Never overwritten — used as the stable identifier for all future Alter pushes.
    tally_guid = models.CharField(max_length=128, blank=True, null=True)

    INVOICE_STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Partially Invoiced', 'Partially Invoiced'),
        ('Fully Invoiced', 'Fully Invoiced'),
    ]
    invoice_status = models.CharField(max_length=20, choices=INVOICE_STATUS_CHOICES, default='Pending')

    extra_charges = GenericRelation(VoucherExtraCharge, related_query_name='sales_order')

    def __str__(self):
        return self.so_no

    @classmethod
    def generate_next_so_no(cls, order_type=None, prefix_config_id=None):
        import re
        from django.db import models as django_models
        prefix = "SO"
        padding = 3
        starting_number = 1
        postfix = ""
        
        try:
            from settings_app.models import PrefixConfiguration
            qs = PrefixConfiguration.objects.filter(
                django_models.Q(voucher_type__name__iexact="Sales Order") |
                django_models.Q(voucher_type__code__iexact="SO")
            )
            config = None
            if prefix_config_id:
                config = qs.filter(pk=prefix_config_id).first()
            elif order_type:
                config = qs.filter(
                    django_models.Q(sub_type__iexact=order_type) |
                    django_models.Q(subvoucher_type__type_name__iexact=order_type)
                ).first()
            if not config:
                config = qs.first()
            if config:
                prefix = config.prefix or "SO"
                padding = config.number_padding or 3
                starting_number = config.starting_number or 1
                postfix = config.postfix or ""
        except Exception:
            pass
        
        separator = "-" if not prefix.endswith("-") else ""
        
        # Find the next number
        lookup_prefix = f"{prefix}{separator}"
        existing_orders = cls.objects.filter(so_no__startswith=lookup_prefix)
        
        max_num = starting_number - 1
        for order in existing_orders:
            # Extract number using regex after the prefix
            num_part = order.so_no[len(lookup_prefix):]
            if postfix:
                num_part = num_part.replace(postfix, "")
            match = re.search(r'^\d+', num_part)
            if match:
                try:
                    val = int(match.group())
                    if val > max_num:
                        max_num = val
                except ValueError:
                    pass
        
        next_num = max_num + 1
        padded_num = str(next_num).zfill(padding)
        return f"{prefix}{separator}{padded_num}{postfix}"

    def clean(self):
        super().clean()
        from django.core.exceptions import ValidationError
        
        if self.customer_ledger and self.customer_ledger.credit_limit > 0:
            outstanding_amount = float(self.customer_ledger.closing_balance) + float(self.total_amount or 0)
            if outstanding_amount > float(self.customer_ledger.credit_limit):
                raise ValidationError({
                    'customer_ledger': f"Credit limit exceeded. Outstanding: {outstanding_amount}, Limit: {self.customer_ledger.credit_limit}"
                })

    def update_invoice_status(self):
        items = self.items.all()
        if not items.exists():
            return
            
        all_fully_invoiced = True
        any_invoiced = False
        
        for item in items:
            # Consider fully invoiced if invoiced >= quantity
            if item.invoiced_quantity >= item.quantity:
                any_invoiced = True
            elif item.invoiced_quantity > 0:
                any_invoiced = True
                all_fully_invoiced = False
            else:
                all_fully_invoiced = False
                
        if all_fully_invoiced:
            self.invoice_status = 'Fully Invoiced'
        elif any_invoiced:
            self.invoice_status = 'Partially Invoiced'
        else:
            self.invoice_status = 'Pending'
        self.save(update_fields=['invoice_status'])

    def save(self, *args, **kwargs):
        if not self.so_no:
            self.so_no = self.generate_next_so_no()
        super().save(*args, **kwargs)


class SalesOrderItem(models.Model):
    sales_order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name='items', null=True)

    product = models.ForeignKey('inventory_app.StockItem', on_delete=models.CASCADE, null=True)
    warehouse = models.ForeignKey('settings_app.Warehouse', on_delete=models.CASCADE, null=True, blank=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    invoiced_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    rate = models.DecimalField(max_digits=12, decimal_places=2)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    gst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    gst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    cgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    sgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    igst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)    
    amount = models.DecimalField(max_digits=15, decimal_places=2) # Base amount

    per = models.ForeignKey(
        'inventory_app.Unit',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales_order_items',
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
            if self.sales_order:
                order_date = self.sales_order.entry_date
            
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
        prod_name = self.product.name if self.product else "No Product"
        return f"{prod_name} - {self.quantity}"
    

class SalesOrderTransaction(models.Model):
    sales_order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name='so_transactions', help_text="The Sales Order being consumed", null=True)
    product = models.ForeignKey('inventory_app.StockItem', on_delete=models.CASCADE, null=True)
    transaction_date = models.DateField(default=timezone.now)
    quantity_delivered = models.DecimalField(max_digits=12, decimal_places=3, default=0.000, help_text="Quantity consumed by this DN")
    quantity_remaining = models.DecimalField(max_digits=12, decimal_places=3, default=0.000, help_text="Quantity left in the SO after this DN")
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        prod_name = self.product.name if self.product else "No Product"
        so_no = self.sales_order.so_no if self.sales_order else "No SO"
        return f"{so_no} - {prod_name}: {self.quantity_delivered} delivered"


class SalesInvoice(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Confirmed', 'Confirmed'),
        ('On Hold', 'On Hold'),
        ('Loading', 'Loading'),
        ('Shipped', 'Shipped'),
        ('Delivered', 'Delivered'),
        ('Returned', 'Returned'),
        ('Cancelled', 'Cancelled'),
    ]
    
    PRIORITY_CHOICES = [
        ('Urgent', 'Urgent (High)'),
        ('Standard', 'Standard (Medium)'),
        ('Low', 'Low (Flexible)'),
    ]

    voucher_type = models.ForeignKey('finance_app.VoucherType', on_delete=models.CASCADE, null=True, blank=True)
    invoice_no = models.CharField(max_length=50, unique=True)
    entry_date = models.DateField(default=timezone.now)
    sales_ledger = models.ForeignKey('finance_app.Ledger', on_delete=models.CASCADE, related_name='invoice_sales', null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='Standard')
    preferred_delivery_date = models.DateField(null=True, blank=True)
    customer_ledger = models.ForeignKey('finance_app.Ledger', on_delete=models.CASCADE, related_name='invoice_customers', null=True)
    buyer_address = models.TextField(null=True, blank=True)
    buyer_gst_no = models.CharField(max_length=20, null=True, blank=True)
    shipping_address = models.TextField(null=True, blank=True)
    
    gst_ledger_1 = models.ForeignKey('finance_app.Ledger', on_delete=models.CASCADE, related_name='sales_invoice_gst1', null=True, blank=True)
    gst_amount_1 = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    gst_ledger_2 = models.ForeignKey('finance_app.Ledger', on_delete=models.CASCADE, related_name='sales_invoice_gst2', null=True, blank=True)
    gst_amount_2 = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    narration = models.TextField(null=True, blank=True)
    is_posted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey('register_app.CustomUser', on_delete=models.CASCADE, null=True)
    edited_by = models.ForeignKey('register_app.CustomUser', on_delete=models.SET_NULL, null=True, related_name='edited_sales_invoices')
    updated_at = models.DateTimeField(auto_now=True)
    is_stock_reserved = models.BooleanField(default=False)
    on_hold_reason = models.CharField(max_length=255, blank=True, null=True, help_text="Reason for On Hold status")

    # Track which sales orders were used to create this Sales Invoice
    sales_orders = models.ManyToManyField('SalesOrder', blank=True, related_name='sales_invoices')

    SYNC_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('queued', 'Queued'),
        ('processing', 'Processing'),
        ('synced', 'Synced'),
        ('failed', 'Failed'),
    ]
    sync_status = models.CharField(max_length=20, choices=SYNC_STATUS_CHOICES, default='pending')
    is_synced = models.BooleanField(default=False)
    # Persisted Tally REMOTEID/GUID set on the first successful Create push.
    # Never overwritten — used as the stable identifier for all future Alter pushes.
    tally_guid = models.CharField(max_length=128, blank=True, null=True)

    def __str__(self):
        return self.invoice_no

    @classmethod
    def generate_next_invoice_no(cls, config_id=None):
        import re
        prefix = "SI"
        padding = 4
        starting_number = 1
        postfix = ""
        branch_code = ""
        
        try:
            from settings_app.models import PrefixConfiguration
            config = None
            if config_id:
                config = PrefixConfiguration.objects.filter(id=config_id).first()
            if not config:
                config = PrefixConfiguration.objects.filter(
                    subvoucher_type__type_name__iexact="Sales Invoice"
                ).first()
            if not config:
                config = PrefixConfiguration.objects.filter(
                    voucher_type__name__iexact="Sales"
                ).first()
                
            if config:
                prefix = config.prefix or "SI"
                padding = config.number_padding or 4
                starting_number = config.starting_number or 1
                postfix = config.postfix or ""
                if config.branch and config.branch.branch_code:
                    branch_code = config.branch.branch_code
        except Exception as e:
            print("Error generating sales invoice next no:", e)
        
        prefix_str = f"{branch_code}-{prefix}" if branch_code else prefix
        separator = "-" if not prefix_str.endswith("-") else ""
        lookup_prefix = f"{prefix_str}{separator}"
        
        existing_invoices = cls.objects.filter(invoice_no__startswith=lookup_prefix)
        
        max_num = starting_number - 1
        for inv in existing_invoices:
            num_part = inv.invoice_no[len(lookup_prefix):]
            if postfix:
                clean_postfix = postfix if (postfix.startswith('/') or postfix.startswith('-')) else f"/{postfix}"
                num_part = num_part.replace(clean_postfix, "")
                num_part = num_part.replace(postfix, "")
            match = re.search(r'^\d+', num_part)
            if match:
                try:
                    val = int(match.group())
                    if val > max_num:
                        max_num = val
                except ValueError:
                    pass
        
        next_num = max_num + 1
        padded_num = str(next_num).zfill(padding)
        
        code = f"{lookup_prefix}{padded_num}"
        if postfix:
            if postfix.startswith('/') or postfix.startswith('-'):
                code += postfix
            else:
                code += f"/{postfix}"
        return code

    def save(self, *args, **kwargs):
        if not self.invoice_no:
            self.invoice_no = self.generate_next_invoice_no()
        super().save(*args, **kwargs)


class SalesInvoiceItem(models.Model):
    invoice = models.ForeignKey(SalesInvoice, on_delete=models.CASCADE, related_name='items')
    sales_order = models.ForeignKey('SalesOrder', on_delete=models.SET_NULL, null=True, blank=True, related_name='si_items')
    sales_order_item = models.ForeignKey('SalesOrderItem', on_delete=models.SET_NULL, null=True, blank=True, related_name='invoiced_records')
    product = models.ForeignKey('inventory_app.StockItem', on_delete=models.CASCADE)
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
    amount = models.DecimalField(max_digits=15, decimal_places=2) # Base amount

    batch_number = models.CharField(max_length=100, blank=True, null=True)
    manufacture_date = models.DateField(blank=True, null=True)
    expiry_date = models.DateField(blank=True, null=True)
    per = models.ForeignKey(
        'inventory_app.Unit',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales_invoice_items',
        help_text="Unit of measurement (e.g. NOS, KGS)"
    )
    hsn = models.CharField(max_length=50, blank=True, null=True)

    def save(self, *args, **kwargs):
        if self.product:
            from inventory_app.models import StockItemHSN, StockGroupHSN, StockCategoryHSN
            invoice_date = None
            if self.invoice:
                invoice_date = self.invoice.entry_date
            
            hsn_number = None

            # 1. Item-level HSN
            qs = StockItemHSN.objects.filter(stock_item=self.product)
            if invoice_date:
                qs = qs.filter(applicable_date__lte=invoice_date)
            rec = qs.order_by('-applicable_date').first()
            if rec and getattr(rec, 'hsn_number', None):
                hsn_number = rec.hsn_number

            # 2. StockGroup-level HSN
            if not hsn_number and self.product.stock_group:
                qs = StockGroupHSN.objects.filter(stock_group=self.product.stock_group)
                if invoice_date:
                    qs = qs.filter(applicable_date__lte=invoice_date)
                rec = qs.order_by('-applicable_date').first()
                if rec and getattr(rec, 'hsn_number', None):
                    hsn_number = rec.hsn_number

            # 3. StockCategory-level HSN
            if not hsn_number and self.product.stock_category:
                qs = StockCategoryHSN.objects.filter(stock_category=self.product.stock_category)
                if invoice_date:
                    qs = qs.filter(applicable_date__lte=invoice_date)
                rec = qs.order_by('-applicable_date').first()
                if rec and getattr(rec, 'hsn_number', None):
                    hsn_number = rec.hsn_number

            # 4. Fallback to latest StockItemHSN overall
            if not hsn_number:
                rec = StockItemHSN.objects.filter(stock_item=self.product).order_by('-applicable_date').first()
                if rec and getattr(rec, 'hsn_number', None):
                    hsn_number = rec.hsn_number

            # 5. Fallback to latest StockGroupHSN overall
            if not hsn_number and self.product.stock_group:
                rec = StockGroupHSN.objects.filter(stock_group=self.product.stock_group).order_by('-applicable_date').first()
                if rec and getattr(rec, 'hsn_number', None):
                    hsn_number = rec.hsn_number

            # 6. Fallback to latest StockCategoryHSN overall
            if not hsn_number and self.product.stock_category:
                rec = StockCategoryHSN.objects.filter(stock_category=self.product.stock_category).order_by('-applicable_date').first()
                if rec and getattr(rec, 'hsn_number', None):
                    hsn_number = rec.hsn_number

            if hsn_number:
                self.hsn = hsn_number

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product.name} - {self.quantity}"


class SalesInvoiceExtraCharge(models.Model):
    """Extra charges (freight, loading, etc.) attached to a Sales Invoice."""
    invoice = models.ForeignKey(
        SalesInvoice,
        on_delete=models.CASCADE,
        related_name='extra_charges'
    )
    ledger = models.ForeignKey(
        'finance_app.Ledger',
        on_delete=models.CASCADE
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"{self.ledger.name} - {self.amount}"


class DailyEntry(models.Model):
    entry_date = models.DateField(default=timezone.now, unique=True)
    total_sales = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    total_outstanding = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    
    created_by = models.ForeignKey('register_app.CustomUser', on_delete=models.SET_NULL, null=True, related_name='daily_entries_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-entry_date']
        verbose_name = "Daily Entry"
        verbose_name_plural = "Daily Entries"

    def __str__(self):
        return f"Daily Entry - {self.entry_date}"


class DailyProductionItem(models.Model):
    daily_entry = models.ForeignKey(DailyEntry, on_delete=models.CASCADE, related_name='production_items')
    product = models.ForeignKey('inventory_app.StockItem', on_delete=models.CASCADE, related_name='daily_production_items')
    quantity = models.DecimalField(max_digits=12, decimal_places=3, default=0.000)
    sales_quantity = models.DecimalField(max_digits=12, decimal_places=3, default=0.000)

    class Meta:
        unique_together = ('daily_entry', 'product')
        verbose_name = "Daily Production Item"
        verbose_name_plural = "Daily Production Items"

    def __str__(self):
        return f"{self.product.name} - {self.quantity}"

    
class SalesReturn(models.Model):
    GST_TYPE_CHOICES = [
        ('STATE', 'STATE'),
        ('INTER_STATE', 'INTER STATE'),
        ('UNREGISTERED', 'UNREGISTERED'),
    ]

    voucher_type = models.CharField(max_length=50, default='B2B Sales', blank=True)
    return_type = models.CharField(max_length=20, choices=GST_TYPE_CHOICES, default='STATE')
    return_no = models.CharField(max_length=50, unique=True)
    entry_date = models.DateField(default=timezone.now)

    customer_ledger = models.ForeignKey(
        'finance_app.Ledger',
        on_delete=models.CASCADE,
        related_name='sales_returns_customers',
    )
    sales_ledger = models.ForeignKey(
        'finance_app.Ledger',
        on_delete=models.CASCADE,
        related_name='sales_returns_ledgers',
        null=True, blank=True,
    )

    sales_invoice_no = models.CharField(max_length=100, null=True, blank=True)
    sales_invoice_date = models.DateField(null=True, blank=True)

    gst_ledger_1 = models.ForeignKey(
        'finance_app.Ledger',
        on_delete=models.CASCADE,
        related_name='sales_return_gst1',
        null=True, blank=True,
    )
    gst_amount_1 = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    gst_ledger_2 = models.ForeignKey(
        'finance_app.Ledger',
        on_delete=models.CASCADE,
        related_name='sales_return_gst2',
        null=True, blank=True,
    )
    gst_amount_2 = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    narration = models.TextField(null=True, blank=True)
    is_posted = models.BooleanField(default=False)

    SYNC_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('queued', 'Queued'),
        ('processing', 'Processing'),
        ('synced', 'Synced'),
        ('failed', 'Failed'),
    ]
    sync_status = models.CharField(max_length=20, choices=SYNC_STATUS_CHOICES, default='pending')
    is_synced = models.BooleanField(default=False)
    # Persisted Tally REMOTEID/GUID set on the first successful Create push.
    # Never overwritten — used as the stable identifier for all future Alter pushes.
    tally_guid = models.CharField(max_length=128, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'register_app.CustomUser',
        on_delete=models.CASCADE,
        null=True,
        related_name='sales_returns_created',
    )
    edited_by = models.ForeignKey(
        'register_app.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        related_name='sales_returns_edited',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.return_no

    @classmethod
    def generate_next_return_no(cls, prefix_id=None):
        import re
        prefix = "SR"
        padding = 5
        starting_number = 1
        postfix = ""

        try:
            from settings_app.models import PrefixConfiguration
            config = None
            if prefix_id:
                config = PrefixConfiguration.objects.filter(id=prefix_id).first()
            if not config:
                config = PrefixConfiguration.objects.filter(
                    prefix_type__type_name__iexact="Sales Return"
                ).first()
            if config:
                prefix = config.prefix or "SR"
                padding = config.number_padding or 5
                starting_number = config.starting_number or 1
                postfix = config.postfix or ""
        except Exception:
            pass

        separator = "-" if not prefix.endswith("-") else ""
        lookup_prefix = f"{prefix}{separator}"
        existing = cls.objects.filter(return_no__startswith=lookup_prefix)

        max_num = starting_number - 1
        for obj in existing:
            num_part = obj.return_no[len(lookup_prefix):]
            if postfix:
                num_part = num_part.replace(postfix, "")
            match = re.search(r'^\d+', num_part)
            if match:
                try:
                    val = int(match.group())
                    if val > max_num:
                        max_num = val
                except ValueError:
                    pass

        next_num = max_num + 1
        padded = str(next_num).zfill(padding)
        return f"{prefix}{separator}{padded}{postfix}"

    def save(self, *args, **kwargs):
        if not self.return_no:
            self.return_no = self.generate_next_return_no()
        super().save(*args, **kwargs)


class SalesReturnItem(models.Model):
    sales_return = models.ForeignKey(SalesReturn, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('inventory_app.StockItem', on_delete=models.CASCADE, null=True)
    warehouse = models.ForeignKey(
        'settings_app.Warehouse',
        on_delete=models.SET_NULL,
        null=True, blank=True,
    )

    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    rate = models.DecimalField(max_digits=12, decimal_places=2)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    gst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    gst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    cgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    sgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    igst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    amount = models.DecimalField(max_digits=15, decimal_places=2)

    per = models.ForeignKey(
        'inventory_app.Unit',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='sales_return_items',
        help_text="Unit of measurement (e.g. NOS, KGS)",
    )

    batch_number = models.CharField(max_length=100, blank=True, null=True)
    manufacture_date = models.DateField(blank=True, null=True)
    expiry_date = models.DateField(blank=True, null=True)
    hsn = models.CharField(max_length=50, blank=True, null=True)

    def save(self, *args, **kwargs):
        if self.product:
            from inventory_app.models import StockItemHSN, StockGroupHSN, StockCategoryHSN
            return_date = None
            if self.sales_return:
                return_date = self.sales_return.entry_date

            hsn_number = None

            # 1. StockItemHSN (date-bound)
            qs = StockItemHSN.objects.filter(stock_item=self.product)
            if return_date:
                qs = qs.filter(applicable_date__lte=return_date)
            rec = qs.order_by('-applicable_date').first()
            if rec:
                hsn_number = rec.hsn_number

            # 2. StockGroupHSN (date-bound)
            if not hsn_number and self.product.stock_group:
                qs = StockGroupHSN.objects.filter(stock_group=self.product.stock_group)
                if return_date:
                    qs = qs.filter(applicable_date__lte=return_date)
                rec = qs.order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number

            # 3. StockCategoryHSN (date-bound)
            if not hsn_number and self.product.stock_category:
                qs = StockCategoryHSN.objects.filter(stock_category=self.product.stock_category)
                if return_date:
                    qs = qs.filter(applicable_date__lte=return_date)
                rec = qs.order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number

            # 4. Fallback — latest StockItemHSN overall
            if not hsn_number:
                rec = StockItemHSN.objects.filter(stock_item=self.product).order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number

            # 5. Fallback — latest StockGroupHSN overall
            if not hsn_number and self.product.stock_group:
                rec = StockGroupHSN.objects.filter(stock_group=self.product.stock_group).order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number

            # 6. Fallback — latest StockCategoryHSN overall
            if not hsn_number and self.product.stock_category:
                rec = StockCategoryHSN.objects.filter(stock_category=self.product.stock_category).order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number

            if hsn_number:
                self.hsn = hsn_number

        super().save(*args, **kwargs)

    def __str__(self):
        prod_name = self.product.name if self.product else "No Product"
        return f"{prod_name} - {self.quantity}"
 

from django.db.models.signals import post_delete
from django.dispatch import receiver

###### link stocktable and sales return

@receiver(post_delete, sender=SalesReturn)
def delete_stock_table_on_sales_return_delete(sender, instance, **kwargs):
    from inventory_app.models import StockTable, StockTableDuplicate
    StockTable.objects.filter(transaction_type='SALES_RETURN', reference_id=instance.id).delete()
    StockTableDuplicate.objects.filter(transaction_type='SALES_RETURN', reference_id=instance.id).delete()


@receiver(post_delete, sender=SalesInvoice)
def delete_stock_table_on_sales_invoice_delete(sender, instance, **kwargs):
    from inventory_app.models import StockTable, StockTableDuplicate
    StockTable.objects.filter(transaction_type='SALES_INVOICE', reference_id=instance.id).delete()
    StockTableDuplicate.objects.filter(transaction_type='SALES_INVOICE', reference_id=instance.id).delete()


class SalesOrderSyncLog(models.Model):
    sales_order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name='sync_logs')
    attempted_at = models.DateTimeField(auto_now_add=True)
    tally_response = models.TextField(blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)
    
    STATUS_CHOICES = [
        ('success', 'Success'),
        ('failed', 'Failed'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='failed')
    synced_by = models.ForeignKey('register_app.CustomUser', on_delete=models.SET_NULL, null=True, blank=True, related_name='sales_order_sync_logs')
    PUSH_TYPE_CHOICES = [
        ('manual', 'Manual'),
        ('auto', 'Auto-Push'),
    ]
    push_type = models.CharField(max_length=20, choices=PUSH_TYPE_CHOICES, default='manual')
    
    def __str__(self):
        return f"{self.sales_order.so_no} - {self.status} at {self.attempted_at}"


class SalesInvoiceSyncLog(models.Model):
    sales_invoice = models.ForeignKey(SalesInvoice, on_delete=models.CASCADE, related_name='sync_logs')
    attempted_at = models.DateTimeField(auto_now_add=True)
    tally_response = models.TextField(blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)
    
    STATUS_CHOICES = [
        ('success', 'Success'),
        ('failed', 'Failed'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='failed')
    synced_by = models.ForeignKey('register_app.CustomUser', on_delete=models.SET_NULL, null=True, blank=True, related_name='sales_invoice_sync_logs')
    PUSH_TYPE_CHOICES = [
        ('manual', 'Manual'),
        ('auto', 'Auto-Push'),
    ]
    push_type = models.CharField(max_length=20, choices=PUSH_TYPE_CHOICES, default='manual')
    
    def __str__(self):
        return f"{self.sales_invoice.invoice_no} - {self.status} at {self.attempted_at}"


class SalesReturnSyncLog(models.Model):
    sales_return = models.ForeignKey(SalesReturn, on_delete=models.CASCADE, related_name='sync_logs')
    attempted_at = models.DateTimeField(auto_now_add=True)
    tally_response = models.TextField(blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)

    STATUS_CHOICES = [
        ('success', 'Success'),
        ('failed', 'Failed'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='failed')
    synced_by = models.ForeignKey('register_app.CustomUser', on_delete=models.SET_NULL, null=True, blank=True, related_name='sales_return_sync_logs')
    PUSH_TYPE_CHOICES = [
        ('manual', 'Manual'),
        ('auto', 'Auto-Push'),
    ]
    push_type = models.CharField(max_length=20, choices=PUSH_TYPE_CHOICES, default='manual')

    def __str__(self):
        return f"{self.sales_return.return_no} - {self.status} at {self.attempted_at}"


class TallySyncConfig(models.Model):
    IMPORT_COMMAND_CHOICES = [
        ('fetch_ledgers', 'fetch_ledgers'),
        ('fetch_stock', 'fetch_stock'),
    ]
    IMPORT_STATUS_CHOICES = [
        ('idle', 'idle'),
        ('pending', 'pending'),
        ('processing', 'processing'),
        ('done', 'done'),
        ('failed', 'failed'),
    ]

    voucher_type = models.CharField(max_length=50, unique=True, default='Sales Order')
    auto_push_on_save = models.BooleanField(default=False)
    tally_url = models.CharField(max_length=255, default='http://localhost:9000')
    last_sync_at = models.DateTimeField(null=True, blank=True)
    agent_last_seen = models.DateTimeField(null=True, blank=True)
    agent_company = models.CharField(max_length=255, blank=True, null=True)
    agent_key = models.CharField(max_length=64, blank=True, null=True, default='glenda-tally-secret')
    updated_at = models.DateTimeField(auto_now=True)

    # ── Import Command Queue (Ledger / Stock Item fetch via agent) ──────────
    pending_import_command = models.CharField(
        max_length=20, blank=True, null=True, choices=IMPORT_COMMAND_CHOICES
    )
    import_command_status = models.CharField(
        max_length=20, default='idle', choices=IMPORT_STATUS_CHOICES
    )
    import_command_result = models.TextField(blank=True, null=True)   # raw XML from agent
    import_command_error = models.TextField(blank=True, null=True)
    import_command_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"{self.voucher_type} (Auto-Push: {self.auto_push_on_save})"

from django.db.models.signals import post_save, post_delete
from django.db.models import Sum

@receiver(post_save, sender=SalesInvoiceItem)
@receiver(post_delete, sender=SalesInvoiceItem)
def update_sales_order_invoiced_quantity(sender, instance, **kwargs):
    if instance.sales_order_item:
        so_item = instance.sales_order_item
        # Recalculate the sum of invoiced quantity for this item
        total = SalesInvoiceItem.objects.filter(sales_order_item=so_item).aggregate(total_qty=Sum('quantity'))['total_qty'] or 0
        so_item.invoiced_quantity = total
        so_item.save(update_fields=['invoiced_quantity'])
        
        # Trigger the sales order to update its status
        if so_item.sales_order:
            so_item.sales_order.update_invoice_status()


class DistributorTopPick(models.Model):
    ledger = models.OneToOneField(
        'finance_app.Ledger',
        on_delete=models.CASCADE,
        related_name='top_picks',
        verbose_name='Customer (Ledger)'
    )
    products = models.ManyToManyField(
        'inventory_app.StockItem',
        related_name='distributor_top_picks',
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Distributor Top Pick'
        verbose_name_plural = 'Distributor Top Picks'

    def __str__(self):
        return f"Top Picks for {self.ledger.name if self.ledger else 'Unknown'}"
