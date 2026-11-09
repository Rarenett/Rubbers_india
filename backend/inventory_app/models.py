from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver

from register_app.models import CustomUser
from settings_app.models import Warehouse

# Create your models here.


class Unit(models.Model):
    name = models.CharField(max_length=100, unique=True)
    uqc_code = models.CharField(
        max_length=10,
        unique=True,
        help_text="GST Unit Quantity Code (e.g., NOS, KGS, LTR)"
    )
    decimal_places = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = "Unit"
        verbose_name_plural = "Units"
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.uqc_code})"




class StockGroup(models.Model):
    name = models.CharField(max_length=255, unique=True)
    parent_group = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='subgroups',
        verbose_name="Parent Group"
    )
    is_parent_group = models.BooleanField(
        default=False,
        verbose_name="Is Parent Group",
        help_text="If checked, this group acts as a parent group and cannot be edited or deleted.",
        null=True
    )
    company = models.ForeignKey('settings_app.Company', on_delete=models.CASCADE, null=True, blank=True)
    branch = models.ForeignKey('settings_app.Branch', on_delete=models.CASCADE, null=True, blank=True)
    factory = models.ForeignKey('settings_app.Factory', on_delete=models.CASCADE, null=True, blank=True)

    class Meta:
        verbose_name = "Stock Group"
        verbose_name_plural = "Stock Groups"
        ordering = ['name']

    def __str__(self):
        return self.name


class StockDefinition(models.Model):
    stock_group = models.ForeignKey(
        'StockGroup',
        on_delete=models.CASCADE,
        related_name='stock_definitions',
        verbose_name="Stock Group",
        null=True,
        blank=True
    )
    status = models.BooleanField(default=True, help_text="Active status of stock definition", null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True )
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        verbose_name = "Stock Definition"
        verbose_name_plural = "Stock Definitions"

    def __str__(self):
        return f"Stock Definition - {self.stock_group.name} ({'Active' if self.status else 'Disabled'})"


class StockGroupHSN(models.Model):
    stock_group = models.ForeignKey(
        'StockGroup',
        on_delete=models.CASCADE,
        related_name='hsn_codes'
    )
    hsn_number = models.CharField(max_length=20)
    applicable_date = models.DateField()

    class Meta:
        verbose_name = "Stock Group HSN"
        verbose_name_plural = "Stock Group HSNs"
        ordering = ['-applicable_date']
        unique_together = ('stock_group', 'hsn_number', 'applicable_date')

    def __str__(self):
        return f"{self.stock_group} - {self.hsn_number}"


class StockGroupGST(models.Model):
    GST_TYPE_CHOICES = [
        ('goods', 'Goods'),
        ('services', 'Services'),
        ('exempt', 'Exempt'),
        ('nil_rated', 'Nil Rated'),
        ('non_gst', 'Non GST'),
    ]

    stock_group = models.ForeignKey(
        'StockGroup',
        on_delete=models.CASCADE,
        related_name='gst_rates'
    )

    tax_gst_type = models.CharField(
        max_length=20,
        choices=GST_TYPE_CHOICES,
        default='goods'
    )

    igst_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0
    )

    cgst_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0
    )

    sgst_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0
    )

    cess_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0
    )

    applicable_date = models.DateField()

    class Meta:
        verbose_name = "Stock Group GST"
        verbose_name_plural = "Stock Group GST"
        ordering = ['-applicable_date']
        unique_together = (
            'stock_group',
            'tax_gst_type',
            'applicable_date'
        )

    def __str__(self):
        return (
            f"{self.stock_group} - "
            f"GST {self.igst_percent}% "
            f"({self.applicable_date})"
        )




class StockCategory(models.Model):
    name = models.CharField(max_length=255, unique=True)
    parent_category = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='subcategories',
        verbose_name="Parent Category"
    )

    class Meta:
        verbose_name = "Stock Category"
        verbose_name_plural = "Stock Categories"
        ordering = ['name']

    def __str__(self):
        return self.name


class StockCategoryHSN(models.Model):
    stock_category = models.ForeignKey(
        'StockCategory',
        on_delete=models.CASCADE,
        related_name='hsn_codes'
    )

    hsn_number = models.CharField(
        max_length=20,
        help_text="HSN/SAC Code"
    )

    applicable_date = models.DateField()

    class Meta:
        verbose_name = "Stock Category HSN"
        verbose_name_plural = "Stock Category HSNs"
        ordering = ['-applicable_date']
        unique_together = (
            'stock_category',
            'hsn_number',
            'applicable_date'
        )

    def __str__(self):
        return f"{self.stock_category} - {self.hsn_number}"


class StockCategoryGST(models.Model):
    GST_TYPE_CHOICES = [
        ('goods', 'Goods'),
        ('services', 'Services'),
        ('exempt', 'Exempt'),
        ('nil_rated', 'Nil Rated'),
        ('non_gst', 'Non GST'),
    ]

    stock_category = models.ForeignKey(
        'StockCategory',
        on_delete=models.CASCADE,
        related_name='gst_rates'
    )

    tax_gst_type = models.CharField(
        max_length=20,
        choices=GST_TYPE_CHOICES,
        default='goods'
    )

    igst_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.00
    )

    cgst_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.00
    )

    sgst_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.00
    )

    cess_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.00
    )

    applicable_date = models.DateField()

    class Meta:
        verbose_name = "Stock Category GST"
        verbose_name_plural = "Stock Category GST"
        ordering = ['-applicable_date']
        unique_together = (
            'stock_category',
            'tax_gst_type',
            'applicable_date'
        )

    def __str__(self):
        return (
            f"{self.stock_category} - "
            f"GST {self.igst_percent}% "
            f"({self.applicable_date})"
        )




class StockItem(models.Model):
    name = models.CharField(max_length=255, unique=True)
    item_code = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True,
        help_text="Optional unique code / SKU for this stock item"
    )

    stock_group = models.ForeignKey(
        'StockGroup',
        on_delete=models.PROTECT,
        related_name='stock_items'
    )

    stock_category = models.ForeignKey(
        'StockCategory',
        on_delete=models.PROTECT,
        related_name='stock_items',
        null=True,
        blank=True
    )

    base_unit = models.ForeignKey(
        'Unit',
        on_delete=models.PROTECT,
        related_name='base_unit_items'
    )

    alternate_unit = models.ForeignKey(
        'Unit',
        on_delete=models.PROTECT,
        related_name='alternate_unit_items',
        null=True,
        blank=True
    )

    conversion_value = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        default=1
    )

    maintain_batch = models.BooleanField(default=False)

    maintain_manufacture_date = models.BooleanField(default=False)

    maintain_expiry_date = models.BooleanField(default=False)

    has_bom = models.BooleanField(default=False, help_text="Does this item have a Bill of Materials (Recipe)?")

    opening_stock = models.DecimalField(
        max_digits=18,
        decimal_places=3,
        default=0
    )

    opening_rate = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0
    )

    opening_value = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0
    )

    mrp = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0
    )

    sb_rate = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0,
        help_text="Standard Buying Rate"
    )

    ss_rate = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0,
        help_text="Standard Selling Rate"
    )

    image = models.ImageField(
        upload_to='stock_items/',
        null=True,
        blank=True,
        help_text="Optional product image"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Stock Item"
        verbose_name_plural = "Stock Items"
        ordering = ['name']

    def __str__(self):
        return self.name

class StockItemHSN(models.Model):
    stock_item = models.ForeignKey(
        'StockItem',
        on_delete=models.CASCADE,
        related_name='hsn_codes'
    )
    hsn_number = models.CharField(max_length=20)
    applicable_date = models.DateField()

    class Meta:
        verbose_name = "Stock Item HSN"
        verbose_name_plural = "Stock Item HSNs"
        ordering = ['-applicable_date']
        unique_together = ('stock_item', 'hsn_number', 'applicable_date')

    def __str__(self):
        return f"{self.stock_item} - {self.hsn_number}"


class StockItemGST(models.Model):
    GST_TYPE_CHOICES = [
        ('goods', 'Goods'),
        ('services', 'Services'),
        ('exempt', 'Exempt'),
        ('nil_rated', 'Nil Rated'),
        ('non_gst', 'Non GST'),
    ]

    stock_item = models.ForeignKey(
        'StockItem',
        on_delete=models.CASCADE,
        related_name='item_gst_rates'
    )

    tax_gst_type = models.CharField(
        max_length=20,
        choices=GST_TYPE_CHOICES,
        default='goods'
    )

    igst_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0
    )

    cgst_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0
    )

    sgst_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0
    )

    cess_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0
    )

    applicable_date = models.DateField()

    class Meta:
        verbose_name = "Stock Item GST"
        verbose_name_plural = "Stock Items GST"
        ordering = ['-applicable_date']
        unique_together = (
            'stock_item',
            'tax_gst_type',
            'applicable_date'
        )

    def __str__(self):
        return (
            f"{self.stock_item} - "
            f"GST {self.igst_percent}% "
            f"({self.applicable_date})"
        )



class PriceList(models.Model):   
    name = models.CharField(max_length=255)
    applicable_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Price List"
        verbose_name_plural = "Price Lists"
        ordering = ['-applicable_date']

    def __str__(self):
        return f"{self.name} ({self.applicable_date})"


class PriceListItem(models.Model):
    price_list = models.ForeignKey(
        'PriceList',
        on_delete=models.CASCADE,
        related_name='items'
    )
    stock_item = models.ForeignKey(
        'StockItem',
        on_delete=models.CASCADE,
        related_name='price_list_items'
    )
    actual_price = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0
    )
    rate = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0
    )

    class Meta:
        verbose_name = "Price List Item"
        verbose_name_plural = "Price List Items"
        unique_together = ('price_list', 'stock_item')

    def __str__(self):
        return f"{self.price_list.name} - {self.stock_item.name}"




class StockTable(models.Model):

    MOVEMENT_TYPE = (
        ('IN', 'Stock In'),
        ('OUT', 'Stock Out'),
    )

    TRANSACTION_TYPE = (
        ('OPENING STOCK', 'Opening Stock'),
        ('PURCHASE_INVOICE', 'Purchase Invoice'),
        ('RECEIPT_NOTE', 'Receipt Note'),
        ('SALES_INVOICE', 'Sales Invoice'),
        ('DELIVERY_NOTE', 'Delivery Note'),
        ('SALES_RETURN', 'Sales Return'),
        ('PURCHASE_RETURN', 'Purchase Return'),
        ('STOCK_JOURNAL', 'Stock Journal'),
        ('MANUFACTURING_JOURNAL', 'Manufacturing Journal'),
        ('BLOCKED', 'Blocked'),
        ('SHIFT', 'Shift'),
        ('SALES_ORDER', 'Sales Order'),
        ('PHYSICAL_STOCK', 'Physical Stock'),
    )

    # Item Details
    item = models.ForeignKey(StockItem, on_delete=models.CASCADE, related_name='stock_item', null=True, blank=True)

    # Transaction Details
    movement_type = models.CharField(max_length=5, choices=MOVEMENT_TYPE, null=True, blank=True)
    transaction_type = models.CharField(max_length=30, choices=TRANSACTION_TYPE, null=True, blank=True)
    reference_id = models.IntegerField(null=True, blank=True)

    # Stock Details
    quantity = models.DecimalField(max_digits=15, decimal_places=3, null=True, blank=True)
    damaged_stock = models.DecimalField(max_digits=15, decimal_places=3, null=True, blank=True)
    rate = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # Batch Details
    batch_number = models.CharField(max_length=100, null=True, blank=True)
    manufacture_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)

    # Location Details
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='items_warehouse', null=True, blank=True)

    # Verification Details
    verified_by = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='verified_stocks', null=True, blank=True)

    # Date & Time
    date = models.DateField(null=True, blank=True)
    time = models.TimeField(null=True, blank=True)

    # Status
    is_active = models.BooleanField(default=False)


class StockTableDuplicate(models.Model):

    MOVEMENT_TYPE = (
        ('IN', 'Stock In'),
        ('OUT', 'Stock Out'),
    )

    TRANSACTION_TYPE = (
        ('OPENING STOCK', 'Opening Stock'),
        ('PURCHASE_INVOICE', 'Purchase Invoice'),
        ('RECEIPT_NOTE', 'Receipt Note'),
        ('SALES_INVOICE', 'Sales Invoice'),
        ('DELIVERY_NOTE', 'Delivery Note'),
        ('SALES_RETURN', 'Sales Return'),
        ('PURCHASE_RETURN', 'Purchase Return'),
        ('STOCK_JOURNAL', 'Stock Journal'),
        ('MANUFACTURING_JOURNAL', 'Manufacturing Journal'),
        ('BLOCKED', 'Blocked'),
        ('SHIFT', 'Shift'),
        ('SALES_ORDER', 'Sales Order'),
        ('PHYSICAL_STOCK', 'Physical Stock'),
    )

    # Item Details
    item = models.ForeignKey(StockItem, on_delete=models.CASCADE, related_name='items_duplicate', null=True, blank=True)

    # Transaction Details
    movement_type = models.CharField(max_length=5, choices=MOVEMENT_TYPE, null=True, blank=True)
    transaction_type = models.CharField(max_length=30, choices=TRANSACTION_TYPE, null=True, blank=True)
    reference_id = models.IntegerField(null=True, blank=True)

    # Stock Details
    quantity = models.DecimalField(max_digits=15, decimal_places=3, null=True, blank=True)
    damaged_stock = models.DecimalField(max_digits=15, decimal_places=3, null=True, blank=True)
    rate = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # Batch Details
    batch_number = models.CharField(max_length=100, null=True, blank=True)
    manufacture_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)

    # Location Details
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='warehouse_duplicate', null=True, blank=True)

    # Verification Details
    verified_by = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='verified_stocks_duplicate', null=True, blank=True)

    # Date & Time
    date = models.DateField(null=True, blank=True)
    time = models.TimeField(null=True, blank=True)

    # Status
    is_active = models.BooleanField(default=False)




class ProductConfiguration(models.Model):
    """
    Defines which product-level features are enabled for a given voucher type.
    One configuration row per voucher type (OneToOneField enforces this).
    """
    voucher_type = models.OneToOneField(
        'finance_app.VoucherType',
        on_delete=models.PROTECT,
        related_name='product_configuration',
        help_text="The voucher type this configuration applies to"
    )

    # Feature toggles — mirrors the three existing StockItem flags + warehouse
    maintain_batch = models.BooleanField(
        default=False,
        help_text="Enable batch tracking for items used in this voucher type"
    )
    maintain_manufacture_date = models.BooleanField(
        default=False,
        help_text="Enable manufacture date tracking for items used in this voucher type"
    )
    maintain_expiry_date = models.BooleanField(
        default=False,
        help_text="Enable expiry date tracking for items used in this voucher type"
    )
    maintain_warehouse = models.BooleanField(
        default=False,
        help_text="Require warehouse selection when items are used in this voucher type"
    )
    maintain_narration = models.BooleanField(
        default=False,
        help_text="Enable row-level narration tracking in this voucher type"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Product Configuration"
        verbose_name_plural = "Product Configurations"
        ordering = ['voucher_type__name']

    def __str__(self):
        return f"Product Config — {self.voucher_type.name}"


class LedgerPriceListMapping(models.Model):
    ledger = models.ForeignKey(
        'finance_app.Ledger',
        on_delete=models.CASCADE,
        related_name='price_list_mappings'
    )
    price_list = models.ForeignKey(
        'PriceList',
        on_delete=models.CASCADE,
        related_name='ledger_mappings'
    )
    applicable_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Ledger Price List Mapping"
        verbose_name_plural = "Ledger Price List Mappings"
        unique_together = ('ledger', 'applicable_date')
        ordering = ['-applicable_date', 'ledger__name']

    def __str__(self):
        return f"{self.ledger.name} - {self.price_list.name} ({self.applicable_date})"

@receiver(post_save, sender=StockItem)
def create_opening_stock_entry(sender, instance, created, **kwargs):
    """
    Automatically creates/updates StockTable and StockTableDuplicate entries 
    when a StockItem with opening stock is saved.
    """
    if instance.maintain_batch:
        # If the item maintains batches, the opening stock is handled by the serializer
        # which creates individual StockTable entries for each batch.
        # We just clean up any generic (non-batch) opening stock entries.
        StockTable.objects.filter(item=instance, transaction_type='OPENING STOCK', batch_number__in=[None, '']).delete()
        StockTableDuplicate.objects.filter(item=instance, transaction_type='OPENING STOCK', batch_number__in=[None, '']).delete()
        return

    if instance.opening_stock and instance.opening_stock > 0:
        # StockTable
        stock_table = StockTable.objects.filter(
            item=instance,
            transaction_type='OPENING STOCK',
            batch_number__in=[None, '']
        ).first()

        if stock_table:
            if stock_table.quantity != instance.opening_stock or stock_table.rate != instance.opening_rate:
                stock_table.quantity = instance.opening_stock
                stock_table.rate = instance.opening_rate
                stock_table.save()
        else:
            StockTable.objects.create(
                item=instance,
                transaction_type='OPENING STOCK',
                movement_type='IN',
                quantity=instance.opening_stock,
                rate=instance.opening_rate,
                date=instance.created_at.date() if instance.created_at else None,
                is_active=True,
                reference_id=instance.id,
            )

        # StockTableDuplicate
        stock_table_dup = StockTableDuplicate.objects.filter(
            item=instance,
            transaction_type='OPENING STOCK',
            batch_number__in=[None, '']
        ).first()

        if stock_table_dup:
            if stock_table_dup.quantity != instance.opening_stock or stock_table_dup.rate != instance.opening_rate:
                stock_table_dup.quantity = instance.opening_stock
                stock_table_dup.rate = instance.opening_rate
                stock_table_dup.save()
        else:
            StockTableDuplicate.objects.create(
                item=instance,
                transaction_type='OPENING STOCK',
                movement_type='IN',
                quantity=instance.opening_stock,
                rate=instance.opening_rate,
                date=instance.created_at.date() if instance.created_at else None,
                is_active=True,
                reference_id=instance.id,
            )
            
        # If switched from maintain_batch=True to False, delete any old batch entries
        StockTable.objects.filter(item=instance, transaction_type='OPENING STOCK').exclude(batch_number__in=[None, '']).delete()
        StockTableDuplicate.objects.filter(item=instance, transaction_type='OPENING STOCK').exclude(batch_number__in=[None, '']).delete()
    else:
        # If opening stock is 0 or removed, delete the opening stock entries
        StockTable.objects.filter(item=instance, transaction_type='OPENING STOCK').delete()
        StockTableDuplicate.objects.filter(item=instance, transaction_type='OPENING STOCK').delete()




class BillOfEntry(models.Model):
    recipe_name = models.CharField(max_length=255)
    unit_of_manufacture = models.IntegerField()
    stock_item = models.ForeignKey(StockItem, on_delete=models.PROTECT, related_name='bill_of_entries')
    applicable_date = models.DateField()
    created_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='bill_of_entries_created')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.recipe_name


class RecipeDetails(models.Model):
    recipe = models.ForeignKey(BillOfEntry, on_delete=models.CASCADE, related_name='recipe_details')
    stock_item = models.ForeignKey(StockItem, on_delete=models.PROTECT, related_name='recipe_details')
    quantity = models.DecimalField(max_digits=15, decimal_places=3, default=0)
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT, related_name='recipe_details')
    created_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='recipe_details_created')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.recipe.recipe_name} - {self.stock_item}"


class PhysicalStock(models.Model):
    voucher_no = models.CharField(max_length=20, unique=True, editable=False)
    date = models.DateField()
    created_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, related_name='physical_stocks')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.voucher_no:
            last = PhysicalStock.objects.order_by('-id').first()
            if last and last.voucher_no and last.voucher_no.startswith('PS-'):
                try:
                    last_num = int(last.voucher_no.split('-')[1])
                    self.voucher_no = f"PS-{last_num + 1:05d}"
                except ValueError:
                    self.voucher_no = "PS-00001"
            else:
                self.voucher_no = "PS-00001"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.voucher_no} - {self.date}"

    class Meta:
        verbose_name = 'Physical Stock'
        verbose_name_plural = 'Physical Stocks'
        ordering = ['-date', '-id']


class PhysicalStockItem(models.Model):
    physical_stock = models.ForeignKey(PhysicalStock, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey('StockItem', on_delete=models.PROTECT, related_name='physical_stock_items')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.SET_NULL, null=True, blank=True)
    batch_number = models.CharField(max_length=100, null=True, blank=True)
    manufacture_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    system_quantity = models.DecimalField(max_digits=15, decimal_places=3, default=0, help_text="Quantity in system at the time of entry")
    quantity = models.DecimalField(max_digits=15, decimal_places=3, help_text="Actual physical quantity")
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.item.name} ({self.quantity})"


class WarehouseTransfer(models.Model):
    wt_no = models.CharField(max_length=20, unique=True, editable=False)
    entry_date = models.DateField()
    destination_warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='incoming_transfers')
    narration = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, related_name='created_warehouse_transfers')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.wt_no:
            last = WarehouseTransfer.objects.order_by('-id').first()
            if last and last.wt_no and last.wt_no.startswith('WT-'):
                try:
                    last_num = int(last.wt_no.split('-')[1])
                    self.wt_no = f"WT-{last_num + 1:03d}"
                except ValueError:
                    self.wt_no = "WT-001"
            else:
                self.wt_no = "WT-001"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.wt_no} - {self.entry_date}"

    class Meta:
        verbose_name = 'Warehouse Transfer'
        verbose_name_plural = 'Warehouse Transfers'
        ordering = ['-entry_date', '-id']

class WarehouseTransferItem(models.Model):
    transfer = models.ForeignKey(WarehouseTransfer, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey('StockItem', on_delete=models.PROTECT, related_name='warehouse_transfers')
    
    def __str__(self):
        return f"{self.transfer.wt_no} - {self.item.name}"

class WarehouseTransferItemSplit(models.Model):
    transfer_item = models.ForeignKey(WarehouseTransferItem, on_delete=models.CASCADE, related_name='splits')
    source_warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='outgoing_transfers')
    batch_number = models.CharField(max_length=100, null=True, blank=True)
    manufacture_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    quantity = models.DecimalField(max_digits=15, decimal_places=3, help_text="Transfer quantity")
    rate = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.transfer_item.item.name} from {self.source_warehouse.name} ({self.quantity})"
