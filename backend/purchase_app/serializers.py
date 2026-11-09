from rest_framework import serializers
from .models import (
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseOrderTransaction,
    PurchaseInvoice,
    PurchaseInvoiceItem,
    PurchaseInvoiceExtraCharge,
    PurchaseReturn,
    PurchaseReturnItem,
    PurchaseReturnExtraCharge
)


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(
        source='product.name',
        read_only=True
    )

    warehouse_name = serializers.CharField(
        source='warehouse.name',
        read_only=True
    )

    per_name = serializers.CharField(
        source='per.name',
        read_only=True
    )

    invoiced_quantity = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )

    remaining_quantity = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = PurchaseOrderItem
        fields = '__all__'
        read_only_fields = [
            'purchase_order', 'hsn',
            'gst_percent', 'gst_amount', 'cgst_amount', 'sgst_amount', 'igst_amount',
            'invoiced_quantity', 'remaining_quantity'
        ]


class PurchaseOrderSerializer(serializers.ModelSerializer):

    items = PurchaseOrderItemSerializer(
        many=True
    )

    supplier_name = serializers.CharField(
        source='supplier_ledger.name',
        read_only=True
    )

    purchase_ledger_name = serializers.CharField(
        source='purchase_ledger.name',
        read_only=True
    )

    order_type_name = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = '__all__'

    def get_order_type_name(self, obj):
        val = obj.order_type
        if val and str(val).isdigit():
            try:
                from settings_app.models import PrefixConfiguration
                prefix_config = PrefixConfiguration.objects.get(id=int(val))
                if getattr(prefix_config, 'sub_type', None):
                    return prefix_config.sub_type
                elif getattr(prefix_config, 'subvoucher_type', None) and getattr(prefix_config.subvoucher_type, 'type_name', None):
                    return prefix_config.subvoucher_type.type_name
            except Exception:
                pass
        return val

    def validate(self, attrs):
        is_update = self.instance is not None
        is_partial = self.partial
        errors = {}

        # 1. Supplier Ledger
        if 'supplier_ledger' in attrs:
            if attrs['supplier_ledger'] is None:
                errors['supplier_ledger'] = "Supplier is required."
        elif not is_update:
            errors['supplier_ledger'] = "Supplier is required."

        # 2. Items
        if 'items' in attrs:
            items = attrs['items']
            if not items:
                errors['items'] = "At least one item is required."
            else:
                for idx, item in enumerate(items):
                    qty = item.get('quantity')
                    rate = item.get('rate')
                    if qty is None or float(qty) <= 0:
                        errors[f'item_{idx}_quantity'] = "Item quantity must be greater than zero."
                    if rate is None or float(rate) <= 0:
                        errors[f'item_{idx}_rate'] = "Item rate must be greater than zero."
        elif not is_partial:
            errors['items'] = "At least one item is required."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])

        purchase_order = PurchaseOrder.objects.create(
            **validated_data
        )

        for item_data in items_data:
            PurchaseOrderItem.objects.create(
                purchase_order=purchase_order,
                **item_data
            )

        return purchase_order

    def update(self, instance, validated_data):

        items_data = validated_data.pop('items', [])

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        instance.items.all().delete()

        for item_data in items_data:
            PurchaseOrderItem.objects.create(
                purchase_order=instance,
                **item_data
            )

        return instance


class PurchaseOrderListSerializer(serializers.ModelSerializer):

    supplier_name = serializers.CharField(
        source='supplier_ledger.name',
        read_only=True
    )

    class Meta:
        model = PurchaseOrder
        fields = [
            'id',
            'po_no',
            'entry_date',
            'supplier_name',
            'total_amount',
            # 'is_posted'
        ]

class MobilePurchaseOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseOrderItem
        fields = '__all__'
        read_only_fields = [
            'purchase_order', 'hsn',
            'gst_percent', 'gst_amount', 'cgst_amount', 'sgst_amount', 'igst_amount'
        ]

class MobilePurchaseOrderSerializer(serializers.ModelSerializer):
    items = MobilePurchaseOrderItemSerializer(many=True)

    class Meta:
        model = PurchaseOrder
        fields = '__all__'
        extra_kwargs = {
            'supplier_ledger': {'required': False, 'allow_null': True}
        }

    def validate(self, attrs):
        is_partial = self.partial
        errors = {}

        # 2. Items
        if 'items' in attrs:
            items = attrs['items']
            if not items:
                errors['items'] = "At least one item is required."
            else:
                for idx, item in enumerate(items):
                    qty = item.get('quantity')
                    rate = item.get('rate')
                    if qty is None or float(qty) <= 0:
                        errors[f'item_{idx}_quantity'] = "Item quantity must be greater than zero."
                    if rate is None or float(rate) < 0: # rate can be zero for mobile
                        errors[f'item_{idx}_rate'] = "Item rate must be zero or greater."
        elif not is_partial:
            errors['items'] = "At least one item is required."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        purchase_order = PurchaseOrder.objects.create(**validated_data)
        for item_data in items_data:
            PurchaseOrderItem.objects.create(
                purchase_order=purchase_order,
                **item_data
            )
        return purchase_order


class PurchaseInvoiceExtraChargeSerializer(serializers.ModelSerializer):
    ledger_name = serializers.CharField(source='ledger.name', read_only=True)

    class Meta:
        model = PurchaseInvoiceExtraCharge
        fields = '__all__'
        read_only_fields = ['invoice']


class PurchaseInvoiceItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(
        source='product.name',
        read_only=True
    )

    godown_name = serializers.CharField(
        source='godown.name',
        read_only=True
    )

    per_name = serializers.CharField(
        source='per.name',
        read_only=True
    )

    class Meta:
        model = PurchaseInvoiceItem
        fields = '__all__'
        read_only_fields = [
            'invoice', 'hsn',
            'gst_percent', 'gst_amount', 'cgst_amount', 'sgst_amount', 'igst_amount'
        ]

#####
def sync_purchase_invoice_stock_entries(purchase_invoice):
    from inventory_app.models import StockTable, StockTableDuplicate
    
    # 1. Clear existing entries for this purchase invoice
    StockTable.objects.filter(transaction_type='PURCHASE_INVOICE', reference_id=purchase_invoice.id).delete()
    StockTableDuplicate.objects.filter(transaction_type='PURCHASE_INVOICE', reference_id=purchase_invoice.id).delete()
    
    # 2. Create new entries for each PurchaseInvoiceItem
    for item in purchase_invoice.items.all():
        if item.product:
            common_data = {
                'item': item.product,
                'movement_type': 'IN',
                'transaction_type': 'PURCHASE_INVOICE',
                'reference_id': purchase_invoice.id,
                'quantity': item.quantity,
                'rate': item.rate,
                'batch_number': item.batch_number,
                'manufacture_date': item.manufacture_date,
                'expiry_date': item.expiry_date,
                'warehouse': item.godown,
                'date': purchase_invoice.entry_date,
                'verified_by': purchase_invoice.created_by,
                'is_active': True,
            }
            StockTable.objects.create(**common_data)
def sync_po_status_for_invoice(purchase_invoice):
    from purchase_app.models import PurchaseOrder
    po_ids = set()
    if purchase_invoice.purchase_order:
        po_ids.add(purchase_invoice.purchase_order.id)

    for item in purchase_invoice.items.all():
        if item.purchase_order:
            po_ids.add(item.purchase_order.id)
        if item.po_item and item.po_item.purchase_order:
            po_ids.add(item.po_item.purchase_order.id)

    for po_id in po_ids:
        try:
            po = PurchaseOrder.objects.get(id=po_id)
            new_status = po.calculated_status
            if po.status != new_status:
                po.status = new_status
                po.save(update_fields=['status'])
        except Exception as e:
            print(f"Error syncing PO status for ID {po_id}: {e}")


class PurchaseInvoiceSerializer(serializers.ModelSerializer):
    items = PurchaseInvoiceItemSerializer(
        many=True
    )

    extra_charges = PurchaseInvoiceExtraChargeSerializer(
        many=True,
        required=False
    )

    supplier_name = serializers.CharField(
        source='supplier_ledger.name',
        read_only=True
    )

    purchase_ledger_name = serializers.CharField(
        source='purchase_ledger.name',
        read_only=True
    )
    outstanding_amount = serializers.SerializerMethodField()
    
    voucher_type = serializers.CharField(
        max_length=50,
        allow_blank=True,
        required=False
    )

    class Meta:
        model = PurchaseInvoice
        fields = '__all__'

    def get_outstanding_amount(self, obj):
        from django.db.models import Sum
        total_allocated = obj.bill_allocations.aggregate(total=Sum('amount'))['total'] or 0
        return float(obj.total_amount) - float(total_allocated)

    def validate(self, attrs):
        is_update = self.instance is not None
        is_partial = self.partial
        errors = {}

        # 1. Supplier Ledger
        if 'supplier_ledger' in attrs:
            if attrs['supplier_ledger'] is None:
                errors['supplier_ledger'] = "Supplier is required."
        elif not is_update:
            errors['supplier_ledger'] = "Supplier is required."

        # 2. Purchase Ledger
        if 'purchase_ledger' in attrs:
            if attrs['purchase_ledger'] is None:
                errors['purchase_ledger'] = "Purchase Ledger is required."
        elif not is_update:
            errors['purchase_ledger'] = "Purchase Ledger is required."

        # 3. Items
        if 'items' in attrs:
            items = attrs['items']
            if not items:
                errors['items'] = "At least one item is required."
            else:
                for idx, item in enumerate(items):
                    qty = item.get('quantity')
                    rate = item.get('rate')
                    if qty is None or float(qty) <= 0:
                        errors[f'item_{idx}_quantity'] = "Item quantity must be greater than zero."
                    if rate is None or float(rate) <= 0:
                        errors[f'item_{idx}_rate'] = "Item rate must be greater than zero."
        elif not is_partial:
            errors['items'] = "At least one item is required."

        # 4. Supplier Invoice No
        if 'supplier_invoice_no' in attrs:
            val = attrs['supplier_invoice_no']
            if val is None or (isinstance(val, str) and not val.strip()):
                errors['supplier_invoice_no'] = "Supplier Invoice Number is required."
        elif not is_update:
            errors['supplier_invoice_no'] = "Supplier Invoice Number is required."

        # 5. Supplier Invoice Date
        if 'supplier_invoice_date' in attrs:
            if attrs['supplier_invoice_date'] is None:
                errors['supplier_invoice_date'] = "Supplier Invoice Date is required."
        elif not is_update:
            errors['supplier_invoice_date'] = "Supplier Invoice Date is required."

        # 6. GST Ledgers (IGST/CGST/SGST)
        gst_type = attrs.get('gst_type', getattr(self.instance, 'gst_type', 'STATE'))

        # Determine how many GST ledgers this voucher type actually has configured.
        # 0 configured  -> no GST ledger required at all (e.g. b2c with no GST applicable)
        # 1 configured  -> only gst_ledger_1 required, SGST not required
        # 2+ configured -> both gst_ledger_1 and gst_ledger_2 required (for intra-state)
        requires_gst_ledger_1 = True
        requires_sgst = True
        voucher_type_val = attrs.get('voucher_type', getattr(self.instance, 'voucher_type', None))
        if voucher_type_val and str(voucher_type_val).isdigit():
            from settings_app.models import PrefixConfiguration
            try:
                prefix_config = PrefixConfiguration.objects.get(id=int(voucher_type_val))
                configured_count = prefix_config.gst_ledger.count()
                if configured_count == 0:
                    requires_gst_ledger_1 = False
                    requires_sgst = False
                elif configured_count == 1:
                    requires_sgst = False
            except PrefixConfiguration.DoesNotExist:
                pass

        if requires_gst_ledger_1:
            if 'gst_ledger_1' in attrs:
                if attrs['gst_ledger_1'] is None:
                    errors['gst_ledger_1'] = f"{'IGST' if gst_type == 'INTER_STATE' else 'CGST'} Ledger is required."
            elif not is_update:
                errors['gst_ledger_1'] = f"{'IGST' if gst_type == 'INTER_STATE' else 'CGST'} Ledger is required."

        if gst_type != 'INTER_STATE' and requires_sgst:
            if 'gst_ledger_2' in attrs:
                if attrs['gst_ledger_2'] is None:
                    errors['gst_ledger_2'] = "SGST Ledger is required."
            elif not is_update:
                errors['gst_ledger_2'] = "SGST Ledger is required."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        extra_charges_data = validated_data.pop('extra_charges', [])

        purchase_invoice = PurchaseInvoice.objects.create(
            **validated_data
        )

        for item_data in items_data:
            PurchaseInvoiceItem.objects.create(
                invoice=purchase_invoice,
                **item_data
            )

        for charge_data in extra_charges_data:
            PurchaseInvoiceExtraCharge.objects.create(
                invoice=purchase_invoice,
                **charge_data
            )

        sync_purchase_invoice_stock_entries(purchase_invoice)

        # Sync linked PO statuses
        sync_po_status_for_invoice(purchase_invoice)

        return purchase_invoice

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', [])
        extra_charges_data = validated_data.pop('extra_charges', [])

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        instance.items.all().delete()
        instance.extra_charges.all().delete()

        for item_data in items_data:
            PurchaseInvoiceItem.objects.create(
                invoice=instance,
                **item_data
            )

        for charge_data in extra_charges_data:
            PurchaseInvoiceExtraCharge.objects.create(
                invoice=instance,
                **charge_data
            )

        sync_purchase_invoice_stock_entries(instance)

        # Sync linked PO statuses
        sync_po_status_for_invoice(instance)

        return instance


class PurchaseInvoiceListSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(
        source='supplier_ledger.name',
        read_only=True
    )
    purchase_ledger_name = serializers.CharField(
        source='purchase_ledger.name',
        read_only=True
    )
    items = PurchaseInvoiceItemSerializer(
        many=True,
        read_only=True
    )
    outstanding_amount = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseInvoice
        fields = [
            'id',
            'invoice_no',
            'entry_date',
            'supplier_name',
            'purchase_ledger_name',
            'gst_type',
            'supplier_invoice_no',
            'supplier_invoice_date',
            'total_amount',
            'outstanding_amount',
            # 'is_posted',
            'items'
        ]

    def get_outstanding_amount(self, obj):
        from django.db.models import Sum
        total_allocated = obj.bill_allocations.aggregate(total=Sum('amount'))['total'] or 0
        return max(0.0, round(float(obj.total_amount) - float(total_allocated), 2))


class PurchaseReturnExtraChargeSerializer(serializers.ModelSerializer):
    ledger_name = serializers.CharField(source='ledger.name', read_only=True)

    class Meta:
        model = PurchaseReturnExtraCharge
        fields = '__all__'
        read_only_fields = ['purchase_return']



class PurchaseReturnItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(
        source='product.name',
        read_only=True
    )

    godown_name = serializers.CharField(
        source='godown.name',
        read_only=True
    )

    per_name = serializers.CharField(
        source='per.name',
        read_only=True
    )

    class Meta:
        model = PurchaseReturnItem
        fields = '__all__'
        read_only_fields = [
            'purchase_return', 'hsn',
            'gst_percent', 'gst_amount', 'cgst_amount', 'sgst_amount', 'igst_amount'
        ]


def sync_purchase_return_stock_entries(purchase_return):
    from inventory_app.models import StockTable, StockTableDuplicate
    
    # 1. Clear existing entries for this purchase return
    StockTable.objects.filter(transaction_type='PURCHASE_RETURN', reference_id=purchase_return.id).delete()
    StockTableDuplicate.objects.filter(transaction_type='PURCHASE_RETURN', reference_id=purchase_return.id).delete()
    
    # 2. Create new entries for each PurchaseReturnItem
    for item in purchase_return.items.all():
        if item.product:
            common_data = {
                'item': item.product,
                'movement_type': 'OUT',
                'transaction_type': 'PURCHASE_RETURN',
                'reference_id': purchase_return.id,
                'quantity': item.quantity,
                'rate': item.rate,
                'batch_number': item.batch_number,
                'manufacture_date': item.manufacture_date,
                'expiry_date': item.expiry_date,
                'warehouse': item.godown,
                'date': purchase_return.entry_date,
                'verified_by': purchase_return.created_by,
                'is_active': True,
            }
            StockTable.objects.create(**common_data)
            StockTableDuplicate.objects.create(**common_data)


class PurchaseReturnSerializer(serializers.ModelSerializer):
    items = PurchaseReturnItemSerializer(
        many=True
    )

    extra_charges = PurchaseReturnExtraChargeSerializer(
        many=True,
        required=False
    )

    supplier_name = serializers.CharField(
        source='supplier_ledger.name',
        read_only=True
    )

    purchase_ledger_name = serializers.CharField(
        source='purchase_ledger.name',
        read_only=True
    )

    voucher_type = serializers.CharField(
        max_length=50,
        allow_blank=True,
        required=False
    )


    class Meta:
        model = PurchaseReturn
        fields = '__all__'

    def validate(self, attrs):
        is_update = self.instance is not None
        is_partial = self.partial
        errors = {}

        # 1. Supplier Ledger
        if 'supplier_ledger' in attrs:
            if attrs['supplier_ledger'] is None:
                errors['supplier_ledger'] = "Supplier is required."
        elif not is_update:
            errors['supplier_ledger'] = "Supplier is required."

        # 2. Purchase Ledger
        if 'purchase_ledger' in attrs:
            if attrs['purchase_ledger'] is None:
                errors['purchase_ledger'] = "Purchase Ledger is required."
        elif not is_update:
            errors['purchase_ledger'] = "Purchase Ledger is required."

        # 3. Items
        if 'items' in attrs:
            items = attrs['items']
            if not items:
                errors['items'] = "At least one item is required."
            else:
                for idx, item in enumerate(items):
                    qty = item.get('quantity')
                    rate = item.get('rate')
                    if qty is None or float(qty) <= 0:
                        errors[f'item_{idx}_quantity'] = "Item quantity must be greater than zero."
                    if rate is None or float(rate) <= 0:
                        errors[f'item_{idx}_rate'] = "Item rate must be greater than zero."
        elif not is_partial:
            errors['items'] = "At least one item is required."



        # 6. GST Ledgers (IGST/CGST/SGST)
        gst_type = attrs.get('gst_type', getattr(self.instance, 'gst_type', 'STATE'))
        
        requires_gst_1 = True
        requires_sgst = True
        
        voucher_type_val = attrs.get('voucher_type', getattr(self.instance, 'voucher_type', None))
        if voucher_type_val and str(voucher_type_val).isdigit():
            from settings_app.models import PrefixConfiguration
            try:
                prefix_config = PrefixConfiguration.objects.get(id=int(voucher_type_val))
                gst_count = prefix_config.gst_ledger.count()
                
                if gst_count == 0:
                    requires_gst_1 = False
                    requires_sgst = False
                    attrs['gst_ledger_1'] = None
                    attrs['gst_ledger_2'] = None
                    attrs['gst_amount_1'] = 0
                    attrs['gst_amount_2'] = 0
                elif gst_count == 1:
                    requires_sgst = False
            except PrefixConfiguration.DoesNotExist:
                pass

        if requires_gst_1:
            if 'gst_ledger_1' in attrs:
                if attrs['gst_ledger_1'] is None:
                    errors['gst_ledger_1'] = f"{'IGST' if gst_type == 'INTER_STATE' else 'CGST'} Ledger is required."
            elif not is_update:
                errors['gst_ledger_1'] = f"{'IGST' if gst_type == 'INTER_STATE' else 'CGST'} Ledger is required."

        if gst_type != 'INTER_STATE' and requires_sgst:
            if 'gst_ledger_2' in attrs:
                if attrs['gst_ledger_2'] is None:
                    errors['gst_ledger_2'] = "SGST Ledger is required."
            elif not is_update:
                errors['gst_ledger_2'] = "SGST Ledger is required."
            

        if errors:
            raise serializers.ValidationError(errors)

        return attrs
    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        extra_charges_data = validated_data.pop('extra_charges', [])

        purchase_invoice = PurchaseInvoice.objects.create(
            **validated_data
        )

        for item_data in items_data:
            PurchaseInvoiceItem.objects.create(
                invoice=purchase_invoice,
                **item_data
            )

        for charge_data in extra_charges_data:
            PurchaseInvoiceExtraCharge.objects.create(
                invoice=purchase_invoice,
                **charge_data
            )

        sync_purchase_invoice_stock_entries(purchase_invoice)

        # Sync linked PO statuses
        sync_po_status_for_invoice(purchase_invoice)

        # Check auto push to Tally configuration
        try:
            from purchase_app.models import PurchaseTallySyncConfig
            config = PurchaseTallySyncConfig.objects.filter(voucher_type='Purchase Invoice').first()
            if config and config.auto_push_on_save:
                from purchase_app.views import _push_purchase_invoice_to_tally
                _push_purchase_invoice_to_tally(purchase_invoice, tally_url=config.tally_url)
        except Exception as e:
            import logging
            logging.getLogger('tally_sync').error(f"Auto-push error on invoice create: {e}")

        return purchase_invoice

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', [])
        extra_charges_data = validated_data.pop('extra_charges', [])

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Reset sync status to pending on edit so changes can be pushed to Tally again
        instance.sync_status = 'pending'
        instance.is_synced = False
        instance.save()

        instance.items.all().delete()
        instance.extra_charges.all().delete()

        for item_data in items_data:
            PurchaseInvoiceItem.objects.create(
                invoice=instance,
                **item_data
            )

        for charge_data in extra_charges_data:
            PurchaseInvoiceExtraCharge.objects.create(
                invoice=instance,
                **charge_data
            )

        sync_purchase_invoice_stock_entries(instance)

        # Sync linked PO statuses
        sync_po_status_for_invoice(instance)

        # Check auto push to Tally configuration
        try:
            from purchase_app.models import PurchaseTallySyncConfig
            config = PurchaseTallySyncConfig.objects.filter(voucher_type='Purchase Invoice').first()
            if config and config.auto_push_on_save:
                from purchase_app.views import _push_purchase_invoice_to_tally
                _push_purchase_invoice_to_tally(instance, tally_url=config.tally_url)
        except Exception as e:
            import logging
            logging.getLogger('tally_sync').error(f"Auto-push error on invoice update: {e}")

        return instance

class PurchaseReturnListSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(
        source='supplier_ledger.name',
        read_only=True
    )
    purchase_ledger_name = serializers.CharField(
        source='purchase_ledger.name',
        read_only=True
    )
    items = PurchaseReturnItemSerializer(
        many=True,
        read_only=True
    )

    class Meta:
        model = PurchaseReturn
        fields = [
            'id',
            'return_no',
            'entry_date',
            'supplier_name',
            'purchase_ledger_name',
            'gst_type',
            'supplier_invoice_no',
            'total_amount',
            # 'is_posted',
            'items'
        ]