from finance_app.models import VoucherType
from rest_framework import serializers
from .models import AccountGroup, Ledger, LedgerGst, LedgerContactDetail, LedgerBankDetail

class AccountGroupSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source='parent.name', read_only=True)

    class Meta:
        model = AccountGroup
        fields = '__all__'
        read_only_fields = ('created_by', 'edited_by', 'created_at', 'updated_at')

class LedgerGstSerializer(serializers.ModelSerializer):
    gst_percentage = serializers.DecimalField(max_digits=5, decimal_places=2, required=False, allow_null=True, default=0.00)

    class Meta:
        model = LedgerGst
        fields = '__all__'
        read_only_fields = ('ledger',)

    def to_internal_value(self, data):
        if isinstance(data, dict):
            val = data.get('gst_percentage')
            if val == '' or val is None:
                data = data.copy()
                data['gst_percentage'] = 0.00
        return super().to_internal_value(data)

class LedgerContactDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = LedgerContactDetail
        fields = '__all__'
        read_only_fields = ('ledger',)

class LedgerBankDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = LedgerBankDetail
        fields = '__all__'
        read_only_fields = ('ledger',)

class LedgerSerializer(serializers.ModelSerializer):
    account_group_name = serializers.CharField(source='accountGroup.name', read_only=True)
    gst_details = LedgerGstSerializer(many=True, required=False)
    contact_details = LedgerContactDetailSerializer(many=True, required=False)
    bank_details = LedgerBankDetailSerializer(many=True, required=False)

    class Meta:
        model = Ledger
        fields = '__all__'
        read_only_fields = ('created_by', 'edited_by', 'created_at', 'updated_at')

    def validate(self, data):
        import re
        errors = {}
        
        # Validate GST Number
        gst = data.get('gst_number')
        if gst:
            gst = gst.strip().upper()
            data['gst_number'] = gst
            pattern = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
            if not re.match(pattern, gst):
                errors['gst_number'] = 'Invalid GSTIN format. Must be 15 alphanumeric characters (e.g. 32ABCDE1234F1Z5).'

        # Validate PAN Number
        pan = data.get('pan_number')
        if pan:
            pan = pan.strip().upper()
            data['pan_number'] = pan
            pattern = r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$'
            if not re.match(pattern, pan):
                errors['pan_number'] = 'Invalid PAN format. Must be 10 characters (e.g. ABCDE1234F).'

        # Validate Pincode
        pincode = data.get('pincode')
        if pincode:
            pincode = pincode.strip()
            if not re.match(r'^[1-9][0-9]{5}$', pincode):
                errors['pincode'] = 'Invalid Pincode. Must be 6 digits.'

        # Validate Phone
        phone = data.get('phone')
        if phone:
            phone_clean = re.sub(r'[\s\-\(\)\+]', '', phone)
            if not re.match(r'^[0-9]{10,12}$', phone_clean):
                errors['phone'] = 'Invalid Phone number. Must be 10 to 12 digits.'

        if errors:
            raise serializers.ValidationError(errors)

        return data

    def create(self, validated_data):
        gst_data = validated_data.pop('gst_details', [])
        contact_data = validated_data.pop('contact_details', [])
        bank_data = validated_data.pop('bank_details', [])
        
        ledger = Ledger.objects.create(**validated_data)
        
        if gst_data:
            for gst in gst_data:
                gst_item = {
                    'place_of_supply': ledger.placeofsupply,
                    'gst_number': ledger.gst_number,
                    'registration_type': ledger.registration_type,
                    **gst
                }
                LedgerGst.objects.create(ledger=ledger, **gst_item)
        elif ledger.placeofsupply or ledger.gst_number or (ledger.registration_type and ledger.registration_type != 'unknown'):
            LedgerGst.objects.create(
                ledger=ledger,
                place_of_supply=ledger.placeofsupply,
                gst_number=ledger.gst_number,
                registration_type=ledger.registration_type
            )
        
        for contact in contact_data:
            LedgerContactDetail.objects.create(ledger=ledger, **contact)
        for bank in bank_data:
            LedgerBankDetail.objects.create(ledger=ledger, **bank)
            
        return ledger

    def update(self, instance, validated_data):
        gst_data = validated_data.pop('gst_details', None)
        contact_data = validated_data.pop('contact_details', None)
        bank_data = validated_data.pop('bank_details', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if gst_data is not None:
            instance.gst_details.all().delete()
            if gst_data:
                for gst in gst_data:
                    gst_item = {
                        'place_of_supply': instance.placeofsupply,
                        'gst_number': instance.gst_number,
                        'registration_type': instance.registration_type,
                        **gst
                    }
                    LedgerGst.objects.create(ledger=instance, **gst_item)
            elif instance.placeofsupply or instance.gst_number or (instance.registration_type and instance.registration_type != 'unknown'):
                LedgerGst.objects.create(
                    ledger=instance,
                    place_of_supply=instance.placeofsupply,
                    gst_number=instance.gst_number,
                    registration_type=instance.registration_type
                )
                
        if contact_data is not None:
            instance.contact_details.all().delete()
            for contact in contact_data:
                LedgerContactDetail.objects.create(ledger=instance, **contact)
                
        if bank_data is not None:
            instance.bank_details.all().delete()
            for bank in bank_data:
                LedgerBankDetail.objects.create(ledger=instance, **bank)
                
        return instance


class VoucherTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = VoucherType
        fields = ['id', 'name', 'code', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

from .models import ServiceInvoice, ServiceInvoiceDetail

class ServiceInvoiceDetailSerializer(serializers.ModelSerializer):
    service_ledger_name = serializers.CharField(source='service_ledger.name', read_only=True)
    
    class Meta:
        model = ServiceInvoiceDetail
        fields = '__all__'
        read_only_fields = ('invoice',)

class ServiceInvoiceSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    gst_ledger_1_name = serializers.CharField(source='gst_ledger_1.name', read_only=True)
    gst_ledger_2_name = serializers.CharField(source='gst_ledger_2.name', read_only=True)
    details = ServiceInvoiceDetailSerializer(many=True)

    class Meta:
        model = ServiceInvoice
        fields = '__all__'
        read_only_fields = ('created_by', 'edited_by', 'created_at', 'updated_at')

    def create(self, validated_data):
        details_data = validated_data.pop('details', [])
        invoice = ServiceInvoice.objects.create(**validated_data)
        for detail_data in details_data:
            ServiceInvoiceDetail.objects.create(invoice=invoice, **detail_data)
        return invoice

    def update(self, instance, validated_data):
        details_data = validated_data.pop('details', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if details_data is not None:
            instance.details.all().delete()
            for detail_data in details_data:
                ServiceInvoiceDetail.objects.create(invoice=instance, **detail_data)
                
        return instance


from .models import JournalVoucher, JournalVoucherDetail, BillAllocation

class BillAllocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillAllocation
        fields = '__all__'
        read_only_fields = ('payment_detail', 'receipt_detail', 'journal_detail')


class JournalVoucherDetailSerializer(serializers.ModelSerializer):
    ledger_name = serializers.CharField(source='ledger.name', read_only=True)
    bill_allocations = BillAllocationSerializer(many=True, required=False)

    class Meta:
        model = JournalVoucherDetail
        fields = '__all__'
        read_only_fields = ('voucher',)


class JournalVoucherSerializer(serializers.ModelSerializer):
    details = JournalVoucherDetailSerializer(many=True)

    class Meta:
        model = JournalVoucher
        fields = '__all__'
        read_only_fields = ('created_by', 'edited_by', 'created_at', 'updated_at')

    def create(self, validated_data):
        details_data = validated_data.pop('details', [])
        voucher = JournalVoucher.objects.create(**validated_data)
        for detail_data in details_data:
            bill_allocations_data = detail_data.pop('bill_allocations', [])
            detail = JournalVoucherDetail.objects.create(voucher=voucher, **detail_data)
            for alloc_data in bill_allocations_data:
                BillAllocation.objects.create(journal_detail=detail, **alloc_data)
        return voucher

    def update(self, instance, validated_data):
        details_data = validated_data.pop('details', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if details_data is not None:
            instance.details.all().delete()
            for detail_data in details_data:
                bill_allocations_data = detail_data.pop('bill_allocations', [])
                detail = JournalVoucherDetail.objects.create(voucher=instance, **detail_data)
                for alloc_data in bill_allocations_data:
                    BillAllocation.objects.create(journal_detail=detail, **alloc_data)
                
        return instance


from .models import ReceiptVoucher, ReceiptVoucherDetail, PaymentVoucher, PaymentVoucherDetail


class ReceiptVoucherDetailSerializer(serializers.ModelSerializer):
    ledger_name = serializers.CharField(source='ledger.name', read_only=True)
    bill_allocations = BillAllocationSerializer(many=True, required=False)

    class Meta:
        model = ReceiptVoucherDetail
        fields = '__all__'
        read_only_fields = ('voucher',)


class ReceiptVoucherSerializer(serializers.ModelSerializer):
    details = ReceiptVoucherDetailSerializer(many=True)

    class Meta:
        model = ReceiptVoucher
        fields = '__all__'
        read_only_fields = ('created_by', 'edited_by', 'created_at', 'updated_at')

    def create(self, validated_data):
        details_data = validated_data.pop('details', [])
        voucher = ReceiptVoucher.objects.create(**validated_data)
        for detail_data in details_data:
            bill_allocations_data = detail_data.pop('bill_allocations', [])
            detail = ReceiptVoucherDetail.objects.create(voucher=voucher, **detail_data)
            for alloc_data in bill_allocations_data:
                BillAllocation.objects.create(receipt_detail=detail, **alloc_data)
        return voucher

    def update(self, instance, validated_data):
        details_data = validated_data.pop('details', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if details_data is not None:
            instance.details.all().delete()
            for detail_data in details_data:
                bill_allocations_data = detail_data.pop('bill_allocations', [])
                detail = ReceiptVoucherDetail.objects.create(voucher=instance, **detail_data)
                for alloc_data in bill_allocations_data:
                    BillAllocation.objects.create(receipt_detail=detail, **alloc_data)
                
        return instance


class PaymentVoucherDetailSerializer(serializers.ModelSerializer):
    ledger_name = serializers.CharField(source='ledger.name', read_only=True)
    bill_allocations = BillAllocationSerializer(many=True, required=False)

    class Meta:
        model = PaymentVoucherDetail
        fields = '__all__'
        read_only_fields = ('voucher',)


class PaymentVoucherSerializer(serializers.ModelSerializer):
    details = PaymentVoucherDetailSerializer(many=True)

    class Meta:
        model = PaymentVoucher
        fields = '__all__'
        read_only_fields = ('created_by', 'edited_by', 'created_at', 'updated_at')

    def create(self, validated_data):
        details_data = validated_data.pop('details', [])
        voucher = PaymentVoucher.objects.create(**validated_data)
        for detail_data in details_data:
            bill_allocations_data = detail_data.pop('bill_allocations', [])
            detail = PaymentVoucherDetail.objects.create(voucher=voucher, **detail_data)
            for alloc_data in bill_allocations_data:
                BillAllocation.objects.create(payment_detail=detail, **alloc_data)
        return voucher

    def update(self, instance, validated_data):
        details_data = validated_data.pop('details', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if details_data is not None:
            instance.details.all().delete()
            for detail_data in details_data:
                bill_allocations_data = detail_data.pop('bill_allocations', [])
                detail = PaymentVoucherDetail.objects.create(voucher=instance, **detail_data)
                for alloc_data in bill_allocations_data:
                    BillAllocation.objects.create(payment_detail=detail, **alloc_data)
                
        return instance


from .models import ContraVoucher, ContraVoucherDetail

class ContraVoucherDetailSerializer(serializers.ModelSerializer):
    ledger_name = serializers.CharField(source='ledger.name', read_only=True)

    class Meta:
        model = ContraVoucherDetail
        fields = '__all__'
        read_only_fields = ('voucher',)


class ContraVoucherSerializer(serializers.ModelSerializer):
    details = ContraVoucherDetailSerializer(many=True)

    class Meta:
        model = ContraVoucher
        fields = '__all__'
        read_only_fields = ('created_by', 'edited_by', 'created_at', 'updated_at')

    def create(self, validated_data):
        details_data = validated_data.pop('details', [])
        voucher = ContraVoucher.objects.create(**validated_data)
        for detail_data in details_data:
            ContraVoucherDetail.objects.create(voucher=voucher, **detail_data)
        return voucher

    def update(self, instance, validated_data):
        details_data = validated_data.pop('details', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if details_data is not None:
            instance.details.all().delete()
            for detail_data in details_data:
                ContraVoucherDetail.objects.create(voucher=instance, **detail_data)
                
        return instance

from finance_app.models import VoucherType, StockJournalType, StockJournal, StockJournalDetails, ManufacturalJournalType, ManufacturalJournal, ManufacturalJournalDetails
from rest_framework import serializers
from .models import AccountGroup, Ledger, LedgerGst, LedgerContactDetail, LedgerBankDetail, Quotation, QuotationItem, QuotationTransaction, VoucherExtraCharge

class AccountGroupSerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source='parent.name', read_only=True)

    class Meta:
        model = AccountGroup
        fields = '__all__'
        read_only_fields = ('created_by', 'edited_by', 'created_at', 'updated_at')

class LedgerGstSerializer(serializers.ModelSerializer):
    class Meta:
        model = LedgerGst
        fields = '__all__'
        read_only_fields = ('ledger',)

class LedgerContactDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = LedgerContactDetail
        fields = '__all__'
        read_only_fields = ('ledger',)

class LedgerBankDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = LedgerBankDetail
        fields = '__all__'
        read_only_fields = ('ledger',)

class LedgerSerializer(serializers.ModelSerializer):
    account_group_name = serializers.CharField(source='accountGroup.name', read_only=True)
    gst_details = LedgerGstSerializer(many=True, required=False)
    contact_details = LedgerContactDetailSerializer(many=True, required=False)
    bank_details = LedgerBankDetailSerializer(many=True, required=False)

    class Meta:
        model = Ledger
        fields = '__all__'
        read_only_fields = ('created_by', 'edited_by', 'created_at', 'updated_at')

    def create(self, validated_data):
        gst_data = validated_data.pop('gst_details', [])
        contact_data = validated_data.pop('contact_details', [])
        bank_data = validated_data.pop('bank_details', [])
        
        ledger = Ledger.objects.create(**validated_data)
        
        if ledger.placeofsupply or ledger.gst_number or (ledger.registration_type and ledger.registration_type != 'unknown'):
            LedgerGst.objects.create(
                ledger=ledger,
                place_of_supply=ledger.placeofsupply,
                gst_number=ledger.gst_number,
                registration_type=ledger.registration_type
            )
        
        for gst in gst_data:
            LedgerGst.objects.create(ledger=ledger, **gst)
        for contact in contact_data:
            LedgerContactDetail.objects.create(ledger=ledger, **contact)
        for bank in bank_data:
            LedgerBankDetail.objects.create(ledger=ledger, **bank)
            
        return ledger

    def update(self, instance, validated_data):
        gst_data = validated_data.pop('gst_details', None)
        contact_data = validated_data.pop('contact_details', None)
        bank_data = validated_data.pop('bank_details', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if gst_data is not None:
            instance.gst_details.all().delete()
            
            if instance.placeofsupply or instance.gst_number or (instance.registration_type and instance.registration_type != 'unknown'):
                LedgerGst.objects.create(
                    ledger=instance,
                    place_of_supply=instance.placeofsupply,
                    gst_number=instance.gst_number,
                    registration_type=instance.registration_type
                )
                
            for gst in gst_data:
                LedgerGst.objects.create(ledger=instance, **gst)
                
        if contact_data is not None:
            instance.contact_details.all().delete()
            for contact in contact_data:
                LedgerContactDetail.objects.create(ledger=instance, **contact)
                
        if bank_data is not None:
            instance.bank_details.all().delete()
            for bank in bank_data:
                LedgerBankDetail.objects.create(ledger=instance, **bank)
                
        return instance


class VoucherTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = VoucherType
        fields = ['id', 'name', 'code', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

class VoucherExtraChargeSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = VoucherExtraCharge
        fields = ['id', 'ledger', 'amount']

class QuotationItemSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)  # Allow id field for updating nested items
    product_name = serializers.SerializerMethodField()
    warehouse_name = serializers.SerializerMethodField()
    per_name = serializers.SerializerMethodField()

    class Meta:
        model = QuotationItem
        fields = [
            'id', 'quotation', 'product', 'product_name', 'warehouse', 'warehouse_name',
            'quantity', 'rate', 'discount_percent', 'discount_amount', 'gst_percent',
            'gst_amount', 'cgst_amount', 'sgst_amount', 'igst_amount', 'amount',
            'per', 'per_name',
            'batch_number', 'manufacture_date', 'expiry_date', 'hsn'
        ]
        read_only_fields = ['quotation', 'hsn']

    def get_product_name(self, obj):
        return obj.product.name if obj.product else None

    def get_warehouse_name(self, obj):
        return obj.warehouse.name if obj.warehouse else None

    def get_per_name(self, obj):
        return obj.per.name if obj.per else None


class QuotationSerializer(serializers.ModelSerializer):
    quotation_no = serializers.CharField(required=False, allow_blank=True)
    items = QuotationItemSerializer(many=True, required=False)
    extra_charges = VoucherExtraChargeSerializer(many=True, required=False)
    created_by_name = serializers.SerializerMethodField()
    edited_by_name = serializers.SerializerMethodField()
    customer_ledger_name = serializers.SerializerMethodField()
    order_type_name = serializers.SerializerMethodField()

    class Meta:
        model = Quotation
        fields = [
            'id', 'order_type', 'order_type_name', 'quotation_no', 'entry_date', 'customer_ledger', 'customer_ledger_name',
            'gst_ledger_1', 'gst_amount_1', 'gst_ledger_2', 'gst_amount_2',
            'total_amount', 'narration', 'is_posted', 'other_reference',
            'terms_of_delivery', 'dispatch_through', 'document_no', 'document_date',
            'created_at', 'created_by', 'created_by_name', 'edited_by', 'edited_by_name', 'updated_at',
            'items', 'extra_charges'
        ]
        read_only_fields = ['created_by', 'edited_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else None

    def get_edited_by_name(self, obj):
        return obj.edited_by.get_full_name() if obj.edited_by else None

    def get_customer_ledger_name(self, obj):
        return obj.customer_ledger.name if obj.customer_ledger else None

    def get_order_type_name(self, obj):
        if obj.order_type and obj.order_type.isdigit():
            from settings_app.models import PrefixConfiguration
            try:
                prefix = PrefixConfiguration.objects.get(id=int(obj.order_type))
                sub_name = prefix.subvoucher_type.type_name if prefix.subvoucher_type else None
                v_name = prefix.voucher_type.name if prefix.voucher_type else None
                return prefix.sub_type or sub_name or v_name or 'Quotation'
            except PrefixConfiguration.DoesNotExist:
                return obj.order_type
        return obj.order_type

    def validate(self, attrs):
        is_update = self.instance is not None
        is_partial = self.partial
        errors = {}

        if 'customer_ledger' in attrs:
            if attrs['customer_ledger'] is None:
                errors['customer_ledger'] = "Customer is required."
        elif not is_update:
            errors['customer_ledger'] = "Customer is required."

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
        extra_charges_data = validated_data.pop('extra_charges', [])
        quotation_no = validated_data.get('quotation_no', '')
        
        if not quotation_no or quotation_no.upper() == 'AUTO':
            # Generate next quotation_no
            last_quotation = Quotation.objects.filter(quotation_no__startswith='QT-').order_by('-id').first()
            if last_quotation:
                try:
                    last_num = int(last_quotation.quotation_no.split('-')[1])
                    next_num = last_num + 1
                except (ValueError, IndexError):
                    next_num = Quotation.objects.filter(quotation_no__startswith='QT-').count() + 1
            else:
                next_num = 1
            validated_data['quotation_no'] = f"QT-{next_num:04d}"
        elif 'quotation_no' in validated_data and not validated_data['quotation_no']:
            validated_data.pop('quotation_no')
            
        quotation = Quotation.objects.create(**validated_data)
        
        for item_data in items_data:
            QuotationItem.objects.create(quotation=quotation, **item_data)
            
        for ec_data in extra_charges_data:
            quotation.extra_charges.create(**ec_data)
            
        return quotation

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        extra_charges_data = validated_data.pop('extra_charges', None)
        user = self.context['request'].user if 'request' in self.context else None
        if 'quotation_no' in validated_data and not validated_data['quotation_no']:
            validated_data.pop('quotation_no')
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.edited_by = user
        instance.save()

        if items_data is not None:
            existing_items = {item.id: item for item in instance.items.all()}
            keep_item_ids = []
            
            for item_data in items_data:
                item_id = item_data.get('id', None)
                if item_id and item_id in existing_items:
                    item_instance = existing_items[item_id]
                    for attr, value in item_data.items():
                        if attr != 'id':
                            setattr(item_instance, attr, value)
                    item_instance.save()
                    keep_item_ids.append(item_id)
                else:
                    new_item = QuotationItem.objects.create(quotation=instance, **item_data)
                    keep_item_ids.append(new_item.id)
            
            for item_id, item_instance in existing_items.items():
                if item_id not in keep_item_ids:
                    item_instance.delete()
                    
        if extra_charges_data is not None:
            existing_ec = {ec.id: ec for ec in instance.extra_charges.all()}
            keep_ec_ids = []
            
            for ec_data in extra_charges_data:
                ec_id = ec_data.get('id', None)
                if ec_id and ec_id in existing_ec:
                    ec_instance = existing_ec[ec_id]
                    for attr, value in ec_data.items():
                        if attr != 'id':
                            setattr(ec_instance, attr, value)
                    ec_instance.save()
                    keep_ec_ids.append(ec_id)
                else:
                    new_ec = instance.extra_charges.create(**ec_data)
                    keep_ec_ids.append(new_ec.id)
            
            for ec_id, ec_instance in existing_ec.items():
                if ec_id not in keep_ec_ids:
                    ec_instance.delete()

        return instance

class QuotationTransactionSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()
    quotation_no = serializers.SerializerMethodField()

    class Meta:
        model = QuotationTransaction
        fields = [
            'id', 'quotation', 'quotation_no', 'product', 'product_name', 'transaction_date',
            'quantity_ordered', 'quantity_remaining', 'created_at'
        ]

    def get_product_name(self, obj):
        return obj.product.name if obj.product else None

    def get_quotation_no(self, obj):
        return obj.quotation.quotation_no if obj.quotation else None

class StockJournalTypeSerializer(serializers.ModelSerializer):
    movement_type_display = serializers.CharField(
        source='get_movement_type_display', read_only=True
    )

    class Meta:
        model = StockJournalType
        fields = [
            'id',
            'stock_journal_type',
            'movement_type',
            'movement_type_display',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


# ─────────────────────────────────────────────────────────────────────────────
# Stock Journal Serializers
# ─────────────────────────────────────────────────────────────────────────────

class StockJournalDetailsSerializer(serializers.ModelSerializer):
    stock_item_name = serializers.CharField(source='stock_item.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True, default=None)

    class Meta:
        model = StockJournalDetails
        fields = [
            'id',
            'stock_item', 'stock_item_name',
            'quantity', 'rate', 'amount',
            'warehouse', 'warehouse_name',
            'batch_number', 'expiry_date', 'manufacture_date',
            'entry_type',
        ]


class StockJournalSerializer(serializers.ModelSerializer):
    details = StockJournalDetailsSerializer(many=True, required=False)
    journal_no = serializers.CharField(required=False, allow_blank=True)

    # Read-only display helpers
    journal_no_display = serializers.SerializerMethodField()
    stock_journal_type_name = serializers.CharField(
        source='stock_journal_type.stock_journal_type', read_only=True
    )
    movement_type = serializers.CharField(
        source='stock_journal_type.movement_type', read_only=True
    )
    prefix_label = serializers.SerializerMethodField()

    class Meta:
        model = StockJournal
        fields = [
            'id',
            'journal_no', 'journal_no_display', 'prefix_label',
            'journal_date',
            'stock_journal_type', 'stock_journal_type_name', 'movement_type',
            'narration',
            'details',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_journal_no_display(self, obj):
        """
        Returns the formatted journal number string, e.g. SJ-0001.
        """
        return obj.journal_no or ''

    def get_prefix_label(self, obj):
        """Returns a human-readable label for the prefix configuration."""
        if not obj.journal_no:
            return ''
        from settings_app.models import PrefixConfiguration
        # Find configurations for Stock Journal
        sub_type_str = obj.stock_journal_type.stock_journal_type if obj.stock_journal_type else None
        configs = PrefixConfiguration.objects.filter(voucher_type__name__icontains='stock journal')
        if sub_type_str:
            configs = configs.filter(sub_type=sub_type_str)
        
        matched_config = None
        for config in configs:
            if obj.journal_no.startswith(config.prefix):
                matched_config = config
                break
        
        if not matched_config:
            # Fallback to any stock journal config that matches by prefix prefix
            configs_all = PrefixConfiguration.objects.filter(voucher_type__name__icontains='stock journal')
            for config in configs_all:
                if obj.journal_no.startswith(config.prefix):
                    matched_config = config
                    break
        
        if not matched_config:
            matched_config = PrefixConfiguration.objects.filter(voucher_type__name__icontains='stock journal').first()
        
        if not matched_config:
            return ''
        
        config = matched_config
        postfix = config.postfix or ''
        type_name = config.voucher_type.name if config.voucher_type else ''
        sub_part = f" ({config.sub_type})" if config.sub_type else ""
        sample = f"{config.prefix}{'1'.zfill(config.number_padding)}{postfix}"
        return f"{type_name}{sub_part} — {sample}"

    def _sync_stock_tables(self, journal, details_instances):
        """
        For each detail line, create/update corresponding StockTable and
        StockTableDuplicate entries with transaction_type='STOCK_JOURNAL'.
        Old entries for this journal are deleted first.
        """
        from inventory_app.models import StockTable, StockTableDuplicate

        # Remove previous stock table entries for this journal
        StockTable.objects.filter(
            transaction_type='STOCK_JOURNAL',
            reference_id=journal.id
        ).delete()
        StockTableDuplicate.objects.filter(
            transaction_type='STOCK_JOURNAL',
            reference_id=journal.id
        ).delete()

        movement_type = journal.stock_journal_type.movement_type  # 'IN', 'OUT', or 'IN & OUT'
        journal_date = journal.journal_date

        for detail in details_instances:
            # Map the entry's movement type to StockTable using the row's explicit entry_type
            # ('OUT' for Consumption, 'IN' for Production) so stock is updated correctly.
            detail_movement_type = detail.entry_type

            common = dict(
                item=detail.stock_item,
                movement_type=detail_movement_type,
                transaction_type='STOCK_JOURNAL',
                reference_id=journal.id,
                quantity=detail.quantity,
                rate=detail.rate,
                batch_number=detail.batch_number or '',
                manufacture_date=detail.manufacture_date,
                expiry_date=detail.expiry_date,
                warehouse=detail.warehouse,
                date=journal_date,
                is_active=True,
            )
            StockTable.objects.create(**common)
            StockTableDuplicate.objects.create(**common)

    def _get_next_number(self, config):
        """
        Returns the next sequential journal number based on the MAX existing
        journal number for the given prefix config, so that deleting a journal
        never causes a number to be reused.
        """
        from .models import StockJournal
        prefix = config.prefix or ''
        postfix = config.postfix or ''
        # Fetch all existing journal_no values that match this prefix
        existing_qs = StockJournal.objects.filter(
            journal_no__startswith=prefix
        )
        if config.sub_type:
            existing_qs = existing_qs.filter(
                stock_journal_type__stock_journal_type=config.sub_type
            )
        existing = existing_qs.values_list('journal_no', flat=True)
        max_num = config.starting_number - 1
        for jno in existing:
            # Strip prefix and postfix, then try to parse the numeric part
            stripped = jno[len(prefix):]
            if postfix and stripped.endswith(postfix):
                stripped = stripped[:-len(postfix)]
            try:
                num = int(stripped)
                if num > max_num:
                    max_num = num
            except (ValueError, TypeError):
                pass
        next_num = max_num + 1
        padded = str(next_num).zfill(config.number_padding)
        return f"{prefix}{padded}{postfix}"

    def create(self, validated_data):
        from .models import StockJournalDetails, StockJournal
        from settings_app.models import PrefixConfiguration
        
        journal_no_val = validated_data.get('journal_no', '')
        if journal_no_val and (isinstance(journal_no_val, int) or str(journal_no_val).isdigit()):
            try:
                config = PrefixConfiguration.objects.get(pk=int(journal_no_val))
                validated_data['journal_no'] = self._get_next_number(config)
            except PrefixConfiguration.DoesNotExist:
                raise serializers.ValidationError({'journal_no': 'PrefixConfiguration not found'})
        elif not journal_no_val:
            # Resolve next number dynamically using the stock journal type
            stock_journal_type = validated_data.get('stock_journal_type')
            sub_type_str = stock_journal_type.stock_journal_type if stock_journal_type else None
            config = None
            if sub_type_str:
                config = PrefixConfiguration.objects.filter(
                    voucher_type__name__icontains='stock journal',
                    sub_type=sub_type_str
                ).first()
            if not config:
                config = PrefixConfiguration.objects.filter(voucher_type__name__icontains='stock journal').first()
            if config:
                validated_data['journal_no'] = self._get_next_number(config)
            else:
                raise serializers.ValidationError({'journal_no': 'Journal number is required'})
        
        details_data = validated_data.pop('details', [])
        journal = super().create(validated_data)
        detail_instances = []
        for detail in details_data:
            d = StockJournalDetails.objects.create(stock_journal=journal, **detail)
            detail_instances.append(d)
        self._sync_stock_tables(journal, detail_instances)
        return journal

    def update(self, instance, validated_data):
        journal_no_val = validated_data.get('journal_no', '')
        if not journal_no_val or str(journal_no_val).isdigit() or str(journal_no_val) == 'NaN':
            validated_data['journal_no'] = instance.journal_no
        
        from .models import StockJournalDetails
        details_data = validated_data.pop('details', None)
        journal = super().update(instance, validated_data)
        if details_data is not None:
            journal.details.all().delete()
            detail_instances = []
            for detail in details_data:
                d = StockJournalDetails.objects.create(stock_journal=journal, **detail)
                detail_instances.append(d)
            self._sync_stock_tables(journal, detail_instances)
        return journal


class PrefixConfigurationForJournalSerializer(serializers.Serializer):
    """
    Lightweight read-only serializer for PrefixConfiguration records used in
    the Stock Journal prefix dropdown.
    """
    id = serializers.IntegerField()
    prefix = serializers.CharField()
    number_padding = serializers.IntegerField()
    starting_number = serializers.IntegerField()
    postfix = serializers.CharField(allow_null=True)
    sub_type = serializers.CharField(allow_null=True, required=False)
    prefix_type_name = serializers.SerializerMethodField()
    display_label = serializers.SerializerMethodField()
    next_number_preview = serializers.SerializerMethodField()

    def get_prefix_type_name(self, obj):
        return obj.voucher_type.name if obj.voucher_type else ''

    def get_display_label(self, obj):
        postfix = obj.postfix or ''
        return f"{obj.prefix}{'X' * obj.number_padding}{postfix}"

    def get_next_number_preview(self, obj):
        """Returns the next journal number if this config is selected."""
        from .models import StockJournal
        prefix = obj.prefix or ''
        postfix = obj.postfix or ''
        existing = StockJournal.objects.filter(
            journal_no__startswith=prefix
        ).values_list('journal_no', flat=True)
        max_num = obj.starting_number - 1
        for jno in existing:
            stripped = jno[len(prefix):]
            if postfix and stripped.endswith(postfix):
                stripped = stripped[:-len(postfix)]
            try:
                num = int(stripped)
                if num > max_num:
                    max_num = num
            except (ValueError, TypeError):
                pass
        next_num = max_num + 1
        padded = str(next_num).zfill(obj.number_padding)
        return f"{prefix}{padded}{postfix}"


class ManufacturalJournalTypeSerializer(serializers.ModelSerializer):
    movement_type_display = serializers.CharField(
        source='get_movement_type_display', read_only=True
    )

    class Meta:
        model = ManufacturalJournalType
        fields = [
            'id',
            'manufactural_journal_type',
            'movement_type',
            'movement_type_display',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class ManufacturalJournalDetailsSerializer(serializers.ModelSerializer):
    stock_item_name = serializers.CharField(source='stock_item.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True, default=None)

    class Meta:
        model = ManufacturalJournalDetails
        fields = [
            'id',
            'stock_item', 'stock_item_name',
            'quantity', 'rate', 'amount',
            'warehouse', 'warehouse_name',
            'batch_number', 'expiry_date', 'manufacture_date',
            'entry_type',
        ]


class ManufacturalJournalSerializer(serializers.ModelSerializer):
    details = ManufacturalJournalDetailsSerializer(many=True, required=False)
    journal_no = serializers.CharField(required=False, allow_blank=True)
    expiry_after = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    journal_no_display = serializers.SerializerMethodField()
    manufactural_journal_type_name = serializers.CharField(
        source='manufactural_journal_type.manufactural_journal_type', read_only=True
    )
    movement_type = serializers.CharField(
        source='manufactural_journal_type.movement_type', read_only=True
    )
    prefix_label = serializers.SerializerMethodField()

    class Meta:
        model = ManufacturalJournal
        fields = [
            'id',
            'journal_no', 'journal_no_display', 'prefix_label',
            'journal_date',
            'manufactural_journal_type', 'manufactural_journal_type_name', 'movement_type',
            'narration',
            'batch_number',
            'expiry_after',
            'expiry_date',
            'rnd_entry',
            'details',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_journal_no_display(self, obj):
        return obj.journal_no or ''

    def get_prefix_label(self, obj):
        if not obj.journal_no:
            return ''
        from settings_app.models import PrefixConfiguration
        sub_type_str = obj.manufactural_journal_type.manufactural_journal_type if obj.manufactural_journal_type else None
        configs = PrefixConfiguration.objects.filter(voucher_type__name__icontains='manufactural journal')
        if sub_type_str:
            configs = configs.filter(sub_type=sub_type_str)
        
        matched_config = None
        for config in configs:
            if obj.journal_no.startswith(config.prefix):
                matched_config = config
                break
        
        if not matched_config:
            configs_all = PrefixConfiguration.objects.filter(voucher_type__name__icontains='manufactural journal')
            for config in configs_all:
                if obj.journal_no.startswith(config.prefix):
                    matched_config = config
                    break
        
        if not matched_config:
            matched_config = PrefixConfiguration.objects.filter(voucher_type__name__icontains='manufactural journal').first()
        
        if not matched_config:
            return ''
        
        config = matched_config
        postfix = config.postfix or ''
        type_name = config.voucher_type.name if config.voucher_type else ''
        sub_part = f" ({config.sub_type})" if config.sub_type else ""
        sample = f"{config.prefix}{'1'.zfill(config.number_padding)}{postfix}"
        return f"{type_name}{sub_part} — {sample}"

    def _sync_stock_tables(self, journal, details_instances):
        from inventory_app.models import StockTable, StockTableDuplicate

        # Remove previous stock table entries for this journal
        StockTable.objects.filter(
            transaction_type='MANUFACTURING_JOURNAL',
            reference_id=journal.id
        ).delete()
        StockTableDuplicate.objects.filter(
            transaction_type='MANUFACTURING_JOURNAL',
            reference_id=journal.id
        ).delete()

        movement_type = journal.manufactural_journal_type.movement_type
        journal_date = journal.journal_date

        from settings_app.models import Warehouse
        from django.db.models import Sum
        from decimal import Decimal

        for detail in details_instances:
            # Respect the row's explicit entry_type ('OUT' for Consumption, 'IN' for Production)
            # so the finished product and raw materials update stock correctly.
            detail_movement_type = detail.entry_type

            if detail.warehouse:
                common = dict(
                    item=detail.stock_item,
                    movement_type=detail_movement_type,
                    transaction_type='MANUFACTURING_JOURNAL',
                    reference_id=journal.id,
                    quantity=detail.quantity,
                    rate=detail.rate,
                    batch_number=detail.batch_number or (journal.batch_number if detail_movement_type == 'IN' else '') or '',
                    manufacture_date=detail.manufacture_date,
                    expiry_date=detail.expiry_date or (journal.expiry_date if detail_movement_type == 'IN' else None),
                    warehouse=detail.warehouse,
                    date=journal_date,
                    is_active=True,
                )
                StockTable.objects.create(**common)
                StockTableDuplicate.objects.create(**common)
            else:
                if detail_movement_type == 'OUT':
                    active_warehouses = Warehouse.objects.filter(is_active=True)
                    warehouse_stocks = []
                    for wh in active_warehouses:
                        in_qty = StockTableDuplicate.objects.filter(
                            item=detail.stock_item,
                            warehouse=wh,
                            movement_type='IN',
                            is_active=True
                        ).aggregate(total=Sum('quantity'))['total'] or Decimal('0.0')
                        out_qty = StockTableDuplicate.objects.filter(
                            item=detail.stock_item,
                            warehouse=wh,
                            movement_type='OUT',
                            is_active=True
                        ).aggregate(total=Sum('quantity'))['total'] or Decimal('0.0')
                        avail = in_qty - out_qty
                        if avail > Decimal('0.0'):
                            warehouse_stocks.append((wh, avail))
                    
                    warehouse_stocks.sort(key=lambda x: x[1], reverse=True)
                    qty_to_deduct = detail.quantity
                    
                    for wh, avail in warehouse_stocks:
                        if qty_to_deduct <= Decimal('0.0'):
                            break
                        deducted_qty = min(qty_to_deduct, avail)
                        
                        common = dict(
                            item=detail.stock_item,
                            movement_type='OUT',
                            transaction_type='MANUFACTURING_JOURNAL',
                            reference_id=journal.id,
                            quantity=deducted_qty,
                            rate=detail.rate,
                            batch_number=detail.batch_number or '',
                            manufacture_date=detail.manufacture_date,
                            expiry_date=detail.expiry_date,
                            warehouse=wh,
                            date=journal_date,
                            is_active=True,
                        )
                        StockTable.objects.create(**common)
                        StockTableDuplicate.objects.create(**common)
                        
                        qty_to_deduct -= deducted_qty
                    
                    if qty_to_deduct > Decimal('0.0'):
                        default_wh = Warehouse.objects.filter(is_active=True, is_default=True).first()
                        if not default_wh:
                            default_wh = Warehouse.objects.filter(is_active=True).first()
                        if default_wh:
                            common = dict(
                                item=detail.stock_item,
                                movement_type='OUT',
                                transaction_type='MANUFACTURING_JOURNAL',
                                reference_id=journal.id,
                                quantity=qty_to_deduct,
                                rate=detail.rate,
                                batch_number=detail.batch_number or '',
                                manufacture_date=detail.manufacture_date,
                                expiry_date=detail.expiry_date,
                                warehouse=default_wh,
                                date=journal_date,
                                is_active=True,
                            )
                            StockTable.objects.create(**common)
                            StockTableDuplicate.objects.create(**common)
                else:
                    default_wh = Warehouse.objects.filter(is_active=True, is_default=True).first()
                    if not default_wh:
                        default_wh = Warehouse.objects.filter(is_active=True).first()
                    
                    if default_wh:
                        common = dict(
                            item=detail.stock_item,
                            movement_type='IN',
                            transaction_type='MANUFACTURING_JOURNAL',
                            reference_id=journal.id,
                            quantity=detail.quantity,
                            rate=detail.rate,
                            batch_number=detail.batch_number or journal.batch_number or '',
                            manufacture_date=detail.manufacture_date,
                            expiry_date=detail.expiry_date or journal.expiry_date or None,
                            warehouse=default_wh,
                            date=journal_date,
                            is_active=True,
                        )
                        StockTable.objects.create(**common)
                        StockTableDuplicate.objects.create(**common)

    def _get_next_number(self, config):
        from .models import ManufacturalJournal
        branch_code = config.branch.branch_code if (config.branch and getattr(config.branch, 'branch_code', None)) else ''
        prefix = config.prefix or 'MFJ'
        padding = config.number_padding or 4
        postfix = config.postfix or ''

        prefix_part = f"{branch_code}-" if branch_code else ""
        prefix_part += prefix
        if not prefix_part.endswith('-'):
            prefix_part += '-'

        postfix_part = f"/{postfix}" if (postfix and not postfix.startswith('/')) else postfix

        existing_qs = ManufacturalJournal.objects.filter(
            journal_no__startswith=prefix
        )
        existing = existing_qs.values_list('journal_no', flat=True)
        max_num = config.starting_number - 1
        for jno in existing:
            if not jno:
                continue
            curr = str(jno)
            if branch_code and curr.startswith(f"{branch_code}-"):
                curr = curr[len(f"{branch_code}-"):]
            if curr.startswith(prefix):
                curr = curr[len(prefix):]
            if curr.startswith('-'):
                curr = curr[1:]
            if postfix_part and curr.endswith(postfix_part):
                curr = curr[:-len(postfix_part)]
            elif postfix and curr.endswith(postfix):
                curr = curr[:-len(postfix)]
            if curr.endswith('/'):
                curr = curr[:-1]
            try:
                num = int(curr)
                if num > max_num:
                    max_num = num
            except (ValueError, TypeError):
                pass
        next_num = max_num + 1
        padded = str(next_num).zfill(padding)
        return f"{prefix_part}{padded}{postfix_part}"

    def create(self, validated_data):
        from .models import ManufacturalJournalDetails, ManufacturalJournal
        from settings_app.models import PrefixConfiguration
        
        journal_no_val = validated_data.get('journal_no', '')
        if journal_no_val and str(journal_no_val).isdigit():
            try:
                config = PrefixConfiguration.objects.get(pk=int(journal_no_val))
                validated_data['journal_no'] = self._get_next_number(config)
            except PrefixConfiguration.DoesNotExist:
                raise serializers.ValidationError({'journal_no': 'PrefixConfiguration not found'})
        elif isinstance(journal_no_val, str) and '-' in journal_no_val and not str(journal_no_val).isdigit() and journal_no_val != 'NaN':
            # Formatted sequence string already passed
            validated_data['journal_no'] = journal_no_val
        else:
            manufactural_journal_type = validated_data.get('manufactural_journal_type')
            sub_type_str = manufactural_journal_type.manufactural_journal_type if manufactural_journal_type else None
            config = None
            if sub_type_str:
                config = PrefixConfiguration.objects.filter(
                    voucher_type__name__icontains='manufactural journal',
                    sub_type=sub_type_str
                ).first()
            if not config:
                config = PrefixConfiguration.objects.filter(voucher_type__name__icontains='manufactural journal').first()
            if not config:
                config = PrefixConfiguration.objects.filter(voucher_type__name__icontains='manufactur').first()
            if config:
                validated_data['journal_no'] = self._get_next_number(config)
            else:
                validated_data['journal_no'] = 'MFJ-0001/2026'

        if not validated_data.get('batch_number'):
            j_date = validated_data.get('journal_date')
            if j_date:
                validated_data['batch_number'] = j_date.strftime('%Y%m%d') if hasattr(j_date, 'strftime') else str(j_date).replace('-', '')

        exp_after = validated_data.pop('expiry_after', None)
        if exp_after is None and hasattr(self, 'initial_data'):
            exp_after = self.initial_data.get('expiry_after')
        if not validated_data.get('expiry_date') and exp_after is not None:
            try:
                days = int(exp_after)
                j_date = validated_data.get('journal_date')
                if j_date:
                    from datetime import timedelta
                    validated_data['expiry_date'] = j_date + timedelta(days=days)
            except (ValueError, TypeError):
                pass
        
        details_data = validated_data.pop('details', [])
        journal = super().create(validated_data)
        detail_instances = []
        for detail in details_data:
            if detail.get('entry_type') == 'IN':
                if not detail.get('batch_number') and journal.batch_number:
                    detail['batch_number'] = journal.batch_number
                if not detail.get('expiry_date') and journal.expiry_date:
                    detail['expiry_date'] = journal.expiry_date
            d = ManufacturalJournalDetails.objects.create(manufactural_journal=journal, **detail)
            detail_instances.append(d)
        self._sync_stock_tables(journal, detail_instances)
        return journal

    def update(self, instance, validated_data):
        journal_no_val = validated_data.get('journal_no', '')
        if not journal_no_val or str(journal_no_val).isdigit() or str(journal_no_val) == 'NaN':
            validated_data['journal_no'] = instance.journal_no
        
        if not validated_data.get('batch_number') and not instance.batch_number:
            j_date = validated_data.get('journal_date') or instance.journal_date
            if j_date:
                validated_data['batch_number'] = j_date.strftime('%Y%m%d') if hasattr(j_date, 'strftime') else str(j_date).replace('-', '')

        exp_after = validated_data.pop('expiry_after', None)
        if exp_after is None and hasattr(self, 'initial_data'):
            exp_after = self.initial_data.get('expiry_after')
        if not validated_data.get('expiry_date') and exp_after is not None:
            try:
                days = int(exp_after)
                j_date = validated_data.get('journal_date') or instance.journal_date
                if j_date:
                    from datetime import timedelta
                    validated_data['expiry_date'] = j_date + timedelta(days=days)
            except (ValueError, TypeError):
                pass

        from .models import ManufacturalJournalDetails
        details_data = validated_data.pop('details', None)
        journal = super().update(instance, validated_data)
        if details_data is not None:
            journal.details.all().delete()
            detail_instances = []
            for detail in details_data:
                if detail.get('entry_type') == 'IN':
                    if not detail.get('batch_number') and journal.batch_number:
                        detail['batch_number'] = journal.batch_number
                    if not detail.get('expiry_date') and journal.expiry_date:
                        detail['expiry_date'] = journal.expiry_date
                d = ManufacturalJournalDetails.objects.create(manufactural_journal=journal, **detail)
                detail_instances.append(d)
            self._sync_stock_tables(journal, detail_instances)
        return journal


class PrefixConfigurationForManufacturalJournalSerializer(serializers.ModelSerializer):
    prefix_type_name = serializers.SerializerMethodField()
    display_label = serializers.SerializerMethodField()
    next_number_preview = serializers.SerializerMethodField()

    class Meta:
        from settings_app.models import PrefixConfiguration
        model = PrefixConfiguration
        fields = '__all__'

    def get_prefix_type_name(self, obj):
        if obj.voucher_type:
            return obj.voucher_type.name
        if hasattr(obj, 'subvoucher_type') and obj.subvoucher_type:
            return obj.subvoucher_type.type_name
        return ''

    def get_display_label(self, obj):
        branch_code = obj.branch.branch_code if (obj.branch and getattr(obj.branch, 'branch_code', None)) else ''
        prefix = obj.prefix or 'MFJ'
        padding = obj.number_padding or 4
        postfix = obj.postfix or ''
        prefix_part = f"{branch_code}-" if branch_code else ""
        prefix_part += prefix
        if not prefix_part.endswith('-'):
            prefix_part += '-'
        postfix_part = f"/{postfix}" if (postfix and not postfix.startswith('/')) else postfix
        return f"{prefix_part}{'X' * padding}{postfix_part}"

    def get_next_number_preview(self, obj):
        from .models import ManufacturalJournal
        branch_code = obj.branch.branch_code if (obj.branch and getattr(obj.branch, 'branch_code', None)) else ''
        prefix = obj.prefix or 'MFJ'
        padding = obj.number_padding or 4
        postfix = obj.postfix or ''

        prefix_part = f"{branch_code}-" if branch_code else ""
        prefix_part += prefix
        if not prefix_part.endswith('-'):
            prefix_part += '-'

        postfix_part = f"/{postfix}" if (postfix and not postfix.startswith('/')) else postfix

        existing = ManufacturalJournal.objects.filter(
            journal_no__startswith=prefix
        ).values_list('journal_no', flat=True)
        max_num = obj.starting_number - 1
        for jno in existing:
            if not jno:
                continue
            curr = str(jno)
            if branch_code and curr.startswith(f"{branch_code}-"):
                curr = curr[len(f"{branch_code}-"):]
            if curr.startswith(prefix):
                curr = curr[len(prefix):]
            if curr.startswith('-'):
                curr = curr[1:]
            if postfix_part and curr.endswith(postfix_part):
                curr = curr[:-len(postfix_part)]
            elif postfix and curr.endswith(postfix):
                curr = curr[:-len(postfix)]
            if curr.endswith('/'):
                curr = curr[:-1]
            try:
                num = int(curr)
                if num > max_num:
                    max_num = num
            except (ValueError, TypeError):
                pass
        next_num = max_num + 1
        padded = str(next_num).zfill(padding)
        return f"{prefix_part}{padded}{postfix_part}"

