from django.db import models
from django.utils import timezone
from decimal import Decimal, ROUND_HALF_UP
# Create your models here.
class PurchaseOrder(models.Model):
    
    GST_TYPE_CHOICES = [
        ('STATE', 'STATE'),
        ('INTER_STATE', 'INTER STATE'),
    ]
    order_type = models.CharField(max_length=50, null=True, blank=True)

    po_no = models.CharField(max_length=50, unique=True)
    entry_date = models.DateField(default=timezone.now)
    supplier_ledger = models.ForeignKey('finance_app.Ledger', on_delete=models.CASCADE, related_name='po_suppliers', null=True)
    purchase_ledger = models.ForeignKey(
        'finance_app.Ledger',
        on_delete=models.CASCADE,
        related_name='po_purchases',
        null=True,
        blank=True,
        limit_choices_to={'accountGroup__name': 'Purchase Accounts'}
    )
    gst_ledger_1 = models.ForeignKey('finance_app.Ledger', on_delete=models.CASCADE, related_name='purchase_order_gst1', null=True, blank=True)
    gst_amount_1 = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    gst_ledger_2 = models.ForeignKey('finance_app.Ledger', on_delete=models.CASCADE, related_name='purchase_order_gst2', null=True, blank=True)
    gst_amount_2 = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    narration = models.TextField(null=True, blank=True)
    # is_posted = models.BooleanField(default=False)

    # Track which quotations were used to create this PO

    other_reference=models.CharField(max_length=200, null=True, blank=True)
    terms_of_delivery=models.CharField(max_length=200, null=True, blank=True)   
    dispatch_through=models.CharField(max_length=200, null=True, blank=True)   
    document_no=models.CharField(max_length=200, null=True, blank=True)   
    document_date=models.DateField(null=True, blank=True)   
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PARTIAL', 'Partially Fulfilled'),
        ('COMPLETED', 'Completed'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey('register_app.CustomUser', on_delete=models.CASCADE, null=True, related_name='purchase_orders_created')
    edited_by = models.ForeignKey('register_app.CustomUser', on_delete=models.SET_NULL, null=True, related_name='purchase_orders_edited')
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def remaining_quantity_total(self):
        return sum((item.remaining_quantity for item in self.items.all()), Decimal('0.00'))

    @property
    def calculated_status(self):
        total_ordered = sum((Decimal(str(item.quantity or '0')) for item in self.items.all()), Decimal('0.00'))
        total_remaining = self.remaining_quantity_total
        if total_ordered > 0 and total_remaining <= Decimal('0.00'):
            return 'COMPLETED'
        elif total_remaining < total_ordered:
            return 'PARTIAL'
        return 'PENDING'

    def __str__(self):
        return self.po_no

class PurchaseOrderItem(models.Model):
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='items',null=True)
    product = models.ForeignKey('inventory_app.StockItem', on_delete=models.CASCADE,null=True)
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
        related_name='purchase_order_items',
        help_text="Unit of measurement (e.g. NOS, KGS)"
    )

    hsn = models.CharField(max_length=50, blank=True, null=True)

    @property
    def invoiced_quantity(self):
        from django.db.models import Sum
        qty_direct = self.invoice_items.aggregate(total=Sum('quantity'))['total'] or Decimal('0.00')
        if qty_direct > 0:
            return qty_direct

        if self.purchase_order:
            qs = PurchaseInvoiceItem.objects.filter(
                invoice__purchase_order=self.purchase_order,
                product=self.product
            )
            if self.warehouse:
                qs = qs.filter(godown=self.warehouse)
            return qs.aggregate(total=Sum('quantity'))['total'] or Decimal('0.00')

        return Decimal('0.00')

    @property
    def remaining_quantity(self):
        rem = Decimal(str(self.quantity or '0')) - Decimal(str(self.invoiced_quantity or '0'))
        return max(Decimal('0.00'), rem)

    def save(self, *args, **kwargs):
        if self.product:
            from inventory_app.models import (
                StockItemHSN, StockGroupHSN, StockCategoryHSN,
                StockItemGST, StockGroupGST, StockCategoryGST
            )
            order_date = None
            if self.purchase_order:
                order_date = self.purchase_order.entry_date
            
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

            # ── Resolve GST% the same way: item > group > category,
            #    restricted to rates applicable on/before the PO's entry date,
            #    falling back to the latest rate overall if none qualify. ──
            gst_percent = None

            # 1. Item-level GST applicable as of order_date
            qs = StockItemGST.objects.filter(stock_item=self.product)
            if order_date:
                qs = qs.filter(applicable_date__lte=order_date)
            rec = qs.order_by('-applicable_date').first()
            if rec:
                gst_percent = rec.igst_percent

            # 2. Group-level GST applicable as of order_date
            if gst_percent is None and self.product.stock_group:
                qs = StockGroupGST.objects.filter(stock_group=self.product.stock_group)
                if order_date:
                    qs = qs.filter(applicable_date__lte=order_date)
                rec = qs.order_by('-applicable_date').first()
                if rec:
                    gst_percent = rec.igst_percent

            # 3. Category-level GST applicable as of order_date
            if gst_percent is None and self.product.stock_category:
                qs = StockCategoryGST.objects.filter(stock_category=self.product.stock_category)
                if order_date:
                    qs = qs.filter(applicable_date__lte=order_date)
                rec = qs.order_by('-applicable_date').first()
                if rec:
                    gst_percent = rec.igst_percent

            # 4. Fallback to latest item-level GST overall
            if gst_percent is None:
                rec = StockItemGST.objects.filter(stock_item=self.product).order_by('-applicable_date').first()
                if rec:
                    gst_percent = rec.igst_percent

            # 5. Fallback to latest group-level GST overall
            if gst_percent is None and self.product.stock_group:
                rec = StockGroupGST.objects.filter(stock_group=self.product.stock_group).order_by('-applicable_date').first()
                if rec:
                    gst_percent = rec.igst_percent

            # 6. Fallback to latest category-level GST overall
            if gst_percent is None and self.product.stock_category:
                rec = StockCategoryGST.objects.filter(stock_category=self.product.stock_category).order_by('-applicable_date').first()
                if rec:
                    gst_percent = rec.igst_percent

            self.gst_percent = gst_percent if gst_percent is not None else 0

            # ── Recompute the dependent GST amounts from the resolved rate.
            #    `amount` is the base amount (qty*rate - discount) and is not
            #    rate-dependent, so it's left as supplied. Everything derived
            #    from gst_percent is recalculated here so it can never drift
            #    from whatever a client sent. ──
            from decimal import Decimal, ROUND_HALF_UP
            net_amount = self.amount or Decimal('0.00')
            total_gst = (net_amount * self.gst_percent) / Decimal('100')
            total_gst = total_gst.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

            order_type_val = self.purchase_order.order_type if self.purchase_order else 'STATE'
            is_inter_state = False
            if order_type_val == 'INTER_STATE':
                is_inter_state = True
            elif order_type_val and str(order_type_val).isdigit():
                try:
                    from settings_app.models import PrefixConfiguration
                    prefix_config = PrefixConfiguration.objects.get(id=int(order_type_val))
                    sub_name = ''
                    if prefix_config.sub_type:
                        sub_name = prefix_config.sub_type.lower()
                    elif prefix_config.subvoucher_type and prefix_config.subvoucher_type.name:
                        sub_name = prefix_config.subvoucher_type.name.lower()
                    if 'inter' in sub_name:
                        is_inter_state = True
                except Exception:
                    pass

            if is_inter_state:
                self.igst_amount = total_gst
                self.cgst_amount = Decimal('0.00')
                self.sgst_amount = Decimal('0.00')
            else:
                half = (total_gst / Decimal('2')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                self.cgst_amount = half
                self.sgst_amount = total_gst - half
                self.igst_amount = Decimal('0.00')

            self.gst_amount = total_gst
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product.name} - {self.quantity}"
    
class PurchaseOrderTransaction(models.Model):
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='po_transactions', help_text="The Purchase Order being consumed",null=True)
    product = models.ForeignKey('inventory_app.StockItem', on_delete=models.CASCADE,null=True)
    transactiondate = models.DateField(default=timezone.now)
    quantity_received = models.DecimalField(max_digits=12, decimal_places=3, default=0.000, help_text="Quantity consumed by this RN")
    quantity_remaining = models.DecimalField(max_digits=12, decimal_places=3, default=0.000, help_text="Quantity left in the PO after this RN")
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['purchase_order', 'product'])]

    def __str__(self):
        return f"{self.purchase_order.po_no} - {self.product.name}: {self.quantity_received} received"




class PurchaseInvoice(models.Model):

    GST_TYPE_CHOICES = [
        ('STATE', 'STATE'),
        ('INTER_STATE', 'INTER STATE'),
    ]

    voucher_type = models.CharField(
        max_length=50,
        null=True, blank=True
    )

    invoice_no = models.CharField(max_length=50, unique=True)
    entry_date = models.DateField(default=timezone.now)

    purchase_ledger = models.ForeignKey(
        'finance_app.Ledger',
        on_delete=models.CASCADE,
        related_name='invoice_purchases',
        null=True,
        limit_choices_to={'accountGroup__name': 'Purchase Accounts'}
    )

    gst_type = models.CharField(max_length=20, choices=GST_TYPE_CHOICES, default='STATE')

    supplier_ledger = models.ForeignKey(
        'finance_app.Ledger',
        on_delete=models.CASCADE,
        related_name='invoice_suppliers',
        null=True
    )

    supplier_invoice_no = models.CharField(max_length=50, null=True, blank=True)
    supplier_invoice_date = models.DateField(null=True, blank=True)

    gst_ledger_1 = models.ForeignKey(
        'finance_app.Ledger',
        on_delete=models.CASCADE,
        related_name='purchase_invoice_gst1',
        null=True, blank=True
    )
    gst_amount_1 = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    gst_ledger_2 = models.ForeignKey(
        'finance_app.Ledger',
        on_delete=models.CASCADE,
        related_name='purchase_invoice_gst2',
        null=True, blank=True
    )
    gst_amount_2 = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    narration = models.TextField(null=True, blank=True)
    # is_posted = models.BooleanField(default=False)

    purchase_order = models.ForeignKey(
        'PurchaseOrder',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='purchase_invoices'
    )

    # # ── extra header fields, kept consistent with Purchase Order ──
    # other_reference = models.CharField(max_length=200, null=True, blank=True)
    # terms_of_delivery = models.CharField(max_length=200, null=True, blank=True)
    # dispatch_through = models.CharField(max_length=200, null=True, blank=True)
    # document_no = models.CharField(max_length=200, null=True, blank=True)
    # document_date = models.DateField(null=True, blank=True)

    # Track which Receipt Notes were used to create this Purchase Invoice
    # receipt_notes = models.ManyToManyField(
    #     'finance_app.ReceiptNote',
    #     blank=True,
    #     related_name='purchase_invoices',
    #     verbose_name='Source Receipt Notes'
    # )

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'register_app.CustomUser',
        on_delete=models.CASCADE,
        null=True,
        related_name='purchase_invoices_created'
    )
    edited_by = models.ForeignKey(
        'register_app.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        related_name='purchase_invoices_edited'
    )
    updated_at = models.DateTimeField(auto_now=True)

    is_synced = models.BooleanField(default=False)
    sync_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('processing', 'Processing'),
            ('synced', 'Synced'),
            ('failed', 'Failed'),
        ],
        default='pending'
    )

    def save(self, *args, **kwargs):
        update_fields = kwargs.get('update_fields')
        if self.pk and (update_fields is None or 'sync_status' not in update_fields):
            if self.sync_status in ['synced', 'failed']:
                self.sync_status = 'pending'
                self.is_synced = False
        super().save(*args, **kwargs)

    def __str__(self):
        return self.invoice_no


class PurchaseInvoiceItem(models.Model):
    invoice = models.ForeignKey(PurchaseInvoice, on_delete=models.CASCADE, related_name='items')

    purchase_order = models.ForeignKey(
        'PurchaseOrder',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='invoice_items'
    )
    po_item = models.ForeignKey(
        'PurchaseOrderItem',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='invoice_items'
    )

    # receipt_note = models.ForeignKey(
    #     'finance_accounts.ReceiptNote',
    #     on_delete=models.SET_NULL,
    #     null=True, blank=True,
    #     related_name='pi_items'
    # )

    product = models.ForeignKey('inventory_app.StockItem', on_delete=models.CASCADE, null=True)

    godown = models.ForeignKey(
        'settings_app.Warehouse',
        on_delete=models.CASCADE,
        null=True, blank=True
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
    amount = models.DecimalField(max_digits=15, decimal_places=2)  # Base amount

    # ── added to match Purchase Order item behaviour ──
    batch_number = models.CharField(max_length=100, blank=True, null=True)
    manufacture_date = models.DateField(blank=True, null=True)
    expiry_date = models.DateField(blank=True, null=True)

    per = models.ForeignKey(
        'inventory_app.Unit',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='purchase_invoice_items',
        help_text="Unit of measurement (e.g. NOS, KGS)"
    )

    hsn = models.CharField(max_length=50, blank=True, null=True)

    def save(self, *args, **kwargs):
        if self.product:
            from inventory_app.models import (
                StockItemHSN, StockGroupHSN, StockCategoryHSN,
                StockItemGST, StockGroupGST, StockCategoryGST
            )
            invoice_date = None
            if self.invoice:
                invoice_date = self.invoice.entry_date

            hsn_number = None

            # 1. Item-level HSN applicable as of invoice_date
            qs = StockItemHSN.objects.filter(stock_item=self.product)
            if invoice_date:
                qs = qs.filter(applicable_date__lte=invoice_date)
            rec = qs.order_by('-applicable_date').first()
            if rec:
                hsn_number = rec.hsn_number

            # 2. Group-level HSN applicable as of invoice_date
            if not hsn_number and self.product.stock_group:
                qs = StockGroupHSN.objects.filter(stock_group=self.product.stock_group)
                if invoice_date:
                    qs = qs.filter(applicable_date__lte=invoice_date)
                rec = qs.order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number

            # 3. Category-level HSN applicable as of invoice_date
            if not hsn_number and self.product.stock_category:
                qs = StockCategoryHSN.objects.filter(stock_category=self.product.stock_category)
                if invoice_date:
                    qs = qs.filter(applicable_date__lte=invoice_date)
                rec = qs.order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number

            # 4. Fallback to latest item-level HSN overall
            if not hsn_number:
                rec = StockItemHSN.objects.filter(stock_item=self.product).order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number

            # 5. Fallback to latest group-level HSN overall
            if not hsn_number and self.product.stock_group:
                rec = StockGroupHSN.objects.filter(stock_group=self.product.stock_group).order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number

            # 6. Fallback to latest category-level HSN overall
            if not hsn_number and self.product.stock_category:
                rec = StockCategoryHSN.objects.filter(stock_category=self.product.stock_category).order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number

            if hsn_number:
                self.hsn = hsn_number

            # ── Resolve GST%: item > group > category, restricted to rates
            #    applicable on/before the invoice's entry date, falling back
            #    to the latest rate overall if none qualify. ──
            gst_percent = None

            qs = StockItemGST.objects.filter(stock_item=self.product)
            if invoice_date:
                qs = qs.filter(applicable_date__lte=invoice_date)
            rec = qs.order_by('-applicable_date').first()
            if rec:
                gst_percent = rec.igst_percent

            if gst_percent is None and self.product.stock_group:
                qs = StockGroupGST.objects.filter(stock_group=self.product.stock_group)
                if invoice_date:
                    qs = qs.filter(applicable_date__lte=invoice_date)
                rec = qs.order_by('-applicable_date').first()
                if rec:
                    gst_percent = rec.igst_percent

            if gst_percent is None and self.product.stock_category:
                qs = StockCategoryGST.objects.filter(stock_category=self.product.stock_category)
                if invoice_date:
                    qs = qs.filter(applicable_date__lte=invoice_date)
                rec = qs.order_by('-applicable_date').first()
                if rec:
                    gst_percent = rec.igst_percent

            if gst_percent is None:
                rec = StockItemGST.objects.filter(stock_item=self.product).order_by('-applicable_date').first()
                if rec:
                    gst_percent = rec.igst_percent

            if gst_percent is None and self.product.stock_group:
                rec = StockGroupGST.objects.filter(stock_group=self.product.stock_group).order_by('-applicable_date').first()
                if rec:
                    gst_percent = rec.igst_percent

            if gst_percent is None and self.product.stock_category:
                rec = StockCategoryGST.objects.filter(stock_category=self.product.stock_category).order_by('-applicable_date').first()
                if rec:
                    gst_percent = rec.igst_percent

            self.gst_percent = gst_percent if gst_percent is not None else 0

            # ── Recompute dependent GST amounts from the resolved rate.
            #    `amount` (qty*rate - discount) is left as supplied;
            #    everything derived from gst_percent is recalculated here
            #    so it can never drift from whatever a client sent. ──
            net_amount = self.amount or Decimal('0.00')
            total_gst = (net_amount * self.gst_percent) / Decimal('100')
            total_gst = total_gst.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

            gst_type = self.invoice.gst_type if self.invoice else 'STATE'
            if gst_type == 'INTER_STATE':
                self.igst_amount = total_gst
                self.cgst_amount = Decimal('0.00')
                self.sgst_amount = Decimal('0.00')
            else:
                half = (total_gst / Decimal('2')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                self.cgst_amount = half
                self.sgst_amount = total_gst - half
                self.igst_amount = Decimal('0.00')

            self.gst_amount = total_gst
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product.name if self.product else 'Item'} - {self.quantity}"


class PurchaseInvoiceExtraCharge(models.Model):
    """Extra charges (freight, loading, etc.) attached to a Purchase Invoice."""
    invoice = models.ForeignKey(
        PurchaseInvoice,
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

###### link stocktable and purchase invoice

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

@receiver(post_delete, sender=PurchaseInvoice)
def delete_stock_table_on_invoice_delete(sender, instance, **kwargs):
    from inventory_app.models import StockTable, StockTableDuplicate
    StockTable.objects.filter(transaction_type='PURCHASE_INVOICE', reference_id=instance.id).delete()
    StockTableDuplicate.objects.filter(transaction_type='PURCHASE_INVOICE', reference_id=instance.id).delete()
######

class PurchaseReturn(models.Model):

    GST_TYPE_CHOICES = [
        ('STATE', 'STATE'),
        ('INTER_STATE', 'INTER STATE'),
    ]

    VOUCHER_TYPE_CHOICES = [
        ('B2B Purchase', 'B2B Purchase'),
        ('B2C Purchase', 'B2C Purchase'),
        ('IGST Purchase', 'IGST Purchase'),
    ]
    voucher_type = models.CharField(
        max_length=50,
        choices=VOUCHER_TYPE_CHOICES,
        default='VOUCHER_TYPE_CHOICES'
    )

    return_no = models.CharField(max_length=50, unique=True)

    entry_date = models.DateField(default=timezone.now)

    gst_type = models.CharField(
        max_length=20,
        choices=GST_TYPE_CHOICES,
        default='STATE'
    )

    supplier_ledger = models.ForeignKey(
        'finance_app.Ledger',
        on_delete=models.CASCADE,
        related_name='purchase_return_suppliers'
    )

    purchase_ledger = models.ForeignKey(
        'finance_app.Ledger',
        on_delete=models.CASCADE,
        related_name='purchase_return_purchase_ledgers'
    )

    supplier_invoice_no = models.CharField(
        max_length=100,
        blank=True,
        null=True
    )

    supplier_invoice_date = models.DateField(
        blank=True,
        null=True
    )

    gst_ledger_1 = models.ForeignKey(
        'finance_app.Ledger',
        on_delete=models.CASCADE,
        related_name='purchase_return_gst1',
        blank=True,
        null=True
    )

    gst_amount_1 = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00
    )

    gst_ledger_2 = models.ForeignKey(
        'finance_app.Ledger',
        on_delete=models.CASCADE,
        related_name='purchase_return_gst2',
        blank=True,
        null=True
    )

    gst_amount_2 = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00
    )

    total_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0.00
    )

    narration = models.TextField(
        blank=True,
        null=True
    )

    sync_status = models.CharField(
        max_length=20,
        default='pending'
    )

    is_synced = models.BooleanField(default=False)

    # is_posted = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    created_by = models.ForeignKey(
        'register_app.CustomUser',
        on_delete=models.CASCADE,
        null=True,
        related_name='purchase_returns_created'
    )

    edited_by = models.ForeignKey(
        'register_app.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        related_name='purchase_returns_edited'
    )

    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        update_fields = kwargs.get('update_fields')
        if self.pk and (update_fields is None or 'sync_status' not in update_fields):
            if self.sync_status in ['synced', 'failed']:
                self.sync_status = 'pending'
                self.is_synced = False
        super().save(*args, **kwargs)

    def __str__(self):
        return self.return_no


class PurchaseReturnItem(models.Model):
    purchase_return = models.ForeignKey(PurchaseReturn, on_delete=models.CASCADE, related_name='items')

    product = models.ForeignKey('inventory_app.StockItem', on_delete=models.CASCADE, null=True)

    godown = models.ForeignKey(
        'settings_app.Warehouse',
        on_delete=models.CASCADE,
        null=True, blank=True
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
    amount = models.DecimalField(max_digits=15, decimal_places=2)  # Base amount

    # ── added to match Purchase Order item behaviour ──
    batch_number = models.CharField(max_length=100, blank=True, null=True)
    manufacture_date = models.DateField(blank=True, null=True)
    expiry_date = models.DateField(blank=True, null=True)

    per = models.ForeignKey(
        'inventory_app.Unit',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='purchase_return_items',
        help_text="Unit of measurement (e.g. NOS, KGS)"
    )

    hsn = models.CharField(max_length=50, blank=True, null=True)

    def save(self, *args, **kwargs):
        if self.product:
            from inventory_app.models import (
                StockItemHSN, StockGroupHSN, StockCategoryHSN,
                StockItemGST, StockGroupGST, StockCategoryGST
            )
            invoice_date = None
            if self.purchase_return:
                invoice_date = self.purchase_return.entry_date

            hsn_number = None

            # 1. Item-level HSN applicable as of invoice_date
            qs = StockItemHSN.objects.filter(stock_item=self.product)
            if invoice_date:
                qs = qs.filter(applicable_date__lte=invoice_date)
            rec = qs.order_by('-applicable_date').first()
            if rec:
                hsn_number = rec.hsn_number

            # 2. Group-level HSN applicable as of invoice_date
            if not hsn_number and self.product.stock_group:
                qs = StockGroupHSN.objects.filter(stock_group=self.product.stock_group)
                if invoice_date:
                    qs = qs.filter(applicable_date__lte=invoice_date)
                rec = qs.order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number

            # 3. Category-level HSN applicable as of invoice_date
            if not hsn_number and self.product.stock_category:
                qs = StockCategoryHSN.objects.filter(stock_category=self.product.stock_category)
                if invoice_date:
                    qs = qs.filter(applicable_date__lte=invoice_date)
                rec = qs.order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number

            # 4. Fallback to latest item-level HSN overall
            if not hsn_number:
                rec = StockItemHSN.objects.filter(stock_item=self.product).order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number

            # 5. Fallback to latest group-level HSN overall
            if not hsn_number and self.product.stock_group:
                rec = StockGroupHSN.objects.filter(stock_group=self.product.stock_group).order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number

            # 6. Fallback to latest category-level HSN overall
            if not hsn_number and self.product.stock_category:
                rec = StockCategoryHSN.objects.filter(stock_category=self.product.stock_category).order_by('-applicable_date').first()
                if rec:
                    hsn_number = rec.hsn_number

            if hsn_number:
                self.hsn = hsn_number

            # ── Resolve GST%: item > group > category, restricted to rates
            #    applicable on/before the invoice's entry date, falling back
            #    to the latest rate overall if none qualify. ──
            gst_percent = None

            qs = StockItemGST.objects.filter(stock_item=self.product)
            if invoice_date:
                qs = qs.filter(applicable_date__lte=invoice_date)
            rec = qs.order_by('-applicable_date').first()
            if rec:
                gst_percent = rec.igst_percent

            if gst_percent is None and self.product.stock_group:
                qs = StockGroupGST.objects.filter(stock_group=self.product.stock_group)
                if invoice_date:
                    qs = qs.filter(applicable_date__lte=invoice_date)
                rec = qs.order_by('-applicable_date').first()
                if rec:
                    gst_percent = rec.igst_percent

            if gst_percent is None and self.product.stock_category:
                qs = StockCategoryGST.objects.filter(stock_category=self.product.stock_category)
                if invoice_date:
                    qs = qs.filter(applicable_date__lte=invoice_date)
                rec = qs.order_by('-applicable_date').first()
                if rec:
                    gst_percent = rec.igst_percent

            if gst_percent is None:
                rec = StockItemGST.objects.filter(stock_item=self.product).order_by('-applicable_date').first()
                if rec:
                    gst_percent = rec.igst_percent

            if gst_percent is None and self.product.stock_group:
                rec = StockGroupGST.objects.filter(stock_group=self.product.stock_group).order_by('-applicable_date').first()
                if rec:
                    gst_percent = rec.igst_percent

            if gst_percent is None and self.product.stock_category:
                rec = StockCategoryGST.objects.filter(stock_category=self.product.stock_category).order_by('-applicable_date').first()
                if rec:
                    gst_percent = rec.igst_percent

            self.gst_percent = gst_percent if gst_percent is not None else 0

            # ── Recompute dependent GST amounts from the resolved rate.
            #    `amount` (qty*rate - discount) is left as supplied;
            #    everything derived from gst_percent is recalculated here
            #    so it can never drift from whatever a client sent. ──
            net_amount = self.amount or Decimal('0.00')
            total_gst = (net_amount * self.gst_percent) / Decimal('100')
            total_gst = total_gst.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

            gst_type = self.purchase_return.gst_type if self.purchase_return else 'STATE'
            if gst_type == 'INTER_STATE':
                self.igst_amount = total_gst
                self.cgst_amount = Decimal('0.00')
                self.sgst_amount = Decimal('0.00')
            else:
                half = (total_gst / Decimal('2')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                self.cgst_amount = half
                self.sgst_amount = total_gst - half
                self.igst_amount = Decimal('0.00')

            self.gst_amount = total_gst
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product.name if self.product else 'Item'} - {self.quantity}"

class PurchaseReturnExtraCharge(models.Model):

    purchase_return = models.ForeignKey(
        PurchaseReturn,
        on_delete=models.CASCADE,
        related_name='extra_charges'
    )

    ledger = models.ForeignKey(
        'finance_app.Ledger',
        on_delete=models.CASCADE
    )

    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0.00
    )

    def __str__(self):
        return f"{self.purchase_return.return_no} - {self.ledger.name}"


###### link stocktable and purchase return

@receiver(post_delete, sender=PurchaseReturn)
def delete_stock_table_on_return_delete(sender, instance, **kwargs):
    from inventory_app.models import StockTable, StockTableDuplicate
    StockTable.objects.filter(transaction_type='PURCHASE_RETURN', reference_id=instance.id).delete()
    StockTableDuplicate.objects.filter(transaction_type='PURCHASE_RETURN', reference_id=instance.id).delete()



@receiver(post_save, sender=PurchaseReturnItem)
def reset_tally_sync_status_on_return_item_save(sender, instance, created, **kwargs):
    try:
        pr = instance.purchase_return
        if pr and (pr.sync_status in ['synced', 'failed'] or pr.is_synced):
            pr.is_synced = False
            pr.sync_status = 'pending'
            pr.save(update_fields=['is_synced', 'sync_status'])
    except Exception:
        pass

@receiver(post_save, sender=PurchaseReturnExtraCharge)
def reset_tally_sync_status_on_return_charge_save(sender, instance, created, **kwargs):
    try:
        pr = instance.purchase_return
        if pr and (pr.sync_status in ['synced', 'failed'] or pr.is_synced):
            pr.is_synced = False
            pr.sync_status = 'pending'
            pr.save(update_fields=['is_synced', 'sync_status'])
    except Exception:
        pass




class PurchaseInvoiceSyncLog(models.Model):
    STATUS_CHOICES = [
        ('success', 'Success'),
        ('failed', 'Failed'),
    ]

    invoice = models.ForeignKey(
        PurchaseInvoice,
        on_delete=models.CASCADE,
        related_name='sync_logs'
    )
    attempted_at = models.DateTimeField(auto_now_add=True)
    tally_response = models.TextField(blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)

    def __str__(self):
        return f"Sync Log {self.id} for {self.invoice.invoice_no}"


class PurchaseReturnSyncLog(models.Model):
    STATUS_CHOICES = [
        ('success', 'Success'),
        ('failed', 'Failed'),
    ]

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='failed')
    
    purchase_return = models.ForeignKey(
        PurchaseReturn,
        on_delete=models.CASCADE,
        related_name='sync_logs'
    )
    attempted_at = models.DateTimeField(auto_now_add=True)
    tally_response = models.TextField(blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)
    
    def __str__(self):
        return f"Sync Log {self.id} for {self.purchase_return.return_no}"




class PurchaseTallySyncConfig(models.Model):
    
    voucher_type = models.CharField(max_length=50, unique=True, default='Purchase Invoice')
    auto_push_on_save = models.BooleanField(default=False)
    tally_url = models.CharField(max_length=255, default='http://localhost:9000')
    last_sync_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.voucher_type} (Auto-Push: {self.auto_push_on_save})"