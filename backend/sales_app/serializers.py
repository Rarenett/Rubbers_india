from rest_framework import serializers
from finance_app.serializers import VoucherExtraChargeSerializer
from .models import SalesOrder, SalesOrderItem, SalesOrderTransaction, DeliveryLocation, DailyEntry, DailyProductionItem, SalesInvoice, SalesInvoiceItem, SalesInvoiceExtraCharge


class DeliveryLocationSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    location_name = serializers.CharField(source='delivery_location.stop_name', read_only=True)

    class Meta:
        model = DeliveryLocation
        fields = ['id', 'delivery_location', 'location_name', 'customer', 'customer_name']


class SalesOrderItemSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)  # Allow id field for updating nested items
    product_name = serializers.SerializerMethodField()
    warehouse_name = serializers.SerializerMethodField()
    per_name = serializers.SerializerMethodField()

    class Meta:
        model = SalesOrderItem
        fields = [
            'id', 'sales_order', 'product', 'product_name', 'warehouse', 'warehouse_name',
            'quantity', 'invoiced_quantity', 'rate', 'discount_percent', 'discount_amount', 'gst_percent',
            'gst_amount', 'cgst_amount', 'sgst_amount', 'igst_amount', 'amount',
            'per', 'per_name',
            'batch_number', 'manufacture_date', 'expiry_date', 'hsn'
        ]
        read_only_fields = ['sales_order', 'hsn']

    def get_product_name(self, obj):
        try:
            return obj.product.name if obj.product else None
        except Exception:
            return None

    def get_warehouse_name(self, obj):
        try:
            return obj.warehouse.name if obj.warehouse else None
        except Exception:
            return None

    def get_per_name(self, obj):
        try:
            return obj.per.name if obj.per else None
        except Exception:
            return None


def sync_sales_order_stock_entries(sales_order):
    from inventory_app.models import StockTableDuplicate
    
    # 1. Clear existing entries for this sales order
    StockTableDuplicate.objects.filter(transaction_type='SALES_ORDER', reference_id=sales_order.id).delete()
    
    # 2. Create new entries for each SalesOrderItem
    for item in sales_order.items.all():
        if item.product:
            StockTableDuplicate.objects.create(
                item=item.product,
                movement_type='OUT',
                transaction_type='SALES_ORDER',
                reference_id=sales_order.id,
                quantity=item.quantity,
                rate=item.rate,
                warehouse=item.warehouse,
                date=sales_order.entry_date,
                verified_by=sales_order.created_by,
                is_active=True,
            )


class SalesOrderSerializer(serializers.ModelSerializer):
    so_no = serializers.CharField(required=False, allow_blank=True)
    items = SalesOrderItemSerializer(many=True, required=False)
    extra_charges = VoucherExtraChargeSerializer(many=True, required=False)
    created_by_name = serializers.SerializerMethodField()
    edited_by_name = serializers.SerializerMethodField()
    customer_ledger_name = serializers.SerializerMethodField()
    sales_ledger_name = serializers.SerializerMethodField()
    driver_name = serializers.SerializerMethodField()
    vehicle_name = serializers.SerializerMethodField()
    delivery_location_name = serializers.SerializerMethodField()
    rest_amount_to_pay = serializers.SerializerMethodField()

    class Meta:
        model = SalesOrder
        fields = [
            'id', 'order_type', 'so_no', 'entry_date', 'customer_ledger', 'customer_ledger_name',
            'sales_ledger', 'sales_ledger_name',
            'driver', 'driver_name', 'vehicle', 'vehicle_name',
            'gst_ledger_1', 'gst_amount_1', 'gst_ledger_2', 'gst_amount_2',
            'total_amount', 'narration', 'is_posted', 'other_reference',
            'terms_of_delivery', 'dispatch_through', 'document_no', 'document_date',
            'created_at', 'created_by', 'created_by_name', 'edited_by', 'edited_by_name', 'updated_at',
            'priority', 'preferred_delivery_date', 'delivery_location', 'delivery_location_name', 'status', 'approval_status',
            'sync_status', 'is_synced',
            'rest_amount_to_pay', 'items', 'extra_charges'
        ]
        read_only_fields = ['created_by', 'edited_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        try:
            return obj.created_by.get_full_name() if obj.created_by else None
        except Exception:
            return None

    def get_edited_by_name(self, obj):
        try:
            return obj.edited_by.get_full_name() if obj.edited_by else None
        except Exception:
            return None

    def get_customer_ledger_name(self, obj):
        try:
            return obj.customer_ledger.name if obj.customer_ledger else None
        except Exception:
            return None

    def get_sales_ledger_name(self, obj):
        try:
            return obj.sales_ledger.name if obj.sales_ledger else None
        except Exception:
            return None

    def get_driver_name(self, obj):
        try:
            if obj.driver:
                return obj.driver.user.get_full_name() if obj.driver.user else str(obj.driver)
            return None
        except Exception:
            return None

    def get_vehicle_name(self, obj):
        try:
            # 1. First check if the explicit `vehicle` FK is set
            if getattr(obj, 'vehicle', None):
                name = obj.vehicle.vehicle_name or ''
                number = obj.vehicle.vehicle_number or ''
                if name and number:
                    return f"{name} ({number})"
                return name or number
            
            # 2. Fall back to dispatch_through which historically stores vehicle_number
            if getattr(obj, 'dispatch_through', None):
                from logistics_app.models import Vehicle
                v = Vehicle.objects.filter(vehicle_number=obj.dispatch_through).first()
                if v:
                    name = v.vehicle_name or ''
                    number = v.vehicle_number or ''
                    if name and number:
                        return f"{name} ({number})"
                    return name or number
                return obj.dispatch_through
                
            return None
        except Exception:
            return None

    def get_delivery_location_name(self, obj):
        try:
            return obj.delivery_location.stop_name if obj.delivery_location else None
        except Exception:
            return None

    def get_rest_amount_to_pay(self, obj):
        if obj.approval_status != 'Not Approved':
            return 0.0
            
        customer = obj.customer_ledger
        if not customer or customer.credit_limit <= 0:
            return 0.0
            
        allowed_difference = float(customer.credit_limit) - float(customer.closing_balance or 0)
        from django.db.models import Sum
        from .models import SalesOrder
        pending_orders = SalesOrder.objects.filter(customer_ledger=customer).exclude(status='Delivered')
        total_pending = pending_orders.aggregate(total=Sum('total_amount'))['total'] or 0
        
        if total_pending > allowed_difference:
            return float(total_pending) - allowed_difference
        return 0.0

    def validate(self, attrs):
        is_update = self.instance is not None
        is_partial = self.partial
        errors = {}

        # 1. Customer
        if 'customer_ledger' in attrs:
            if attrs['customer_ledger'] is None:
                errors['customer_ledger'] = "Customer is required."
        elif not is_update:
            errors['customer_ledger'] = "Customer is required."

        # 2. Dispatch Through
        if 'dispatch_through' in attrs:
            if not attrs['dispatch_through'] or not str(attrs['dispatch_through']).strip():
                errors['dispatch_through'] = "Vehicle No./ Dispatch Through is required."
        elif not is_update:
            errors['dispatch_through'] = "Vehicle No./ Dispatch Through is required."

        # 3. Delivery Location
        if 'delivery_location' in attrs:
            if not attrs['delivery_location'] or not str(attrs['delivery_location']).strip():
                errors['delivery_location'] = "Delivery Location is required."
        elif not is_update:
            errors['delivery_location'] = "Delivery Location is required."

        # 4. Driver
        other_ref = attrs.get('other_reference', '') or getattr(self.instance, 'other_reference', '')
        if other_ref != 'Marketing Connect':
            if 'driver' in attrs:
                if attrs['driver'] is None:
                    errors['driver'] = "Driver is required."
            elif not is_update:
                errors['driver'] = "Driver is required."

        # 5. Preferred Delivery Date
        if 'preferred_delivery_date' in attrs:
            if attrs['preferred_delivery_date'] is None:
                errors['preferred_delivery_date'] = "Delivery Date & Time is required."
        elif not is_update:
            errors['preferred_delivery_date'] = "Delivery Date & Time is required."

        # 6. Items
        if 'items' in attrs:
            items = attrs['items']
            if not items:
                errors['items'] = "At least one item is required."
            else:
                from inventory_app.models import StockTable
                from django.db.models import Sum
                for idx, item in enumerate(items):
                    qty = item.get('quantity')
                    rate = item.get('rate')
                    if qty is None or float(qty) <= 0:
                        errors[f'item_{idx}_quantity'] = "Item quantity must be greater than zero."
                    if rate is None or float(rate) <= 0:
                        errors[f'item_{idx}_rate'] = "Item rate must be greater than zero."
                        
                    product = item.get('product')
                    if product and qty and float(qty) > 0:
                        qs = StockTable.objects.filter(item=product, is_active=True)
                        in_qty = qs.filter(movement_type='IN').aggregate(total=Sum('quantity'))['total'] or 0
                        out_qty = qs.filter(movement_type='OUT').aggregate(total=Sum('quantity'))['total'] or 0
                        available_stock = in_qty - out_qty
                        
                        if float(qty) > float(available_stock):
                            errors[f'item_{idx}_quantity'] = f"Insufficient stock. Available: {available_stock}"
        elif not is_partial:
            errors['items'] = "At least one item is required."

        if errors:
            raise serializers.ValidationError(errors)

        # Credit Limit Check
        customer = attrs.get('customer_ledger')
        if customer is None and is_update:
            customer = self.instance.customer_ledger
            
        total_amount = attrs.get('total_amount')
        if total_amount is None and is_update:
            total_amount = self.instance.total_amount
            
        if customer:
            allowed_difference = float(customer.credit_limit) - float(customer.closing_balance or 0)
            
            from django.db.models import Sum
            from .models import SalesOrder
            pending_orders = SalesOrder.objects.filter(customer_ledger=customer).exclude(status='Delivered')
            if is_update:
                pending_orders = pending_orders.exclude(id=self.instance.id)
                
            pending_amount = pending_orders.aggregate(total=Sum('total_amount'))['total'] or 0
            
            total_required = float(total_amount or 0) + float(pending_amount)
            
            if total_required > allowed_difference:
                attrs['approval_status'] = 'Not Approved'
            else:
                attrs['approval_status'] = 'Approved'
        else:
            attrs['approval_status'] = 'Approved'

        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        extra_charges_data = validated_data.pop('extra_charges', [])
        user = self.context['request'].user if 'request' in self.context else None
        if 'so_no' in validated_data and not validated_data['so_no']:
            validated_data.pop('so_no')
        sales_order = SalesOrder.objects.create(created_by=user, **validated_data)
        
        # Save delivery location if it is a new location for this customer ledger
        route_stop = validated_data.get('delivery_location')
        customer = validated_data.get('customer_ledger')
        if route_stop and customer:
            exists = DeliveryLocation.objects.filter(
                customer=customer,
                delivery_location=route_stop
            ).exists()
            if not exists:
                DeliveryLocation.objects.create(
                    customer=customer,
                    delivery_location=route_stop
                )

        for item_data in items_data:
            SalesOrderItem.objects.create(sales_order=sales_order, **item_data)
        for ec_data in extra_charges_data:
            sales_order.extra_charges.create(**ec_data)
            
        sync_sales_order_stock_entries(sales_order)
        
        # Check auto push to Tally configuration
        try:
            from sales_app.services.tally_service import get_tally_config
            config = get_tally_config('Sales Order')
            if config and bool(config.auto_push_on_save) is True:
                from sales_app.services.tally_service import push_sales_order_to_tally
                effective_user = user if (user and user.is_authenticated) else None
                push_sales_order_to_tally(sales_order, tally_url=config.tally_url, user=effective_user, push_type='auto')
        except Exception as e:
            import logging
            logging.getLogger('tally_sync').error(f"Auto-push error on create: {e}")

        return sales_order

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        extra_charges_data = validated_data.pop('extra_charges', None)
        user = self.context['request'].user if 'request' in self.context else None
        if 'so_no' in validated_data and not validated_data['so_no']:
            validated_data.pop('so_no')
        
        # Update SalesOrder fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.edited_by = user
        # Reset sync status to pending on edit so changes can be pushed to Tally again
        instance.sync_status = 'pending'
        instance.is_synced = False
        instance.save()

        # Save delivery location if it is a new location for this customer ledger
        route_stop = validated_data.get('delivery_location')
        if route_stop is None:
            route_stop = instance.delivery_location
        customer = validated_data.get('customer_ledger')
        if customer is None:
            customer = instance.customer_ledger

        if route_stop and customer:
            exists = DeliveryLocation.objects.filter(
                customer=customer,
                delivery_location=route_stop
            ).exists()
            if not exists:
                DeliveryLocation.objects.create(
                    customer=customer,
                    delivery_location=route_stop
                )
        
        if items_data is not None:
            # Handle nested items update/create/delete
            existing_items = {item.id: item for item in instance.items.all()}
            keep_item_ids = []
            
            for item_data in items_data:
                item_id = item_data.get('id', None)
                if item_id and item_id in existing_items:
                    # Update existing item
                    item_instance = existing_items[item_id]
                    for attr, value in item_data.items():
                        if attr != 'id':
                            setattr(item_instance, attr, value)
                    item_instance.save()
                    keep_item_ids.append(item_id)
                else:
                    # Create new item
                    new_item = SalesOrderItem.objects.create(sales_order=instance, **item_data)
                    keep_item_ids.append(new_item.id)
            
            # Delete items not present in request payload
            for item_id, item_instance in existing_items.items():
                if item_id not in keep_item_ids:
                    item_instance.delete()
                    
        if extra_charges_data is not None:
            existing_charges = {charge.id: charge for charge in instance.extra_charges.all()}
            keep_charge_ids = []
            
            for ec_data in extra_charges_data:
                charge_id = ec_data.get('id', None)
                if charge_id and charge_id in existing_charges:
                    charge_instance = existing_charges[charge_id]
                    for attr, value in ec_data.items():
                        if attr != 'id':
                            setattr(charge_instance, attr, value)
                    charge_instance.save()
                    keep_charge_ids.append(charge_instance.id)
                else:
                    new_charge = instance.extra_charges.create(**ec_data)
                    keep_charge_ids.append(new_charge.id)
                    
            for charge_id, charge_instance in existing_charges.items():
                if charge_id not in keep_charge_ids:
                    charge_instance.delete()
                    
        sync_sales_order_stock_entries(instance)

        # Check auto push to Tally configuration
        try:
            from sales_app.services.tally_service import get_tally_config
            config = get_tally_config('Sales Order')
            if config and bool(config.auto_push_on_save) is True:
                from sales_app.services.tally_service import push_sales_order_to_tally
                effective_user = user if (user and user.is_authenticated) else None
                push_sales_order_to_tally(instance, tally_url=config.tally_url, user=effective_user, push_type='auto')
        except Exception as e:
            import logging
            logging.getLogger('tally_sync').error(f"Auto-push error on update: {e}")

        return instance


class SalesOrderTransactionSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()
    so_no = serializers.SerializerMethodField()

    class Meta:
        model = SalesOrderTransaction
        fields = [
            'id', 'sales_order', 'so_no', 'product', 'product_name', 'transaction_date',
            'quantity_delivered', 'quantity_remaining', 'created_at'
        ]

    def get_product_name(self, obj):
        try:
            return obj.product.name if obj.product else None
        except Exception:
            return None

    def get_so_no(self, obj):
        try:
            return obj.sales_order.so_no if obj.sales_order else None
        except Exception:
            return None



class SalesInvoiceItemSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    product_name = serializers.SerializerMethodField()
    warehouse_name = serializers.SerializerMethodField()
    per_name = serializers.SerializerMethodField()

    class Meta:
        model = SalesInvoiceItem
        fields = [
            'id', 'invoice', 'sales_order', 'sales_order_item', 'product', 'product_name', 'warehouse', 'warehouse_name',
            'quantity', 'rate', 'discount_percent', 'discount_amount', 'gst_percent',
            'gst_amount', 'cgst_amount', 'sgst_amount', 'igst_amount', 'amount',
            'per', 'per_name',
            'batch_number', 'manufacture_date', 'expiry_date',
            'hsn',
        ]
        read_only_fields = ['invoice', 'hsn']

    def get_product_name(self, obj):
        try:
            return obj.product.name if obj.product else None
        except Exception:
            return None

    def get_warehouse_name(self, obj):
        try:
            return obj.warehouse.name if obj.warehouse else None
        except Exception:
            return None

    def get_per_name(self, obj):
        try:
            return obj.per.name if obj.per else None
        except Exception:
            return None

from rest_framework import serializers
from .models import SalesReturn, SalesReturnItem



class SalesReturnItemSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    product_name = serializers.SerializerMethodField()
    warehouse_name = serializers.SerializerMethodField()
    per_name = serializers.SerializerMethodField()

    class Meta: 
        model = SalesReturnItem
        fields = [
            'id', 'sales_return',
            'product', 'product_name',
            'warehouse', 'warehouse_name',
            'quantity', 'rate',
            'discount_percent', 'discount_amount',
            'gst_percent', 'gst_amount',
            'cgst_amount', 'sgst_amount', 'igst_amount',
            'amount',
            'per', 'per_name',
            'batch_number', 'manufacture_date', 'expiry_date',
            'hsn',
        ]
        read_only_fields = ['sales_return', 'hsn']

    def get_product_name(self, obj):
        try:
            return obj.product.name if obj.product else None
        except Exception:
            return None

    def get_warehouse_name(self, obj):
        try:
            return obj.warehouse.name if obj.warehouse else None
        except Exception:
            return None

    def get_per_name(self, obj):
        try:
            return obj.per.name if obj.per else None
        except Exception:
            return None

def recalculate_points_entries_for_invoice(invoice_no):
    """
    Recalculates any WalletPointsEntry records linked by reference_no=invoice_no,
    deducting valid, applicable SalesReturn items (quantity or value) to compute net sales.
    """
    if not invoice_no:
        return
    try:
        from wallet_app.models import WalletPointsEntry, WalletScheme
        from sales_app.models import SalesInvoice, SalesReturn

        invoice = SalesInvoice.objects.filter(invoice_no=invoice_no).prefetch_related('items').first()
        if not invoice:
            return

        matching_entries = WalletPointsEntry.objects.filter(reference_no=invoice_no).select_related('wallet', 'scheme')
        if not matching_entries.exists():
            return

        # Fetch all applicable sales returns linked to this sales invoice
        returns = SalesReturn.objects.filter(sales_invoice_no=invoice_no).prefetch_related('items')
        return_items = []
        for ret in returns:
            return_items.extend(ret.items.all())

        for pe in matching_entries:
            if not pe.scheme:
                continue
            c_type = pe.scheme.criteria_type or 'Quantity'
            q_rows = list(pe.scheme.criteria_rows.filter(criteria_group='criteria').values('product_id', 'quantity', 'points')) if c_type in ['Quantity', 'Both'] else []
            v_rows = list(pe.scheme.criteria_values.all().values('product_id', 'value', 'points')) if c_type in ['Value', 'Both'] else []

            inv_items = invoice.items.all()
            new_total_points = Decimal('0.00')

            if pe.scheme.is_consolidated:
                # ── CONSOLIDATED CALCULATION ──
                # Sum net quantities/values across all applicable products, then evaluate threshold
                if q_rows:
                    eligible_pids = {qr['product_id'] for qr in q_rows if qr['product_id']}
                    primary_q = q_rows[0]
                    crit_qty = Decimal(str(primary_q['quantity'] or 0))
                    crit_pts = Decimal(str(primary_q['points'] or 0))

                    total_net_qty = Decimal('0.00')
                    for it in inv_items:
                        p_id = it.product_id
                        if not eligible_pids or p_id in eligible_pids:
                            ret_qty = sum(
                                Decimal(str(ri.quantity or 0))
                                for ri in return_items
                                if ri.product_id == p_id
                            )
                            gross_qty = Decimal(str(it.quantity or 0))
                            net_qty = max(Decimal('0.00'), gross_qty - ret_qty)
                            total_net_qty += net_qty

                    if crit_qty > 0 and total_net_qty >= crit_qty:
                        new_total_points += (total_net_qty / crit_qty) * crit_pts

                if v_rows:
                    eligible_pids = {vr['product_id'] for vr in v_rows if vr['product_id']}
                    primary_v = v_rows[0]
                    crit_val = Decimal(str(primary_v['value'] or 0))
                    crit_pts = Decimal(str(primary_v['points'] or 0))

                    total_net_val = Decimal('0.00')
                    for it in inv_items:
                        p_id = it.product_id
                        if not eligible_pids or p_id in eligible_pids:
                            ret_val = sum(
                                Decimal(str(ri.amount or 0))
                                for ri in return_items
                                if ri.product_id == p_id
                            )
                            gross_val = Decimal(str(it.amount or 0))
                            net_val = max(Decimal('0.00'), gross_val - ret_val)
                            total_net_val += net_val

                    if crit_val > 0 and total_net_val >= crit_val:
                        new_total_points += (total_net_val / crit_val) * crit_pts
            else:
                # ── INDIVIDUAL PRODUCT CALCULATION ──
                for it in inv_items:
                    p_id = it.product_id

                    # Calculate applicable return quantity and value for this product
                    ret_qty = sum(
                        Decimal(str(ri.quantity or 0))
                        for ri in return_items
                        if ri.product_id == p_id
                    )
                    ret_val = sum(
                        Decimal(str(ri.amount or 0))
                        for ri in return_items
                        if ri.product_id == p_id
                    )

                    gross_qty = Decimal(str(it.quantity or 0))
                    gross_val = Decimal(str(it.amount or 0))

                    net_qty = max(Decimal('0.00'), gross_qty - ret_qty)
                    net_val = max(Decimal('0.00'), gross_val - ret_val)

                    # 1. Quantity criteria match
                    for qr in q_rows:
                        if qr['product_id'] == p_id:
                            crit_qty = Decimal(str(qr['quantity'] or 0))
                            crit_pts = Decimal(str(qr['points'] or 0))
                            if crit_qty > 0 and net_qty >= crit_qty:
                                new_total_points += (net_qty / crit_qty) * crit_pts

                    # 2. Value criteria match
                    for vr in v_rows:
                        if vr['product_id'] == p_id:
                            crit_val = Decimal(str(vr['value'] or 0))
                            crit_pts = Decimal(str(vr['points'] or 0))
                            if crit_val > 0 and net_val >= crit_val:
                                new_total_points += (net_val / crit_val) * crit_pts

            new_total_points = new_total_points.quantize(Decimal('0.01'))
            if pe.points != new_total_points:
                old_pts = pe.points
                diff = new_total_points - old_pts
                pe.points = new_total_points
                if pe.entry_type == 'Addition':
                    pe.balance_after = pe.balance_after + diff
                else:
                    pe.balance_after = pe.balance_after - diff
                pe.save(update_fields=['points', 'balance_after'])
    except Exception as e:
        import logging
        logging.getLogger('wallet_app').error(f"Error auto-updating points entry for invoice {invoice_no}: {e}")


def sync_sales_invoice_stock_entries(sales_invoice):
    from inventory_app.models import StockTable, StockTableDuplicate
    
    # 1. Clear existing entries for this sales invoice
    StockTable.objects.filter(transaction_type='SALES_INVOICE', reference_id=sales_invoice.id).delete()
    StockTableDuplicate.objects.filter(transaction_type='SALES_INVOICE', reference_id=sales_invoice.id).delete()
    
    # 2. Create new entries for each SalesInvoiceItem
    for item in sales_invoice.items.all():
        if item.product:
            b_num = item.batch_number
            if b_num and b_num.strip() == 'Primary / Unbatched':
                b_num = None
            common_data = {
                'item': item.product,
                'movement_type': 'OUT',
                'transaction_type': 'SALES_INVOICE',
                'reference_id': sales_invoice.id,
                'quantity': item.quantity,
                'rate': item.rate,
                'warehouse': item.warehouse,
                'batch_number': b_num or None,
                'manufacture_date': item.manufacture_date or None,
                'expiry_date': item.expiry_date or None,
                'date': sales_invoice.entry_date,
                'verified_by': sales_invoice.created_by,
                'is_active': True,
            }
            StockTable.objects.create(**common_data)
            StockTableDuplicate.objects.create(**common_data)


class SalesInvoiceExtraChargeSerializer(serializers.ModelSerializer):
    ledger_name = serializers.CharField(source='ledger.name', read_only=True)

    class Meta:
        model = SalesInvoiceExtraCharge
        fields = '__all__'
        read_only_fields = ['invoice']


class SalesInvoiceSerializer(serializers.ModelSerializer):
    invoice_no = serializers.CharField(required=False, allow_blank=True)
    items = SalesInvoiceItemSerializer(many=True, required=False)
    extra_charges = SalesInvoiceExtraChargeSerializer(many=True, required=False)
    created_by_name = serializers.SerializerMethodField()
    edited_by_name = serializers.SerializerMethodField()
    customer_ledger_name = serializers.SerializerMethodField()
    sales_orders = serializers.PrimaryKeyRelatedField(many=True, queryset=SalesOrder.objects.all(), required=False)
    outstanding_amount = serializers.SerializerMethodField()

    class Meta:
        model = SalesInvoice
        fields = [
            'id', 'voucher_type', 'invoice_no', 'entry_date', 'sales_ledger', 'status',
            'priority', 'preferred_delivery_date', 'customer_ledger', 'customer_ledger_name',
            'buyer_address', 'buyer_gst_no', 'shipping_address',
            'gst_ledger_1', 'gst_amount_1', 'gst_ledger_2', 'gst_amount_2',
            'total_amount', 'outstanding_amount', 'narration', 'is_posted', 'created_at', 'created_by',
            'created_by_name', 'edited_by', 'edited_by_name', 'updated_at',
            'is_stock_reserved', 'on_hold_reason', 'sales_orders',
            'sync_status', 'is_synced',
            'items', 'extra_charges']

    def get_outstanding_amount(self, obj):
        from django.db.models import Sum
        total_allocated = obj.bill_allocations.aggregate(total=Sum('amount'))['total'] or 0
        return float(obj.total_amount) - float(total_allocated)

    def get_created_by_name(self, obj):
        return obj.created_by.first_name if obj.created_by else None

    def get_edited_by_name(self, obj):
        return obj.edited_by.first_name if obj.edited_by else None

    def get_customer_ledger_name(self, obj):
        return obj.customer_ledger.name if obj.customer_ledger else None

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        extra_charges_data = validated_data.pop('extra_charges', [])
        sales_orders_data = validated_data.pop('sales_orders', [])
        
        user = self.context['request'].user if 'request' in self.context else None
        
        if 'invoice_no' in validated_data and not validated_data['invoice_no']:
            validated_data.pop('invoice_no')
            
        sales_invoice = SalesInvoice.objects.create(created_by=user, **validated_data)
        
        if sales_orders_data:
            sales_invoice.sales_orders.set(sales_orders_data)
            
        for item_data in items_data:
            if not item_data.get('sales_order') and item_data.get('sales_order_item'):
                item_data['sales_order'] = item_data['sales_order_item'].sales_order
            SalesInvoiceItem.objects.create(invoice=sales_invoice, **item_data)
            
        for ec_data in extra_charges_data:
            SalesInvoiceExtraCharge.objects.create(invoice=sales_invoice, **ec_data)
            
        sync_sales_invoice_stock_entries(sales_invoice)

        # Check auto push to Tally configuration
        try:
            from sales_app.services.tally_service import get_tally_config
            config = get_tally_config('Sales Invoice')
            if config and bool(config.auto_push_on_save) is True:
                from sales_app.services.tally_service import push_sales_invoice_to_tally
                effective_user = user if (user and user.is_authenticated) else None
                push_sales_invoice_to_tally(sales_invoice, tally_url=config.tally_url, user=effective_user, push_type='auto')
        except Exception as e:
            import logging
            logging.getLogger('tally_sync').error(f"Auto-push error on invoice create: {e}")

        return sales_invoice

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        extra_charges_data = validated_data.pop('extra_charges', None)
        sales_orders_data = validated_data.pop('sales_orders', None)
        
        user = self.context['request'].user if 'request' in self.context else None
        
        if 'invoice_no' in validated_data and not validated_data['invoice_no']:
            validated_data.pop('invoice_no')
            
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.edited_by = user
        # Reset sync status to pending on edit so changes can be pushed to Tally again
        instance.sync_status = 'pending'
        instance.is_synced = False
        instance.save()
        
        if sales_orders_data is not None:
            instance.sales_orders.set(sales_orders_data)
            
        if items_data is not None:
            existing_items = {item.id: item for item in instance.items.all()}
            keep_item_ids = []
            
            for item_data in items_data:
                item_id = item_data.get('id', None)
                if not item_data.get('sales_order') and item_data.get('sales_order_item'):
                    item_data['sales_order'] = item_data['sales_order_item'].sales_order
                if item_id and item_id in existing_items:
                    item_instance = existing_items[item_id]
                    for attr, value in item_data.items():
                        if attr != 'id':
                            setattr(item_instance, attr, value)
                    item_instance.save()
                    keep_item_ids.append(item_id)
                else:
                    new_item = SalesInvoiceItem.objects.create(invoice=instance, **item_data)
                    keep_item_ids.append(new_item.id)
                    
            for item_id, item_instance in existing_items.items():
                if item_id not in keep_item_ids:
                    item_instance.delete()
                    
        if extra_charges_data is not None:
            instance.extra_charges.all().delete()
            for ec_data in extra_charges_data:
                SalesInvoiceExtraCharge.objects.create(invoice=instance, **ec_data)
                    
        sync_sales_invoice_stock_entries(instance)

        # Check auto push to Tally configuration
        try:
            from sales_app.services.tally_service import get_tally_config
            config = get_tally_config('Sales Invoice')
            if config and bool(config.auto_push_on_save) is True:
                from sales_app.services.tally_service import push_sales_invoice_to_tally
                effective_user = user if (user and user.is_authenticated) else None
                push_sales_invoice_to_tally(instance, tally_url=config.tally_url, user=effective_user, push_type='auto')
        except Exception as e:
            import logging
            logging.getLogger('tally_sync').error(f"Auto-push error on invoice update: {e}")

        # Recalculate any associated points entries with net sales deduction
        recalculate_points_entries_for_invoice(instance.invoice_no)

        return instance

    def get_created_by_name(self, obj):
        try:
            return obj.created_by.get_full_name() if obj.created_by else None
        except Exception:
            return None

    def get_edited_by_name(self, obj):
        try:
            return obj.edited_by.get_full_name() if obj.edited_by else None
        except Exception:
            return None

    def get_customer_ledger_name(self, obj):
        try:
            return obj.customer_ledger.name if obj.customer_ledger else None
        except Exception:
            return None


def sync_sales_return_stock_entries(sales_return):
    from inventory_app.models import StockTable, StockTableDuplicate
    
    # 1. Clear existing entries for this sales return
    StockTable.objects.filter(transaction_type='SALES_RETURN', reference_id=sales_return.id).delete()
    StockTableDuplicate.objects.filter(transaction_type='SALES_RETURN', reference_id=sales_return.id).delete()
    
    # 2. Create new entries for each SalesReturnItem
    for item in sales_return.items.all():
        if item.product:
            common_data = {
                'item': item.product,
                'movement_type': 'OUT',  # Sales return records as stock OUT
                'transaction_type': 'SALES_RETURN',
                'reference_id': sales_return.id,
                'quantity': item.quantity,
                'rate': item.rate,
                'batch_number': item.batch_number,
                'manufacture_date': item.manufacture_date,
                'expiry_date': item.expiry_date,
                'warehouse': item.warehouse,
                'date': sales_return.entry_date,
                'verified_by': sales_return.created_by,
                'is_active': True,
            }
            StockTable.objects.create(**common_data)
            StockTableDuplicate.objects.create(**common_data)


class SalesReturnSerializer(serializers.ModelSerializer):
    return_no = serializers.CharField(required=False, allow_blank=True)
    items = SalesReturnItemSerializer(many=True, required=False)

    created_by_name = serializers.SerializerMethodField()
    edited_by_name = serializers.SerializerMethodField()
    customer_ledger_name = serializers.SerializerMethodField()
    sales_ledger_name = serializers.SerializerMethodField()
    gst_ledger_1_name = serializers.SerializerMethodField()
    gst_ledger_2_name = serializers.SerializerMethodField()

    class Meta:
        model = SalesReturn
        fields = [
            'id',
            'voucher_type', 'return_type', 'return_no', 'entry_date',
            'customer_ledger', 'customer_ledger_name',
            'sales_ledger', 'sales_ledger_name',
            'sales_invoice_no', 'sales_invoice_date',
            'gst_ledger_1', 'gst_ledger_1_name', 'gst_amount_1',
            'gst_ledger_2', 'gst_ledger_2_name', 'gst_amount_2',
            'total_amount', 'narration', 'is_posted',
            'sync_status', 'is_synced',
            'created_at', 'created_by', 'created_by_name',
            'edited_by', 'edited_by_name', 'updated_at',
            'items',
        ]
        read_only_fields = ['sync_status', 'is_synced', 'created_by', 'edited_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else None

    def get_edited_by_name(self, obj):
        return obj.edited_by.get_full_name() if obj.edited_by else None

    def get_customer_ledger_name(self, obj):
        return obj.customer_ledger.name if obj.customer_ledger else None

    def get_sales_ledger_name(self, obj):
        return obj.sales_ledger.name if obj.sales_ledger else None

    def get_gst_ledger_1_name(self, obj):
        return obj.gst_ledger_1.name if obj.gst_ledger_1 else None

    def get_gst_ledger_2_name(self, obj):
        return obj.gst_ledger_2.name if obj.gst_ledger_2 else None

    # ── validation ────────────────────────────────────────────────────────────

    def validate(self, attrs):
        is_update = self.instance is not None
        is_partial = self.partial
        errors = {}

        # Customer
        if 'customer_ledger' in attrs:
            if attrs['customer_ledger'] is None:
                errors['customer_ledger'] = "Customer is required."
        elif not is_update:
            errors['customer_ledger'] = "Customer is required."

        # Sales Invoice No
        # if 'sales_invoice_no' in attrs:
        #     if not attrs['sales_invoice_no'] or not str(attrs['sales_invoice_no']).strip():
        #         errors['sales_invoice_no'] = "Sales Invoice No is required."
        # elif not is_update:
        #     errors['sales_invoice_no'] = "Sales Invoice No is required."

        # Sales Invoice Date
        # if 'sales_invoice_date' in attrs:
        #     if attrs['sales_invoice_date'] is None:
        #         errors['sales_invoice_date'] = "Sales Invoice Date is required."
        # elif not is_update:
        #     errors['sales_invoice_date'] = "Sales Invoice Date is required."

        # Sales Ledger
        if 'sales_ledger' in attrs:
            if attrs['sales_ledger'] is None:
                errors['sales_ledger'] = "Sales Ledger is required."
        elif not is_update:
            errors['sales_ledger'] = "Sales Ledger is required."

        # Items
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
                    if rate is None or float(rate) < 0:
                        errors[f'item_{idx}_rate'] = "Item rate must be zero or greater."
        elif not is_partial:
            errors['items'] = "At least one item is required."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    # ── create ────────────────────────────────────────────────────────────────

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        user = self.context['request'].user if 'request' in self.context else None

        if 'return_no' in validated_data and not validated_data['return_no']:
            validated_data.pop('return_no')

        sales_return = SalesReturn.objects.create(created_by=user, **validated_data)

        for item_data in items_data:
            SalesReturnItem.objects.create(sales_return=sales_return, **item_data)

        sync_sales_return_stock_entries(sales_return)

        # Recalculate any associated points entries with net sales deduction
        if sales_return.sales_invoice_no:
            recalculate_points_entries_for_invoice(sales_return.sales_invoice_no)

        # Check auto push to Tally configuration
        try:
            from sales_app.services.tally_service import get_tally_config
            config = get_tally_config('Sales Return')
            if config and bool(config.auto_push_on_save) is True:
                from sales_app.services.tally_service import push_sales_return_to_tally
                effective_user = user if (user and user.is_authenticated) else None
                push_sales_return_to_tally(sales_return, tally_url=config.tally_url, user=effective_user, push_type='auto')
        except Exception as e:
            import logging
            logging.getLogger('tally_sync').error(f"Auto-push error on sales return create: {e}")

        return sales_return

    # ── update ────────────────────────────────────────────────────────────────

    def update(self, instance, validated_data):
        old_invoice_no = instance.sales_invoice_no
        items_data = validated_data.pop('items', None)
        user = self.context['request'].user if 'request' in self.context else None

        if 'return_no' in validated_data and not validated_data['return_no']:
            validated_data.pop('return_no')

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.edited_by = user
        # Reset sync status to pending on edit so changes can be pushed to Tally again
        instance.sync_status = 'pending'
        instance.is_synced = False
        instance.save()

        if items_data is not None:
            existing_items = {item.id: item for item in instance.items.all()}
            keep_ids = []

            for item_data in items_data:
                item_id = item_data.get('id')
                if item_id and item_id in existing_items:
                    item_instance = existing_items[item_id]
                    for attr, value in item_data.items():
                        if attr != 'id':
                            setattr(item_instance, attr, value)
                    item_instance.save()
                    keep_ids.append(item_id)
                else:
                    new_item = SalesReturnItem.objects.create(sales_return=instance, **item_data)
                    keep_ids.append(new_item.id)

            # Delete items removed from the payload
            for item_id, item_instance in existing_items.items():
                if item_id not in keep_ids:
                    item_instance.delete()

        sync_sales_return_stock_entries(instance)

        # Recalculate any associated points entries with net sales deduction
        if instance.sales_invoice_no:
            recalculate_points_entries_for_invoice(instance.sales_invoice_no)
        if old_invoice_no and old_invoice_no != instance.sales_invoice_no:
            recalculate_points_entries_for_invoice(old_invoice_no)

        # Check auto push to Tally configuration
        try:
            from sales_app.services.tally_service import get_tally_config
            config = get_tally_config('Sales Return')
            if config and bool(config.auto_push_on_save) is True:
                from sales_app.services.tally_service import push_sales_return_to_tally
                effective_user = user if (user and user.is_authenticated) else None
                push_sales_return_to_tally(instance, tally_url=config.tally_url, user=effective_user, push_type='auto')
        except Exception as e:
            import logging
            logging.getLogger('tally_sync').error(f"Auto-push error on sales return update: {e}")

        return instance


class DailyProductionItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    unit_name = serializers.CharField(source='product.base_unit.uqc_code', read_only=True)

    class Meta:
        model = DailyProductionItem
        fields = ['id', 'product', 'product_name', 'unit_name', 'quantity', 'sales_quantity']


class DailyEntrySerializer(serializers.ModelSerializer):
    production_items = DailyProductionItemSerializer(many=True, required=False)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DailyEntry
        fields = [
            'id', 'entry_date', 'total_sales', 'total_outstanding',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'production_items'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        try:
            return obj.created_by.get_full_name() if obj.created_by else None
        except Exception:
            return None

    def validate_entry_date(self, value):
        from datetime import date
        if value > date.today():
            raise serializers.ValidationError("Future (post-dated) entry dates are not allowed.")
        return value

    def create(self, validated_data):
        production_items_data = validated_data.pop('production_items', [])
        
        request = self.context.get('request', None)
        user = request.user if request and request.user.is_authenticated else None
        
        daily_entry = DailyEntry.objects.create(created_by=user, **validated_data)
        
        for item_data in production_items_data:
            DailyProductionItem.objects.create(daily_entry=daily_entry, **item_data)
            
        return daily_entry

    def update(self, instance, validated_data):
        production_items_data = validated_data.pop('production_items', None)
        
        instance.entry_date = validated_data.get('entry_date', instance.entry_date)
        instance.total_sales = validated_data.get('total_sales', instance.total_sales)
        instance.total_outstanding = validated_data.get('total_outstanding', instance.total_outstanding)
        instance.save()
        
        if production_items_data is not None:
            # Drop old items and recreate (simpler and safer for daily reports)
            instance.production_items.all().delete()
            for item_data in production_items_data:
                DailyProductionItem.objects.create(daily_entry=instance, **item_data)
                
        return instance
 
        return instance     

class DistributorTopPickSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import DistributorTopPick
        model = DistributorTopPick
        fields = ['id', 'ledger', 'products', 'created_at', 'updated_at']

class DistributorTopPickListSerializer(serializers.ModelSerializer):
    ledger_name = serializers.CharField(source='ledger.name', read_only=True)
    product_names = serializers.SerializerMethodField()

    class Meta:
        from .models import DistributorTopPick
        model = DistributorTopPick
        fields = ['id', 'ledger', 'ledger_name', 'products', 'product_names', 'created_at', 'updated_at']

    def get_product_names(self, obj):
        return [product.name for product in obj.products.all()]
