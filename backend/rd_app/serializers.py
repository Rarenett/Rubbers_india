from decimal import Decimal
from rest_framework import serializers

from production_app.models import PostProductionEntry
from rd_app.models import RnDEntry, ExtraQuantity


class RnDEntrySerializer(serializers.ModelSerializer):
    production_date = serializers.SerializerMethodField(read_only=True)
    production_line_name = serializers.SerializerMethodField(read_only=True)
    stock_item_name = serializers.SerializerMethodField(read_only=True)
    stock_item = serializers.SerializerMethodField(read_only=True)
    unit_name = serializers.SerializerMethodField(read_only=True)
    balance_primary = serializers.SerializerMethodField(read_only=True)
    batch_number = serializers.SerializerMethodField(read_only=True)
    expiry_after = serializers.SerializerMethodField(read_only=True)
    has_manufacture_journal = serializers.SerializerMethodField(read_only=True)
    manufactural_journal_id = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = RnDEntry
        fields = [
            'id',
            'post_production_entry',
            'batch_number',
            'expiry_after',
            'has_manufacture_journal',
            'manufactural_journal_id',
            'manufactured_quantity',
            'damaged_quantity',
            'balance_quantity',
            'balance_primary',
            'production_date',
            'production_line_name',
            'stock_item',
            'stock_item_name',
            'unit_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'manufactured_quantity',
            'balance_quantity',
            'balance_primary',
            'created_at',
            'updated_at',
        ]

    def get_production_date(self, obj):
        try:
            return obj.post_production_entry.production_line.shift_day.plan_date
        except AttributeError:
            if obj.post_production_entry and obj.post_production_entry.created_at:
                return obj.post_production_entry.created_at.date()
            return None

    def get_production_line_name(self, obj):
        try:
            return obj.post_production_entry.production_line.production_line.name
        except AttributeError:
            if obj.post_production_entry and obj.post_production_entry.production_type == 'ADJUSTMENT':
                return 'Production Adjustment'
            return None

    def get_stock_item(self, obj):
        if obj.post_production_entry and obj.post_production_entry.stock_item_id:
            return obj.post_production_entry.stock_item_id
        try:
            return obj.post_production_entry.production_line.stock_item_id
        except AttributeError:
            return None

    def get_balance_primary(self, obj):
        if obj.balance_quantity is not None:
            return obj.balance_quantity
        if obj.post_production_entry and obj.post_production_entry.balance_primary is not None:
            return obj.post_production_entry.balance_primary
        return Decimal('0.00')

    def get_stock_item_name(self, obj):
        if obj.post_production_entry and obj.post_production_entry.stock_item:
            return obj.post_production_entry.stock_item.name
        try:
            return obj.post_production_entry.production_line.stock_item.name
        except AttributeError:
            return None

    def get_unit_name(self, obj):
        if obj.post_production_entry and obj.post_production_entry.stock_item and obj.post_production_entry.stock_item.base_unit:
            return obj.post_production_entry.stock_item.base_unit.name
        try:
            return obj.post_production_entry.production_line.stock_item.base_unit.name
        except AttributeError:
            return None

    def get_batch_number(self, obj):
        if obj.post_production_entry and obj.post_production_entry.batch_number:
            return obj.post_production_entry.batch_number
        return None

    def get_expiry_after(self, obj):
        if obj.post_production_entry and obj.post_production_entry.expiry_after is not None:
            return obj.post_production_entry.expiry_after
        return None

    def get_has_manufacture_journal(self, obj):
        try:
            return obj.manufactural_journals.exists()
        except Exception:
            return False

    def get_manufactural_journal_id(self, obj):
        try:
            j = obj.manufactural_journals.first()
            return j.id if j else None
        except Exception:
            return None

    def validate_damaged_quantity(self, value):
        if value is None:
            raise serializers.ValidationError("Damaged quantity is required.")
        if value < 0:
            raise serializers.ValidationError("Damaged quantity cannot be negative.")
        return value

    def validate(self, attrs):
        # 1. Determine the target post_production_entry
        if self.instance is not None:
            # Updating an existing RnDEntry
            post_production_entry = attrs.get('post_production_entry', self.instance.post_production_entry)
            if post_production_entry != self.instance.post_production_entry:
                raise serializers.ValidationError({
                    "post_production_entry": "Post Production entry cannot be changed once assigned."
                })
        else:
            # Creating a new RnDEntry
            post_production_entry = attrs.get('post_production_entry')
            if not post_production_entry:
                raise serializers.ValidationError({
                    "post_production_entry": "Post Production entry is required."
                })
            # Prevent duplicate R&D records
            if RnDEntry.objects.filter(post_production_entry=post_production_entry).exists():
                raise serializers.ValidationError({
                    "post_production_entry": "An R&D entry already exists for this Post Production entry."
                })

        # 2. Receive manufactured_quantity from PostProductionEntry balance_primary or manufactured_quantity
        balance_primary = post_production_entry.balance_primary
        if balance_primary is not None and Decimal(str(balance_primary)) > 0:
            manufactured_qty = Decimal(str(balance_primary))
        elif post_production_entry.manufactured_quantity and Decimal(str(post_production_entry.manufactured_quantity)) > 0:
            manufactured_qty = Decimal(str(post_production_entry.manufactured_quantity))
        elif post_production_entry.balance and Decimal(str(post_production_entry.balance)) > 0:
            manufactured_qty = Decimal(str(post_production_entry.balance))
        else:
            manufactured_qty = Decimal(str(balance_primary or 0))

        # 3. Validate damaged_quantity against manufactured_quantity
        damaged_qty = attrs.get('damaged_quantity')
        if damaged_qty is None and self.instance is not None:
            damaged_qty = self.instance.damaged_quantity
        damaged_qty = Decimal(str(damaged_qty or 0))

        if damaged_qty < 0:
            raise serializers.ValidationError({
                "damaged_quantity": "Damaged quantity cannot be negative."
            })

        if damaged_qty > manufactured_qty:
            raise serializers.ValidationError({
                "damaged_quantity": f"Damaged quantity ({damaged_qty}) cannot exceed manufactured quantity ({manufactured_qty})."
            })

        # 4. Calculate Balance Quantity: Balance = Manufactured Quantity - R&D Damaged Quantity
        balance_qty = manufactured_qty - damaged_qty

        attrs['manufactured_quantity'] = manufactured_qty
        attrs['damaged_quantity'] = damaged_qty
        attrs['balance_quantity'] = balance_qty

        return attrs


class PostProductionRnDListingSerializer(serializers.ModelSerializer):
    """
    Serializer to list PostProduction entries with their R&D entry status,
    allowing the frontend to show pending vs completed entries seamlessly.
    Supports both REGULAR and ADJUSTMENT production types.
    """
    post_production_entry_id = serializers.IntegerField(source='id', read_only=True)
    production_type = serializers.CharField(read_only=True)
    production_date = serializers.SerializerMethodField(read_only=True)
    production_line_name = serializers.SerializerMethodField(read_only=True)
    stock_item_name = serializers.SerializerMethodField(read_only=True)
    stock_item_code = serializers.SerializerMethodField(read_only=True)
    factory_name = serializers.SerializerMethodField(read_only=True)
    factory_id = serializers.SerializerMethodField(read_only=True)
    shift_name = serializers.SerializerMethodField(read_only=True)
    shift_id = serializers.SerializerMethodField(read_only=True)
    start_time = serializers.SerializerMethodField(read_only=True)
    end_time = serializers.SerializerMethodField(read_only=True)
    planned_quantity = serializers.SerializerMethodField(read_only=True)
    unit_name = serializers.SerializerMethodField(read_only=True)
    alternate_unit_name = serializers.SerializerMethodField(read_only=True)
    consumed_alternate_quantity = serializers.DecimalField(source='actual_use_quantity', max_digits=12, decimal_places=2, read_only=True)

    manufactured_quantity = serializers.SerializerMethodField(read_only=True)
    balance_primary = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    balance_alternate = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    extra_quantity = serializers.SerializerMethodField(read_only=True)

    rnd_entry_id = serializers.SerializerMethodField(read_only=True)
    damaged_quantity = serializers.SerializerMethodField(read_only=True)
    balance_quantity = serializers.SerializerMethodField(read_only=True)
    status = serializers.SerializerMethodField(read_only=True)
    created_at = serializers.SerializerMethodField(read_only=True)
    updated_at = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = PostProductionEntry
        fields = [
            'id',
            'post_production_entry_id',
            'production_type',
            'production_date',
            'production_line_name',
            'stock_item_name',
            'stock_item_code',
            'factory_name',
            'factory_id',
            'shift_name',
            'shift_id',
            'start_time',
            'end_time',
            'planned_quantity',
            'unit_name',
            'alternate_unit_name',
            'consumed_alternate_quantity',
            'manufactured_quantity',
            'balance_primary',
            'balance_alternate',
            'extra_quantity',
            'rnd_entry_id',
            'damaged_quantity',
            'balance_quantity',
            'status',
            'created_at',
            'updated_at',
        ]

    def _get_rnd_entry(self, obj):
        try:
            return obj.rnd_entry
        except (RnDEntry.DoesNotExist, AttributeError):
            return None

    def get_production_date(self, obj):
        try:
            return obj.production_line.shift_day.plan_date
        except AttributeError:
            if obj.created_at:
                return obj.created_at.date()
            return None

    def get_production_line_name(self, obj):
        try:
            return obj.production_line.production_line.name
        except AttributeError:
            if obj.production_type == 'ADJUSTMENT':
                return 'Production Adjustment'
            return None

    def get_stock_item_name(self, obj):
        if obj.stock_item:
            return obj.stock_item.name
        try:
            return obj.production_line.stock_item.name
        except AttributeError:
            return None

    def get_stock_item_code(self, obj):
        if obj.stock_item:
            return getattr(obj.stock_item, 'item_code', None) or getattr(obj.stock_item, 'code', None)
        try:
            return getattr(obj.production_line.stock_item, 'item_code', None)
        except AttributeError:
            return None

    def get_factory_name(self, obj):
        try:
            return obj.production_line.shift_day.shift_plan.factory.name
        except AttributeError:
            return None

    def get_factory_id(self, obj):
        try:
            return obj.production_line.shift_day.shift_plan.factory.id
        except AttributeError:
            return None

    def get_shift_name(self, obj):
        try:
            return obj.production_line.shift_day.shift.name
        except AttributeError:
            return None

    def get_shift_id(self, obj):
        try:
            return obj.production_line.shift_day.shift.id
        except AttributeError:
            return None

    def get_start_time(self, obj):
        try:
            return str(obj.production_line.start_time)
        except AttributeError:
            return None

    def get_end_time(self, obj):
        try:
            return str(obj.production_line.end_time)
        except AttributeError:
            return None

    def get_planned_quantity(self, obj):
        try:
            return obj.production_line.planned_quantity
        except AttributeError:
            return None

    def get_unit_name(self, obj):
        if obj.stock_item and obj.stock_item.base_unit:
            return obj.stock_item.base_unit.name
        try:
            return obj.production_line.stock_item.base_unit.name
        except AttributeError:
            return None

    def get_alternate_unit_name(self, obj):
        if obj.stock_item and obj.stock_item.alternate_unit:
            return obj.stock_item.alternate_unit.name
        try:
            return obj.production_line.stock_item.alternate_unit.name
        except AttributeError:
            return None

    def get_manufactured_quantity(self, obj):
        rnd = self._get_rnd_entry(obj)
        if rnd:
            return rnd.manufactured_quantity
        if obj.balance_primary and obj.balance_primary > 0:
            return obj.balance_primary
        if obj.manufactured_quantity and obj.manufactured_quantity > 0:
            return obj.manufactured_quantity
        if obj.balance and obj.balance > 0:
            return obj.balance
        return obj.balance_primary or obj.manufactured_quantity or Decimal('0.00')

    def get_extra_quantity(self, obj):
        return obj.balance_alternate or Decimal('0.00')

    def get_rnd_entry_id(self, obj):
        rnd = self._get_rnd_entry(obj)
        return rnd.id if rnd else None

    def get_damaged_quantity(self, obj):
        rnd = self._get_rnd_entry(obj)
        return rnd.damaged_quantity if rnd else None

    def get_balance_quantity(self, obj):
        rnd = self._get_rnd_entry(obj)
        if rnd:
            return rnd.balance_quantity
        return self.get_manufactured_quantity(obj)

    def get_status(self, obj):
        rnd = self._get_rnd_entry(obj)
        return 'COMPLETED' if rnd else 'PENDING'

    def get_created_at(self, obj):
        rnd = self._get_rnd_entry(obj)
        return rnd.created_at if rnd else obj.created_at

    def get_updated_at(self, obj):
        rnd = self._get_rnd_entry(obj)
        return rnd.updated_at if rnd else obj.updated_at


class ExtraQuantitySerializer(serializers.ModelSerializer):
    """
    Serializer for ExtraQuantity records (balance alternate tracked as extra quantity).
    """
    post_production_id = serializers.IntegerField(source='post_production_id', read_only=True)
    production_line_name = serializers.SerializerMethodField(read_only=True)
    stock_item_name = serializers.SerializerMethodField(read_only=True)
    production_date = serializers.SerializerMethodField(read_only=True)
    unit_id = serializers.IntegerField(source='unit.id', read_only=True)
    unit_name = serializers.SerializerMethodField(read_only=True)
    IN = serializers.DecimalField(source='in_quantity', max_digits=12, decimal_places=2, required=False)
    OUT = serializers.DecimalField(source='out_quantity', max_digits=12, decimal_places=2, required=False)

    class Meta:
        model = ExtraQuantity
        fields = [
            'id',
            'post_production',
            'post_production_id',
            'production_line_name',
            'stock_item_name',
            'production_date',
            'unit',
            'unit_id',
            'unit_name',
            'in_quantity',
            'out_quantity',
            'IN',
            'OUT',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_unit_name(self, obj):
        try:
            return obj.unit.name if obj.unit else None
        except AttributeError:
            return None

    def get_production_line_name(self, obj):
        try:
            if obj.production_line and obj.production_line.production_line:
                return obj.production_line.production_line.name
            if obj.post_production and obj.post_production.production_line:
                return obj.post_production.production_line.production_line.name
            return None
        except AttributeError:
            return None

    def get_stock_item_name(self, obj):
        try:
            if obj.stock_item:
                return obj.stock_item.name
            if obj.post_production and obj.post_production.production_line:
                return obj.post_production.production_line.stock_item.name
            return None
        except AttributeError:
            return None

    def get_production_date(self, obj):
        try:
            if obj.production_line and obj.production_line.shift_day:
                return obj.production_line.shift_day.plan_date
            if obj.post_production and obj.post_production.production_line:
                return obj.post_production.production_line.shift_day.plan_date
            return None
        except AttributeError:
            return None

