from rest_framework import serializers
from inventory_app.models import (
    PriceList,
    PriceListItem,
    StockItem,
    StockGroup,
    StockDefinition,
    ProductConfiguration,
    LedgerPriceListMapping,
    Unit,
    StockGroupHSN,
    StockGroupGST,
    StockCategory,
    StockCategoryHSN,
    StockCategoryGST,
    StockItemHSN,
    StockItemGST,
    StockTable,
    StockTableDuplicate,
    BillOfEntry,
    RecipeDetails,
    WarehouseTransfer,
    WarehouseTransferItem,
    WarehouseTransferItemSplit,
)


class PriceListItemSerializer(serializers.ModelSerializer):
    stock_item_name = serializers.CharField(source='stock_item.name', read_only=True)

    class Meta:
        model = PriceListItem
        fields = ['id', 'stock_item', 'stock_item_name', 'actual_price', 'rate']


class PriceListSerializer(serializers.ModelSerializer):
    items = PriceListItemSerializer(many=True, required=False)

    class Meta:
        model = PriceList
        fields = ['id', 'name', 'applicable_date', 'created_at', 'updated_at', 'items']

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        price_list = PriceList.objects.create(**validated_data)
        for item_data in items_data:
            PriceListItem.objects.create(price_list=price_list, **item_data)
        return price_list

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        instance.name = validated_data.get('name', instance.name)
        instance.applicable_date = validated_data.get('applicable_date', instance.applicable_date)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                PriceListItem.objects.create(price_list=instance, **item_data)
        return instance


class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = ['id', 'name', 'uqc_code', 'decimal_places']


class StockGroupHSNSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockGroupHSN
        fields = ['id', 'hsn_number', 'applicable_date']


class StockGroupGSTSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockGroupGST
        fields = [
            'id', 'tax_gst_type', 'igst_percent', 'cgst_percent',
            'sgst_percent', 'cess_percent', 'applicable_date'
        ]


class StockGroupSerializer(serializers.ModelSerializer):
    hsn_codes = StockGroupHSNSerializer(many=True, required=False)
    gst_rates = StockGroupGSTSerializer(many=True, required=False)
    parent_group_name = serializers.ReadOnlyField(source='parent_group.name')
    include_in_definition = serializers.BooleanField(required=False, default=False)
    is_parent_group = serializers.BooleanField(required=False, default=False)

    class Meta:
        model = StockGroup
        fields = ['id', 'name', 'parent_group', 'parent_group_name', 'hsn_codes', 'gst_rates', 'company', 'branch', 'factory', 'include_in_definition', 'is_parent_group']
        extra_kwargs = {
            'company': {'read_only': True},
            'branch': {'read_only': True},
            'factory': {'read_only': True},
        }

    def get_is_fixed(self, obj):
        fixed_names = ['machinery', 'spare parts', 'vehicle', 'vechicle', 'equipments', 'equipment']
        return (obj.name or '').strip().lower() in fixed_names

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['include_in_definition'] = StockDefinition.objects.filter(stock_group=instance, status=True).exists()
        return ret

    def validate(self, attrs):
        parent_group = attrs.get('parent_group')
        if self.instance and parent_group:
            if parent_group.id == self.instance.id:
                raise serializers.ValidationError({"parent_group": "A stock group cannot be its own parent."})
            curr = parent_group
            while curr is not None:
                if curr.id == self.instance.id:
                    raise serializers.ValidationError({"parent_group": "Circular dependency detected. The selected parent is a subgroup of this group."})
                curr = curr.parent_group
        return attrs

    def to_internal_value(self, data):
        """
        When the request is multipart/form-data, nested fields (hsn_codes,
        item_gst_rates, batch_entries) arrive as JSON strings. Parse them
        before normal validation so the nested serializers work correctly.
        """
        import json
        if hasattr(data, 'getlist'):
            mutable = {k: data.getlist(k) if len(data.getlist(k)) > 1 else data.get(k) for k in data.keys()}
        else:
            mutable = data.copy() if hasattr(data, 'copy') else dict(data)
        for field in ('hsn_codes', 'item_gst_rates', 'batch_entries'):
            val = mutable.get(field)
            if isinstance(val, str):
                try:
                    mutable[field] = json.loads(val)
                except (ValueError, TypeError):
                    pass
        # Boolean fields come as strings 'true'/'false' in FormData
        for field in ('maintain_batch', 'maintain_manufacture_date', 'maintain_expiry_date', 'include_in_definition', 'is_parent_group'):
            val = mutable.get(field)
            if isinstance(val, str):
                mutable[field] = val.lower() == 'true'
        return super().to_internal_value(mutable)

    def create(self, validated_data):
        hsn_data = validated_data.pop('hsn_codes', [])
        gst_data = validated_data.pop('gst_rates', [])
        include_in_def = validated_data.pop('include_in_definition', False)
        # is_parent_group is a direct model field, keep it in validated_data
        stock_group = StockGroup.objects.create(**validated_data)
        for hsn in hsn_data:
            StockGroupHSN.objects.create(stock_group=stock_group, **hsn)
        for gst in gst_data:
            StockGroupGST.objects.create(stock_group=stock_group, **gst)
        if include_in_def:
            StockDefinition.objects.create(stock_group=stock_group, status=True)
        return stock_group

    def update(self, instance, validated_data):
        hsn_data = validated_data.pop('hsn_codes', [])
        gst_data = validated_data.pop('gst_rates', [])
        include_in_def = validated_data.pop('include_in_definition', None)
        instance.name = validated_data.get('name', instance.name)
        if 'parent_group' in validated_data:
            instance.parent_group = validated_data['parent_group']
        if 'is_parent_group' in validated_data:
            instance.is_parent_group = validated_data['is_parent_group']
        instance.save()
        for hsn in hsn_data:
            if hsn.get('hsn_number') and hsn.get('applicable_date'):
                StockGroupHSN.objects.update_or_create(
                    stock_group=instance,
                    applicable_date=hsn['applicable_date'],
                    defaults={'hsn_number': hsn['hsn_number']}
                )
        for gst in gst_data:
            if gst.get('applicable_date'):
                StockGroupGST.objects.update_or_create(
                    stock_group=instance,
                    tax_gst_type=gst.get('tax_gst_type', 'goods'),
                    applicable_date=gst['applicable_date'],
                    defaults={
                        'igst_percent': gst.get('igst_percent', 0),
                        'cgst_percent': gst.get('cgst_percent', 0),
                        'sgst_percent': gst.get('sgst_percent', 0),
                        'cess_percent': gst.get('cess_percent', 0),
                    }
                )
        if include_in_def is True:
            def_obj, _ = StockDefinition.objects.get_or_create(
                stock_group=instance,
                defaults={'status': True}
            )
            if not def_obj.status:
                def_obj.status = True
                def_obj.save()
        elif include_in_def is False:
            def_obj = StockDefinition.objects.filter(stock_group=instance).first()
            if def_obj and def_obj.status:
                def_obj.status = False
                def_obj.save()
        return instance


class StockCategoryHSNSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockCategoryHSN
        fields = ['id', 'hsn_number', 'applicable_date']


class StockCategoryGSTSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockCategoryGST
        fields = [
            'id', 'tax_gst_type', 'igst_percent', 'cgst_percent',
            'sgst_percent', 'cess_percent', 'applicable_date'
        ]


class StockCategorySerializer(serializers.ModelSerializer):
    hsn_codes = StockCategoryHSNSerializer(many=True, required=False)
    gst_rates = StockCategoryGSTSerializer(many=True, required=False)
    parent_category_name = serializers.ReadOnlyField(source='parent_category.name')

    class Meta:
        model = StockCategory
        fields = ['id', 'name', 'parent_category', 'parent_category_name', 'hsn_codes', 'gst_rates']

    def validate(self, attrs):
        parent_category = attrs.get('parent_category')
        if self.instance and parent_category:
            if parent_category.id == self.instance.id:
                raise serializers.ValidationError({"parent_category": "A stock category cannot be its own parent."})
            curr = parent_category
            while curr is not None:
                if curr.id == self.instance.id:
                    raise serializers.ValidationError({"parent_category": "Circular dependency detected. The selected parent is a subcategory of this category."})
                curr = curr.parent_category
        return attrs

    def to_internal_value(self, data):
        """
        When the request is multipart/form-data, nested fields (hsn_codes,
        item_gst_rates, batch_entries) arrive as JSON strings. Parse them
        before normal validation so the nested serializers work correctly.
        """
        import json
        if hasattr(data, 'getlist'):
            mutable = {k: data.getlist(k) if len(data.getlist(k)) > 1 else data.get(k) for k in data.keys()}
        else:
            mutable = data.copy() if hasattr(data, 'copy') else dict(data)
        for field in ('hsn_codes', 'item_gst_rates', 'batch_entries'):
            val = mutable.get(field)
            if isinstance(val, str):
                try:
                    mutable[field] = json.loads(val)
                except (ValueError, TypeError):
                    pass
        # Boolean fields come as strings 'true'/'false' in FormData
        for field in ('maintain_batch', 'maintain_manufacture_date', 'maintain_expiry_date'):
            val = mutable.get(field)
            if isinstance(val, str):
                mutable[field] = val.lower() == 'true'
        return super().to_internal_value(mutable)

    def create(self, validated_data):
        hsn_data = validated_data.pop('hsn_codes', [])
        gst_data = validated_data.pop('gst_rates', [])
        stock_category = StockCategory.objects.create(**validated_data)
        for hsn in hsn_data:
            StockCategoryHSN.objects.create(stock_category=stock_category, **hsn)
        for gst in gst_data:
            StockCategoryGST.objects.create(stock_category=stock_category, **gst)
        return stock_category

    def update(self, instance, validated_data):
        hsn_data = validated_data.pop('hsn_codes', [])
        gst_data = validated_data.pop('gst_rates', [])
        instance.name = validated_data.get('name', instance.name)
        if 'parent_category' in validated_data:
            instance.parent_category = validated_data['parent_category']
        instance.save()
        for hsn in hsn_data:
            if hsn.get('hsn_number') and hsn.get('applicable_date'):
                StockCategoryHSN.objects.update_or_create(
                    stock_category=instance,
                    applicable_date=hsn['applicable_date'],
                    defaults={'hsn_number': hsn['hsn_number']}
                )
        for gst in gst_data:
            if gst.get('applicable_date'):
                StockCategoryGST.objects.update_or_create(
                    stock_category=instance,
                    tax_gst_type=gst.get('tax_gst_type', 'goods'),
                    applicable_date=gst['applicable_date'],
                    defaults={
                        'igst_percent': gst.get('igst_percent', 0),
                        'cgst_percent': gst.get('cgst_percent', 0),
                        'sgst_percent': gst.get('sgst_percent', 0),
                        'cess_percent': gst.get('cess_percent', 0),
                    }
                )
        return instance


class StockItemHSNSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockItemHSN
        fields = ['id', 'hsn_number', 'applicable_date']


class StockItemGSTSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockItemGST
        fields = [
            'id', 'tax_gst_type', 'igst_percent', 'cgst_percent',
            'sgst_percent', 'cess_percent', 'applicable_date'
        ]


class BatchEntrySerializer(serializers.Serializer):
    """
    Represents a single batch row submitted from the frontend.
    Not a ModelSerializer — we write to StockTable / StockTableDuplicate manually.
    """
    warehouse = serializers.IntegerField(allow_null=True)
    batch_number = serializers.CharField(max_length=100, allow_blank=True, required=False)
    manufacture_date = serializers.DateField(required=False, allow_null=True)
    expiry_date = serializers.DateField(required=False, allow_null=True)
    quantity = serializers.DecimalField(max_digits=15, decimal_places=3, allow_null=True)

    def to_internal_value(self, data):
        mutable = data.copy() if hasattr(data, 'copy') else dict(data)
        # Convert empty strings for optional fields to None before validation
        for field in ('manufacture_date', 'expiry_date'):
            if mutable.get(field) == "":
                mutable[field] = None
        # Convert empty string quantity/warehouse to None so we get a clean validation error
        if mutable.get('quantity') == "":
            mutable['quantity'] = None
        if mutable.get('warehouse') == "" or mutable.get('warehouse') is None:
            mutable['warehouse'] = None
        return super().to_internal_value(mutable)


class BatchEntryReadSerializer(serializers.Serializer):
    """
    Read-only serializer that returns existing batch rows from StockTable
    so the frontend can pre-populate the BatchEntryModal when editing.
    """
    warehouse = serializers.SerializerMethodField()
    batch_number = serializers.CharField()
    manufacture_date = serializers.DateField(allow_null=True)
    expiry_date = serializers.DateField(allow_null=True)
    quantity = serializers.DecimalField(max_digits=15, decimal_places=3)

    def get_warehouse(self, obj):
        return obj.warehouse_id  # return the FK id so the frontend Select can match it


class StockItemSerializer(serializers.ModelSerializer):
    stock_group_name = serializers.ReadOnlyField(source='stock_group.name')
    stock_category_name = serializers.ReadOnlyField(source='stock_category.name')
    base_unit_name = serializers.ReadOnlyField(source='base_unit.name')
    alternate_unit_name = serializers.ReadOnlyField(source='alternate_unit.name')
    hsn_codes = StockItemHSNSerializer(many=True, required=False)
    item_gst_rates = StockItemGSTSerializer(many=True, required=False)
    gst_percentage = serializers.SerializerMethodField()
    gst_rates = StockItemGSTSerializer(source='item_gst_rates', many=True, read_only=True)
    batch_entries = BatchEntrySerializer(many=True, required=False, write_only=True)
    existing_batch_entries = serializers.SerializerMethodField(read_only=True)
    image_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = StockItem
        fields = [
            'id', 'name', 'item_code',
            'stock_group', 'stock_group_name',
            'stock_category', 'stock_category_name',
            'base_unit', 'base_unit_name',
            'alternate_unit', 'alternate_unit_name',
            'conversion_value',
            'maintain_batch', 'maintain_manufacture_date', 'maintain_expiry_date', 'has_bom',
            'opening_stock', 'opening_rate', 'opening_value',
            'mrp', 'sb_rate', 'ss_rate',
            'hsn_codes', 'item_gst_rates', 'gst_percentage', 'gst_rates', 'batch_entries', 'existing_batch_entries',
            'image', 'image_url',
        ]

    def get_gst_percentage(self, obj):
        # 1. Check item-specific GST rate first
        gst_rate = obj.item_gst_rates.order_by('-applicable_date').first()
        if gst_rate:
            return float(gst_rate.igst_percent)
            
        # 2. Check stock category hierarchy
        current_category = obj.stock_category
        while current_category:
            gst_rate = current_category.gst_rates.order_by('-applicable_date').first()
            if gst_rate:
                return float(gst_rate.igst_percent)
            current_category = current_category.parent_category
            
        # 3. Check stock group hierarchy
        current_group = obj.stock_group
        while current_group:
            gst_rate = current_group.gst_rates.order_by('-applicable_date').first()
            if gst_rate:
                return float(gst_rate.igst_percent)
            current_group = current_group.parent_group
            
        return 0.0

    def get_image_url(self, instance):
        request = self.context.get('request')
        if instance.image and request:
            return request.build_absolute_uri(instance.image.url)
        return None

    def get_existing_batch_entries(self, instance):
        """
        Returns the current OPENING STOCK batch rows from StockTable so the
        frontend BatchEntryModal can be pre-populated when editing a stock item.
        """
        from inventory_app.models import StockTable
        rows = StockTable.objects.filter(
            item=instance,
            transaction_type='OPENING STOCK',
        ).order_by('id')
        return BatchEntryReadSerializer(rows, many=True).data

    def _save_batch_entries(self, instance, batch_entries):
        """
        Delete ALL existing OPENING STOCK rows for this item and recreate them.
        If batch_entries is empty but opening_stock > 0, create a single generic row.
        """
        from settings_app.models import Warehouse

        # Remove ALL previous opening stock rows
        StockTable.objects.filter(
            item=instance,
            transaction_type='OPENING STOCK',
        ).delete()
        StockTableDuplicate.objects.filter(
            item=instance,
            transaction_type='OPENING STOCK',
        ).delete()

        date = instance.created_at.date() if instance.created_at else None

        if batch_entries and len(batch_entries) > 0:
            for entry in batch_entries:
                warehouse_pk = entry.get('warehouse')
                warehouse = Warehouse.objects.filter(pk=warehouse_pk).first() if warehouse_pk else None
                common = dict(
                    item=instance,
                    movement_type='IN',
                    transaction_type='OPENING STOCK',
                    reference_id=instance.id,
                    quantity=entry['quantity'],
                    rate=instance.opening_rate,
                    batch_number=entry.get('batch_number', ''),
                    manufacture_date=entry.get('manufacture_date'),
                    expiry_date=entry.get('expiry_date'),
                    warehouse=warehouse,
                    date=date,
                    is_active=True,
                )
                StockTable.objects.create(**common)
                StockTableDuplicate.objects.create(**common)
        else:
            if instance.opening_stock and instance.opening_stock > 0:
                common = dict(
                    item=instance,
                    movement_type='IN',
                    transaction_type='OPENING STOCK',
                    reference_id=instance.id,
                    quantity=instance.opening_stock,
                    rate=instance.opening_rate,
                    batch_number='',
                    warehouse=None,
                    date=date,
                    is_active=True,
                )
                StockTable.objects.create(**common)
                StockTableDuplicate.objects.create(**common)

    def to_internal_value(self, data):
        """
        When the request is multipart/form-data, nested fields (hsn_codes,
        item_gst_rates, batch_entries) arrive as JSON strings. Parse them
        before normal validation so the nested serializers work correctly.
        """
        import json
        if hasattr(data, 'getlist'):
            mutable = {k: data.getlist(k) if len(data.getlist(k)) > 1 else data.get(k) for k in data.keys()}
        else:
            mutable = data.copy() if hasattr(data, 'copy') else dict(data)
        for field in ('hsn_codes', 'item_gst_rates', 'batch_entries'):
            val = mutable.get(field)
            if isinstance(val, str):
                try:
                    mutable[field] = json.loads(val)
                except (ValueError, TypeError):
                    pass
        # Boolean fields come as strings 'true'/'false' in FormData
        for field in ('maintain_batch', 'maintain_manufacture_date', 'maintain_expiry_date', 'has_bom'):
            val = mutable.get(field)
            if isinstance(val, str):
                mutable[field] = val.lower() == 'true'
        return super().to_internal_value(mutable)

    def create(self, validated_data):
        hsn_data = validated_data.pop('hsn_codes', [])
        gst_data = validated_data.pop('item_gst_rates', [])
        batch_entries = validated_data.pop('batch_entries', [])
        instance = super().create(validated_data)
        for hsn in hsn_data:
            StockItemHSN.objects.create(stock_item=instance, **hsn)
        for gst in gst_data:
            StockItemGST.objects.create(stock_item=instance, **gst)
        self._save_batch_entries(instance, batch_entries)
        return instance

    def update(self, instance, validated_data):
        hsn_data = validated_data.pop('hsn_codes', [])
        gst_data = validated_data.pop('item_gst_rates', [])
        batch_entries = validated_data.pop('batch_entries', None)
        instance = super().update(instance, validated_data)
        # Append new HSN entry only if this exact combination doesn't already exist
        for hsn in hsn_data:
            if hsn.get('hsn_number') and hsn.get('applicable_date'):
                StockItemHSN.objects.update_or_create(
                    stock_item=instance,
                    applicable_date=hsn['applicable_date'],
                    defaults={'hsn_number': hsn['hsn_number']}
                )
        for gst in gst_data:
            if gst.get('applicable_date'):
                StockItemGST.objects.update_or_create(
                    stock_item=instance,
                    tax_gst_type=gst.get('tax_gst_type', 'goods'),
                    applicable_date=gst['applicable_date'],
                    defaults={
                        'igst_percent': gst.get('igst_percent', 0),
                        'cgst_percent': gst.get('cgst_percent', 0),
                        'sgst_percent': gst.get('sgst_percent', 0),
                        'cess_percent': gst.get('cess_percent', 0),
                    }
                )
        # Only touch batch entries when they were explicitly sent
        if batch_entries is not None:
            self._save_batch_entries(instance, batch_entries)
        return instance


class StockItemSimpleSerializer(serializers.ModelSerializer):
    gst_percentage = serializers.SerializerMethodField()
    base_unit_name = serializers.CharField(source='base_unit.name', read_only=True)
    stock_group_name = serializers.CharField(source='stock_group.name', read_only=True)
    gst_rates = StockItemGSTSerializer(source='item_gst_rates', many=True, read_only=True)

    class Meta:
        model = StockItem
        fields = [
            'id', 'name', 'opening_rate', 'sb_rate', 'ss_rate', 'gst_percentage',
            'stock_group', 'stock_group_name',
            'base_unit', 'base_unit_name', 'gst_rates',
            'maintain_batch', 'maintain_manufacture_date', 'maintain_expiry_date',
            'has_bom'
        ]

    def get_gst_percentage(self, obj):
        # 1. Check item-specific GST rate first
        gst_rate = obj.item_gst_rates.order_by('-applicable_date').first()
        if gst_rate:
            return float(gst_rate.igst_percent)
            
        # 2. Check stock category hierarchy
        current_category = obj.stock_category
        while current_category:
            gst_rate = current_category.gst_rates.order_by('-applicable_date').first()
            if gst_rate:
                return float(gst_rate.igst_percent)
            current_category = current_category.parent_category
            
        # 3. Check stock group hierarchy
        current_group = obj.stock_group
        while current_group:
            gst_rate = current_group.gst_rates.order_by('-applicable_date').first()
            if gst_rate:
                return float(gst_rate.igst_percent)
            current_group = current_group.parent_group
            
        return 0.0


class ProductConfigurationSerializer(serializers.ModelSerializer):
    voucher_type_name = serializers.CharField(source='voucher_type.name', read_only=True)
    voucher_type_code = serializers.CharField(source='voucher_type.code', read_only=True)

    class Meta:
        model = ProductConfiguration
        fields = [
            'id',
            'voucher_type',
            'voucher_type_name',
            'voucher_type_code',
            'maintain_batch',
            'maintain_manufacture_date',
            'maintain_expiry_date',
            'maintain_warehouse',
            'maintain_narration',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class LedgerPriceListMappingSerializer(serializers.ModelSerializer):
    ledger_name = serializers.CharField(source='ledger.name', read_only=True)
    account_group_name = serializers.CharField(source='ledger.accountGroup.name', read_only=True, default=None)
    price_list_name = serializers.CharField(source='price_list.name', read_only=True)

    class Meta:
        model = LedgerPriceListMapping
        fields = [
            'id',
            'ledger',
            'ledger_name',
            'account_group_name',
            'price_list',
            'price_list_name',
            'applicable_date',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class RecipeDetailsSerializer(serializers.ModelSerializer):
    stock_item_name = serializers.ReadOnlyField(source='stock_item.name')
    unit_name = serializers.ReadOnlyField(source='unit.name')
    primary_unit_name = serializers.ReadOnlyField(source='stock_item.base_unit.name')

    class Meta:
        model = RecipeDetails
        fields = ['id', 'stock_item', 'stock_item_name', 'quantity', 'unit', 'unit_name', 'primary_unit_name']


class BillOfEntrySerializer(serializers.ModelSerializer):
    recipe_details = RecipeDetailsSerializer(many=True, required=False)
    stock_item_name = serializers.ReadOnlyField(source='stock_item.name')
    primary_unit_name = serializers.ReadOnlyField(source='stock_item.base_unit.name')
    created_by_name = serializers.ReadOnlyField(source='created_by.first_name')

    class Meta:
        model = BillOfEntry
        fields = [
            'id', 'recipe_name', 'unit_of_manufacture', 'stock_item', 'stock_item_name', 'primary_unit_name',
            'applicable_date', 'created_by', 'created_by_name', 'created_at', 'recipe_details'
        ]
        read_only_fields = ['created_at', 'created_by']

    def to_internal_value(self, data):
        import json
        if hasattr(data, 'getlist'):
            mutable = {k: data.getlist(k) if len(data.getlist(k)) > 1 else data.get(k) for k in data.keys()}
        else:
            mutable = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'recipe_details' in mutable and isinstance(mutable['recipe_details'], str):
            try:
                mutable['recipe_details'] = json.loads(mutable['recipe_details'])
            except (ValueError, TypeError):
                pass
        return super().to_internal_value(mutable)

    def create(self, validated_data):
        recipe_details_data = validated_data.pop('recipe_details', [])
        request = self.context.get('request')
        if request and hasattr(request, "user"):
            validated_data['created_by'] = request.user
        bill_of_entry = BillOfEntry.objects.create(**validated_data)
        for detail_data in recipe_details_data:
            if 'created_by' not in detail_data:
                detail_data['created_by'] = validated_data.get('created_by')
            RecipeDetails.objects.create(recipe=bill_of_entry, **detail_data)

        # Set has_bom = True on the StockItem
        stock_item = validated_data.get('stock_item')
        if stock_item and not stock_item.has_bom:
            stock_item.has_bom = True
            stock_item.save(update_fields=['has_bom'])

        return bill_of_entry

    def update(self, instance, validated_data):
        recipe_details_data = validated_data.pop('recipe_details', None)
        old_stock_item = instance.stock_item
        instance.recipe_name = validated_data.get('recipe_name', instance.recipe_name)
        instance.unit_of_manufacture = validated_data.get('unit_of_manufacture', instance.unit_of_manufacture)
        instance.stock_item = validated_data.get('stock_item', instance.stock_item)
        instance.applicable_date = validated_data.get('applicable_date', instance.applicable_date)
        instance.save()

        # Set has_bom = True on the new StockItem if not already set
        if instance.stock_item and not instance.stock_item.has_bom:
            instance.stock_item.has_bom = True
            instance.stock_item.save(update_fields=['has_bom'])

        # If the stock item changed, check if the old one has any remaining recipes
        if old_stock_item and old_stock_item != instance.stock_item:
            if not BillOfEntry.objects.filter(stock_item=old_stock_item).exclude(id=instance.id).exists():
                old_stock_item.has_bom = False
                old_stock_item.save(update_fields=['has_bom'])
        
        if recipe_details_data is not None:
            instance.recipe_details.all().delete()
            request = self.context.get('request')
            user = request.user if request and hasattr(request, "user") else instance.created_by
            for detail_data in recipe_details_data:
                if 'created_by' not in detail_data:
                    detail_data['created_by'] = user
                RecipeDetails.objects.create(recipe=instance, **detail_data)
        return instance

from .models import PhysicalStock, PhysicalStockItem

class PhysicalStockItemSerializer(serializers.ModelSerializer):
    item_name = serializers.ReadOnlyField(source='item.name')
    warehouse_name = serializers.ReadOnlyField(source='warehouse.name')
    
    class Meta:
        model = PhysicalStockItem
        fields = [
            'id', 'item', 'item_name', 'warehouse', 'warehouse_name',
            'batch_number', 'manufacture_date', 'expiry_date',
            'system_quantity', 'quantity', 'amount'
        ]
        read_only_fields = ['system_quantity']

class PhysicalStockSerializer(serializers.ModelSerializer):
    items = PhysicalStockItemSerializer(many=True, required=False)
    created_by_name = serializers.ReadOnlyField(source='created_by.first_name')

    class Meta:
        model = PhysicalStock
        fields = [
            'id', 'voucher_no', 'date', 'created_by', 'created_by_name',
            'created_at', 'updated_at', 'items'
        ]
        read_only_fields = ['voucher_no', 'created_at', 'updated_at', 'created_by']

    def to_internal_value(self, data):
        import json
        mutable = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'items' in mutable and isinstance(mutable['items'], str):
            try:
                mutable['items'] = json.loads(mutable['items'])
            except (ValueError, TypeError):
                pass
        return super().to_internal_value(mutable)

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        request = self.context.get('request')
        if request and hasattr(request, "user"):
            validated_data['created_by'] = request.user
        
        physical_stock = PhysicalStock.objects.create(**validated_data)
        
        for item_data in items_data:
            PhysicalStockItem.objects.create(physical_stock=physical_stock, **item_data)
            
        return physical_stock

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        instance = super().update(instance, validated_data)
        
        if items_data is not None:
            # We will handle deletion of old items and their StockTable adjustments in the view
            # For simplicity, here we just recreate the lines.
            instance.items.all().delete()
            for item_data in items_data:
                PhysicalStockItem.objects.create(physical_stock=instance, **item_data)
                
        return instance



class WarehouseTransferItemSplitSerializer(serializers.ModelSerializer):
    source_warehouse_name = serializers.CharField(source='source_warehouse.name', read_only=True)

    class Meta:
        model = WarehouseTransferItemSplit
        fields = [
            'id', 'source_warehouse', 'source_warehouse_name', 'batch_number', 'manufacture_date', 
            'expiry_date', 'quantity', 'rate', 'amount'
        ]


class WarehouseTransferItemSerializer(serializers.ModelSerializer):
    splits = WarehouseTransferItemSplitSerializer(many=True, required=False)
    item_name = serializers.CharField(source='item.name', read_only=True)

    class Meta:
        model = WarehouseTransferItem
        fields = ['id', 'item', 'item_name', 'splits']


class WarehouseTransferSerializer(serializers.ModelSerializer):
    items = WarehouseTransferItemSerializer(many=True, required=False)
    destination_warehouse_name = serializers.CharField(source='destination_warehouse.name', read_only=True)

    class Meta:
        model = WarehouseTransfer
        fields = [
            'id', 'wt_no', 'entry_date', 'destination_warehouse', 
            'destination_warehouse_name', 'narration', 'items', 'created_by'
        ]
        read_only_fields = ['wt_no', 'created_by']

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['created_by'] = request.user

        transfer = WarehouseTransfer.objects.create(**validated_data)

        for item_data in items_data:
            splits_data = item_data.pop('splits', [])
            transfer_item = WarehouseTransferItem.objects.create(transfer=transfer, **item_data)
            
            for split_data in splits_data:
                WarehouseTransferItemSplit.objects.create(transfer_item=transfer_item, **split_data)
                
        return transfer

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        
        instance.entry_date = validated_data.get('entry_date', instance.entry_date)
        instance.destination_warehouse = validated_data.get('destination_warehouse', instance.destination_warehouse)
        instance.narration = validated_data.get('narration', instance.narration)
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                splits_data = item_data.pop('splits', [])
                transfer_item = WarehouseTransferItem.objects.create(transfer=instance, **item_data)
                for split_data in splits_data:
                    WarehouseTransferItemSplit.objects.create(transfer_item=transfer_item, **split_data)
        
        return instance

class StockTableSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    voucher_type_name = serializers.SerializerMethodField()

    class Meta:
        model = StockTable
        fields = '__all__'

    def get_voucher_type_name(self, obj):
        def _resolve_voucher_type(vt):
            if not vt: return None
            if hasattr(vt, 'name'): return vt.name
            if isinstance(vt, str) and vt.isdigit():
                try:
                    from finance_app.models import VoucherType
                    return VoucherType.objects.get(id=int(vt)).name
                except Exception:
                    pass
            return vt

        def _resolve_prefix_config_voucher(vt):
            if not vt: return None
            if isinstance(vt, str) and vt.isdigit():
                try:
                    from settings_app.models import PrefixConfiguration
                    pc = PrefixConfiguration.objects.get(id=int(vt))
                    if pc.voucher_type:
                        return pc.voucher_type.name
                except Exception:
                    pass
            return _resolve_voucher_type(vt)

        try:
            if obj.transaction_type == 'SALES_INVOICE':
                from sales_app.models import SalesInvoice
                invoice = SalesInvoice.objects.get(id=obj.reference_id)
                return _resolve_voucher_type(invoice.voucher_type) or 'Sales Invoice'
            elif obj.transaction_type == 'PURCHASE_INVOICE':
                from purchase_app.models import PurchaseInvoice
                invoice = PurchaseInvoice.objects.get(id=obj.reference_id)
                return _resolve_prefix_config_voucher(invoice.voucher_type) or 'Purchase Invoice'
            elif obj.transaction_type == 'SALES_RETURN':
                from sales_app.models import SalesReturn
                ret = SalesReturn.objects.get(id=obj.reference_id)
                return _resolve_prefix_config_voucher(ret.voucher_type) or 'Sales Return'
            elif obj.transaction_type == 'PURCHASE_RETURN':
                from purchase_app.models import PurchaseReturn
                ret = PurchaseReturn.objects.get(id=obj.reference_id)
                return _resolve_prefix_config_voucher(ret.voucher_type) or 'Purchase Return'
            return obj.transaction_type
        except Exception:
            return obj.transaction_type
