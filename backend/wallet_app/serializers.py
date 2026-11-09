from decimal import Decimal
from rest_framework import serializers
from django.utils import timezone
from django.db import transaction
from .models import (
    WalletMaster,
    WalletTransaction,
    WalletOwnerType,
    WalletScheme,
    WalletSchemeCriteria,
    WalletCriteriaValue,
    WalletReason,
    WalletPointsEntry,
    WalletWorkingSettings,
    EmployeeWorkingStatus,
    WorkingStatusHistory,
    WorkingSession,
    WorkingBreak,
    InactivityEvent,
    ScreenshotSchedule,
    ScreenshotExecution,
    get_wallet_local_date,
    get_wallet_local_time,
)


class WalletMasterSerializer(serializers.ModelSerializer):
    current_balance = serializers.SerializerMethodField()
    transaction_count = serializers.SerializerMethodField()
    points_entries_count = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    owner_type = serializers.CharField(max_length=50, required=True)

    class Meta:
        model = WalletMaster
        fields = [
            'id',
            'wallet_code',
            'owner_type',
            'owner_id',
            'owner_record_id',
            'wallet_name',
            'mobile',
            'email',
            'opening_points',
            'daily_deduction_limit',
            'points_expiry_date',
            'points_expiry_days',
            'remarks',
            'status',
            'current_balance',
            'transaction_count',
            'points_entries_count',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_current_balance(self, obj):
        balance = obj.get_balance()
        return f"{balance:.2f}"

    def get_transaction_count(self, obj):
        return obj.transactions.count()

    def get_points_entries_count(self, obj):
        return obj.points_entries.count()

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def validate_wallet_code(self, value):
        code = (value or '').strip().upper()
        if not code:
            raise serializers.ValidationError("Wallet code is required.")
        qs = WalletMaster.objects.filter(wallet_code__iexact=code)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f"Wallet code '{code}' already exists.")
        return code

    def validate_wallet_name(self, value):
        name = (value or '').strip()
        if not name:
            raise serializers.ValidationError("Wallet name is required.")
        return name

    def validate_opening_points(self, value):
        if value is not None and value < Decimal('0.00'):
            raise serializers.ValidationError("Opening points cannot be negative.")
        return value or Decimal('0.00')

    def validate_daily_deduction_limit(self, value):
        if value is not None and value < Decimal('0.00'):
            raise serializers.ValidationError("Daily deduction limit cannot be negative.")
        return value or Decimal('0.00')

    def validate(self, attrs):
        attrs = super().validate(attrs)
        owner_type = attrs.get('owner_type') or (self.instance.owner_type if self.instance else None)
        owner_id = attrs.get('owner_id') or (self.instance.owner_id if self.instance else None)
        owner_record_id = attrs.get('owner_record_id') or (self.instance.owner_record_id if self.instance else None)

        if not self.instance:
            if not owner_type:
                raise serializers.ValidationError({'owner_type': "Owner type is mandatory."})

            # Check if owner_type exists in WalletOwnerType (active) or standard choices
            is_valid_type = (
                owner_type in ['Employee', 'Vendor', 'Distributor'] or
                WalletOwnerType.objects.filter(owner_type__iexact=owner_type, status='Active').exists()
            )
            if not is_valid_type:
                raise serializers.ValidationError({'owner_type': f"'{owner_type}' is not a valid active owner type."})

            # Check for existing wallet for this owner if owner_id provided
            if owner_id:
                existing = WalletMaster.objects.filter(owner_type=owner_type, owner_id=owner_id)
                if existing.exists():
                    raise serializers.ValidationError({
                        'owner_name': f"A wallet already exists for {owner_type} '{owner_id}' ({existing.first().wallet_code})."
                    })

        return attrs


class WalletTransactionSerializer(serializers.ModelSerializer):
    wallet_name = serializers.CharField(source='wallet.wallet_name', read_only=True)
    wallet_code = serializers.CharField(source='wallet.wallet_code', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = WalletTransaction
        fields = [
            'id',
            'transaction_number',
            'transaction_date',
            'wallet',
            'wallet_name',
            'wallet_code',
            'transaction_type',
            'amount',
            'reference_number',
            'description',
            'status',
            'cancellation_reason',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'transaction_number',
            'status',
            'cancellation_reason',
            'created_by',
            'created_at',
            'updated_at',
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def validate_amount(self, value):
        if value is None or value <= Decimal('0.00'):
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        wallet = attrs.get('wallet')
        txn_type = attrs.get('transaction_type')
        amount = attrs.get('amount')

        # Creation validation
        if not self.instance:
            if wallet and wallet.status != 'Active':
                raise serializers.ValidationError({
                    'wallet': f"Wallet '{wallet.wallet_name}' is inactive. Inactive wallets cannot be used for new transactions."
                })

            if txn_type == 'Debit' and wallet and amount:
                # Calculate authoritative current balance
                current_balance = wallet.get_balance()
                if current_balance < amount:
                    raise serializers.ValidationError({
                        'amount': f"Insufficient balance. Available wallet balance is Rs.{current_balance:.2f}, but requested debit is Rs.{amount:.2f}."
                    })

        return attrs

    def create(self, validated_data):
        # Auto-generate unique sequential transaction number: TXN-YYYYMMDD-XXXX
        today_str = timezone.now().strftime('%Y%m%d')
        prefix = f"TXN-{today_str}-"

        # Thread-safe sequence inside transaction
        last_txn = WalletTransaction.objects.filter(
            transaction_number__startswith=prefix
        ).order_by('-transaction_number').first()

        if last_txn:
            try:
                last_seq = int(last_txn.transaction_number.split('-')[-1])
                seq_num = last_seq + 1
            except (ValueError, IndexError):
                seq_num = WalletTransaction.objects.filter(transaction_number__startswith=prefix).count() + 1
        else:
            seq_num = 1

        validated_data['transaction_number'] = f"{prefix}{seq_num:04d}"

        # Assign request user if authenticated
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            validated_data['created_by'] = request.user

        return super().create(validated_data)


class WalletOwnerTypeSerializer(serializers.ModelSerializer):
    points_entries_count = serializers.SerializerMethodField()

    class Meta:
        model = WalletOwnerType
        fields = [
            'id',
            'owner_type',
            'description',
            'status',
            'points_entries_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'points_entries_count', 'created_at', 'updated_at']

    def get_points_entries_count(self, obj):
        from .models import WalletPointsEntry
        return WalletPointsEntry.objects.filter(wallet__owner_type__iexact=obj.owner_type).count()

    def validate_owner_type(self, value):
        name = (value or '').strip()
        if not name:
            raise serializers.ValidationError("Owner Type name is required.")
        qs = WalletOwnerType.objects.filter(owner_type__iexact=name)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f"Owner Type '{name}' already exists.")
        return name


class WalletReasonSerializer(serializers.ModelSerializer):
    points_entries_count = serializers.SerializerMethodField()

    class Meta:
        model = WalletReason
        fields = [
            'id',
            'reason',
            'description',
            'status',
            'points_entries_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'points_entries_count', 'created_at', 'updated_at']

    def get_points_entries_count(self, obj):
        from .models import WalletPointsEntry
        return WalletPointsEntry.objects.filter(reason__iexact=obj.reason).count()

    def validate_reason(self, value):
        name = (value or '').strip()
        if not name:
            raise serializers.ValidationError("Reason name is required.")
        qs = WalletReason.objects.filter(reason__iexact=name)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f"Reason '{name}' already exists.")
        return name

    def validate_description(self, value):
        if value:
            return value.strip()
        return value


class WalletSchemeCriteriaSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()
    product_code = serializers.SerializerMethodField()
    scheme_name = serializers.CharField(source='scheme.name', read_only=True)
    id = serializers.IntegerField(required=False)

    class Meta:
        model = WalletSchemeCriteria
        fields = [
            'id',
            'scheme',
            'scheme_name',
            'criteria_group',
            'product',
            'product_name',
            'product_code',
            'percentage',
            'value',
            'quantity',
            'points',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['scheme_name', 'product_name', 'product_code', 'created_at', 'updated_at']
        extra_kwargs = {
            'scheme': {'required': False},
            'criteria_group': {'required': False},
            'product': {'required': True, 'allow_null': False}
        }

    def get_product_name(self, obj):
        return obj.product.name if obj.product else None

    def get_product_code(self, obj):
        return obj.product.item_code if obj.product else None

    def validate_product(self, value):
        if not value:
            raise serializers.ValidationError("Product ID is required for every criteria row.")
        return value

    def validate_percentage(self, value):
        if value is not None and (value < 0 or value > 100):
            raise serializers.ValidationError("Percentage must be between 0 and 100.")
        return value if value is not None else Decimal('0.00')

    def validate_value(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Value cannot be negative.")
        return value if value is not None else Decimal('0.00')

    def validate_quantity(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Quantity cannot be negative.")
        return value if value is not None else Decimal('0.00')

    def validate_points(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Points cannot be negative.")
        return value if value is not None else Decimal('0.00')


class WalletCriteriaValueSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()
    product_code = serializers.SerializerMethodField()
    scheme_name = serializers.CharField(source='scheme.name', read_only=True)
    id = serializers.IntegerField(required=False)

    class Meta:
        model = WalletCriteriaValue
        fields = [
            'id',
            'scheme',
            'scheme_name',
            'product',
            'product_name',
            'product_code',
            'value',
            'discount_percentage',
            'discount_value',
            'points',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['scheme_name', 'product_name', 'product_code', 'created_at', 'updated_at']
        extra_kwargs = {
            'scheme': {'required': False},
            'product': {'required': True, 'allow_null': False}
        }

    def get_product_name(self, obj):
        return obj.product.name if obj.product else None

    def get_product_code(self, obj):
        return obj.product.item_code if obj.product else None

    def to_internal_value(self, data):
        # Handle aliases between frontend field names
        if isinstance(data, dict):
            mutable = data.copy()
            if 'discount_percentage' not in mutable and 'percentage' in mutable:
                mutable['discount_percentage'] = mutable['percentage']
            if 'discount_value' not in mutable:
                if 'discount_val' in mutable:
                    mutable['discount_value'] = mutable['discount_val']
                elif 'quantity' in mutable and 'value' in mutable:
                    mutable['discount_value'] = mutable['quantity']
            data = mutable
        return super().to_internal_value(data)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Compatibility aliases for frontend
        ret['percentage'] = ret.get('discount_percentage')
        return ret

    def validate_product(self, value):
        if not value:
            raise serializers.ValidationError("Product ID is required for every criteria row.")
        return value

    def validate_value(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Value cannot be negative.")
        return value if value is not None else Decimal('0.00')

    def validate_discount_percentage(self, value):
        if value is not None and (value < 0 or value > 100):
            raise serializers.ValidationError("Discount Percentage must be between 0 and 100.")
        return value if value is not None else Decimal('0.00')

    def validate_discount_value(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Discount Value cannot be negative.")
        return value if value is not None else Decimal('0.00')

    def validate_points(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Points cannot be negative.")
        return value if value is not None else Decimal('0.00')


class WalletSchemeSerializer(serializers.ModelSerializer):
    criteria_rows = WalletSchemeCriteriaSerializer(many=True, required=False)
    criteria_values = WalletCriteriaValueSerializer(many=True, required=False)
    criteria_rows_2 = WalletCriteriaValueSerializer(many=True, required=False)
    criteria_list = WalletSchemeCriteriaSerializer(source='criteria_rows', many=True, read_only=True)
    total_criteria_points = serializers.SerializerMethodField()
    effective_status = serializers.CharField(read_only=True)
    is_expired = serializers.SerializerMethodField()
    is_currently_active = serializers.SerializerMethodField()

    points_entries_count = serializers.SerializerMethodField()

    class Meta:
        model = WalletScheme
        fields = [
            'id',
            'name',
            'start_date',
            'end_date',
            'status',
            'criteria_type',
            'is_consolidated',
            'effective_status',
            'is_expired',
            'is_currently_active',
            'points_entries_count',
            'remarks',
            'criteria',
            'criteria_rows',
            'criteria_values',
            'criteria_rows_2',
            'criteria_list',
            'total_criteria_points',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'effective_status', 'is_expired', 'is_currently_active', 'points_entries_count', 'criteria_list', 'total_criteria_points', 'created_at', 'updated_at']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        c_type = instance.criteria_type or 'Quantity'
        q_rows = instance.criteria_rows.filter(criteria_group='criteria').select_related('product') if c_type in ['Quantity', 'Both'] else []
        v_rows = instance.criteria_values.all().select_related('product') if c_type in ['Value', 'Both'] else []
        q_data = WalletSchemeCriteriaSerializer(q_rows, many=True).data if q_rows else []
        val_data = WalletCriteriaValueSerializer(v_rows, many=True).data if v_rows else []
        ret['criteria_rows'] = q_data
        ret['criteria_values'] = val_data
        ret['criteria_rows_2'] = val_data
        # Provide unified criteria_list containing only active criteria matching criteria_type
        for q in q_data:
            q['group_label'] = 'Qty Based'
        for v in val_data:
            v['group_label'] = 'Val Based'
        ret['criteria_list'] = q_data + val_data
        return ret

    def get_points_entries_count(self, obj):
        return obj.points_entries.count()

    def get_is_expired(self, obj):
        return obj.is_expired()

    def get_is_currently_active(self, obj):
        return obj.is_currently_active()

    def validate_name(self, value):
        name = (value or '').strip()
        if not name:
            raise serializers.ValidationError("Scheme name is required.")

        # Disallow duplicate scheme names (case-insensitive)
        qs = WalletScheme.objects.filter(name__iexact=name)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f"A scheme with the name '{name}' already exists.")

        return name

    def validate_criteria(self, value):
        return (value or '').strip()

    def validate_remarks(self, value):
        if value is None:
            return ""
        return value.strip()

    def validate(self, attrs):
        attrs = super().validate(attrs)
        start_date = attrs.get('start_date') or (self.instance.start_date if self.instance else None)
        end_date = attrs.get('end_date') or (self.instance.end_date if self.instance else None)

        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({
                'end_date': "End Date cannot be earlier than Start Date."
            })

        # Rule: An expired scheme must not become active again merely because its status is manually changed to Active.
        today = get_wallet_local_date()
        new_status = attrs.get('status')
        current_status = self.instance.status if self.instance else 'Active'
        status_to_check = new_status if new_status is not None else current_status

        if status_to_check == 'Active' and end_date and end_date < today:
            raise serializers.ValidationError({
                'status': f"Cannot set status to Active. The scheme expired on {end_date.strftime('%d-%m-%Y')}. Please extend the End Date first to activate."
            })

        # Mandatory Criteria validation:
        criteria_type = attrs.get('criteria_type') or (self.instance.criteria_type if self.instance else 'Quantity')
        criteria_rows = attrs.get('criteria_rows')
        criteria_values = attrs.get('criteria_values')
        if criteria_values is None and 'criteria_rows_2' in attrs:
            criteria_values = attrs.get('criteria_rows_2')
            attrs['criteria_values'] = criteria_values

        is_qty_req = criteria_type in ['Quantity', 'Both']
        is_val_req = criteria_type in ['Value', 'Both']

        if not self.instance:
            # Creation mode
            if is_qty_req and (criteria_rows is None or len(criteria_rows) == 0):
                raise serializers.ValidationError({
                    'criteria': "Please add at least one valid criteria row in Quantity Based Criteria before saving the scheme."
                })
            if is_val_req and (criteria_values is None or len(criteria_values) == 0):
                raise serializers.ValidationError({
                    'criteria_2': "Please add at least one valid criteria row in Value Based Criteria before saving the scheme."
                })
        else:
            # Update mode
            if is_qty_req:
                if criteria_rows is not None and len(criteria_rows) == 0:
                    raise serializers.ValidationError({
                        'criteria': "Please add at least one valid criteria row in Quantity Based Criteria before saving the scheme."
                    })
                elif criteria_rows is None and not self.instance.criteria_rows.filter(criteria_group='criteria').exists():
                    raise serializers.ValidationError({
                        'criteria': "Please add at least one valid criteria row in Quantity Based Criteria before saving the scheme."
                    })

            if is_val_req:
                if criteria_values is not None and len(criteria_values) == 0:
                    raise serializers.ValidationError({
                        'criteria_2': "Please add at least one valid criteria row in Value Based Criteria before saving the scheme."
                    })
                elif criteria_values is None and not self.instance.criteria_values.exists():
                    raise serializers.ValidationError({
                        'criteria_2': "Please add at least one valid criteria row in Value Based Criteria before saving the scheme."
                    })

        # Ensure every criteria row in Tab 1 (Quantity) has a selected product if quantity criteria is provided
        if criteria_rows and is_qty_req:
            for idx, row in enumerate(criteria_rows):
                if not row.get('product'):
                    raise serializers.ValidationError({
                        'criteria': f"Quantity Criteria Row {idx + 1}: Please select a Product ID."
                    })

        # Ensure every criteria row in Tab 2 (Value) has a selected product if value criteria is provided
        if criteria_values and is_val_req:
            for idx, row in enumerate(criteria_values):
                if not row.get('product'):
                    raise serializers.ValidationError({
                        'criteria_2': f"Value Criteria Row {idx + 1}: Please select a Product ID."
                    })

        return attrs

    def create(self, validated_data):
        criteria_rows_data = validated_data.pop('criteria_rows', [])
        criteria_values_data = validated_data.pop('criteria_values', None)
        if criteria_values_data is None:
            criteria_values_data = validated_data.pop('criteria_rows_2', [])
        else:
            validated_data.pop('criteria_rows_2', None)

        with transaction.atomic():
            scheme = WalletScheme.objects.create(**validated_data)
            for row in criteria_rows_data:
                row.pop('id', None)
                row['criteria_group'] = 'criteria'
                WalletSchemeCriteria.objects.create(scheme=scheme, **row)
            for row in criteria_values_data:
                row.pop('id', None)
                WalletCriteriaValue.objects.create(scheme=scheme, **row)
        return scheme

    def update(self, instance, validated_data):
        criteria_rows_data = validated_data.pop('criteria_rows', None)
        criteria_values_data = validated_data.pop('criteria_values', None)
        if criteria_values_data is None and 'criteria_rows_2' in validated_data:
            criteria_values_data = validated_data.pop('criteria_rows_2')
        else:
            validated_data.pop('criteria_rows_2', None)

        with transaction.atomic():
            for attr, val in validated_data.items():
                setattr(instance, attr, val)
            instance.save()

            # Handle Quantity-based criteria rows (wallet_scheme_criteria, criteria_group='criteria')
            if criteria_rows_data is not None:
                existing_q = {r.id: r for r in instance.criteria_rows.filter(criteria_group='criteria')}
                kept_q_ids = set()

                for row in criteria_rows_data:
                    row_id = row.get('id')
                    if row_id and row_id in existing_q:
                        c_inst = existing_q[row_id]
                        c_inst.product = row.get('product')
                        c_inst.percentage = row.get('percentage', Decimal('0.00'))
                        c_inst.value = row.get('value', Decimal('0.00'))
                        c_inst.quantity = row.get('quantity', Decimal('0.00'))
                        c_inst.points = row.get('points', Decimal('0.00'))
                        c_inst.criteria_group = 'criteria'
                        c_inst.save()
                        kept_q_ids.add(row_id)
                    else:
                        row.pop('id', None)
                        row['criteria_group'] = 'criteria'
                        new_row = WalletSchemeCriteria.objects.create(scheme=instance, **row)
                        kept_q_ids.add(new_row.id)

                for r_id, r in existing_q.items():
                    if r_id not in kept_q_ids:
                        r.delete()

            # Clean up any legacy criteria_2 in wallet_scheme_criteria
            instance.criteria_rows.filter(criteria_group='criteria_2').delete()

            # Handle Value-based criteria rows (wallet_criteria_values)
            if criteria_values_data is not None:
                existing_v = {r.id: r for r in instance.criteria_values.all()}
                kept_v_ids = set()

                for row in criteria_values_data:
                    row_id = row.get('id')
                    if row_id and row_id in existing_v:
                        v_inst = existing_v[row_id]
                        v_inst.product = row.get('product')
                        v_inst.value = row.get('value', Decimal('0.00'))
                        v_inst.discount_percentage = row.get('discount_percentage', Decimal('0.00'))
                        v_inst.discount_value = row.get('discount_value', Decimal('0.00'))
                        v_inst.points = row.get('points', Decimal('0.00'))
                        v_inst.save()
                        kept_v_ids.add(row_id)
                    else:
                        row.pop('id', None)
                        new_row = WalletCriteriaValue.objects.create(scheme=instance, **row)
                        kept_v_ids.add(new_row.id)

                for r_id, r in existing_v.items():
                    if r_id not in kept_v_ids:
                        r.delete()

        return instance

    def get_total_criteria_points(self, obj):
        c_type = obj.criteria_type or 'Quantity'
        pts = Decimal('0.00')
        if c_type in ['Quantity', 'Both']:
            pts += sum((c.points or Decimal('0.00')) for c in obj.criteria_rows.filter(criteria_group='criteria'))
        if c_type in ['Value', 'Both']:
            pts += sum((v.points or Decimal('0.00')) for v in obj.criteria_values.all())
        return f"{pts:.2f}"


class WalletPointsEntrySerializer(serializers.ModelSerializer):
    wallet_name = serializers.CharField(source='wallet.wallet_name', read_only=True)
    wallet_code = serializers.CharField(source='wallet.wallet_code', read_only=True)
    scheme_name = serializers.CharField(source='scheme.name', read_only=True)
    scheme_is_consolidated = serializers.BooleanField(source='scheme.is_consolidated', read_only=True, default=False)
    created_by_name = serializers.SerializerMethodField()

    PERMITTED_REASONS = [
        'Reward / Incentive',
        'Purchase credit',
        'Bulk allocation',
        'Refund / Reversal',
        'Manual adjustment',
    ]

    class Meta:
        model = WalletPointsEntry
        fields = [
            'id',
            'entry_number',
            'wallet',
            'wallet_name',
            'wallet_code',
            'scheme',
            'scheme_name',
            'scheme_is_consolidated',
            'entry_type',
            'points',
            'reason',
            'reference_no',
            'entry_date',
            'remarks',
            'balance_before',
            'balance_after',
            'created_by',
            'created_by_name',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'entry_number',
            'balance_before',
            'balance_after',
            'created_by',
            'created_at',
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def validate_points(self, value):
        if value is None or value <= Decimal('0.00'):
            raise serializers.ValidationError("Points must be a positive quantity greater than zero.")
        return value

    def validate_entry_type(self, value):
        if value not in ['Addition', 'Deduction']:
            raise serializers.ValidationError("Entry type must be either 'Addition' or 'Deduction'.")
        return value

    def validate_reason(self, value):
        if not value:
            raise serializers.ValidationError("Reason is required.")
        # Check active reasons from WalletReason master
        try:
            active_reasons = set(
                WalletReason.objects.filter(status='Active').values_list('reason', flat=True)
            )
        except Exception:
            active_reasons = set()

        all_valid_reasons = active_reasons.union(set(self.PERMITTED_REASONS))
        if value not in all_valid_reasons:
            # Case-insensitive check
            matching = [r for r in all_valid_reasons if r.lower() == value.strip().lower()]
            if matching:
                return matching[0]
            raise serializers.ValidationError(
                f"Reason '{value}' is not a valid active reason in the Wallet Reason master."
            )
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        wallet = attrs.get('wallet')
        entry_type = attrs.get('entry_type')
        points = attrs.get('points')

        if wallet and wallet.status != 'Active':
            raise serializers.ValidationError({
                'wallet': f"Wallet '{wallet.wallet_name}' is inactive and cannot accept points entries."
            })

        if entry_type == 'Deduction' and wallet and points:
            current_balance = wallet.get_balance()
            if current_balance < points:
                raise serializers.ValidationError({
                    'points': f"Insufficient balance. Current available balance is {current_balance:.2f} points, but requested deduction is {points:.2f} points."
                })

        # Scheme expiry and validity validation
        scheme = attrs.get('scheme')
        entry_date = attrs.get('entry_date') or get_wallet_local_date()
        today = get_wallet_local_date()

        if scheme:
            # 1. Manual deactivation check
            if scheme.status != 'Active':
                raise serializers.ValidationError({
                    'scheme': f"Scheme '{scheme.name}' is inactive and cannot be used for new transactions."
                })

            # 2. Expiry check: today or entry_date past end_date
            if today > scheme.end_date or entry_date > scheme.end_date:
                raise serializers.ValidationError({
                    'scheme': f"Scheme '{scheme.name}' expired on {scheme.end_date.strftime('%d-%m-%Y')} and cannot be selected for new transactions."
                })

            # 3. Upcoming check: today or entry_date before start_date
            if today < scheme.start_date or entry_date < scheme.start_date:
                raise serializers.ValidationError({
                    'scheme': f"Scheme '{scheme.name}' is not yet active (valid from {scheme.start_date.strftime('%d-%m-%Y')})."
                })

        return attrs


class WalletWorkingSettingsSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = WalletWorkingSettings
        fields = [
            'id',
            'inactivity_timeout_minutes',
            'confirmation_countdown_seconds',
            'idle_threshold_minutes',
            'check_interval_seconds',
            'heartbeat_timeout_minutes',
            'break_tracking_enabled',
            'break_start_behavior',
            'monitoring_enabled',
            'updated_by',
            'updated_by_name',
            'updated_at',
        ]
        read_only_fields = ['id', 'updated_by', 'updated_by_name', 'updated_at']

    def get_updated_by_name(self, obj):
        if obj.updated_by:
            full_name = f"{obj.updated_by.first_name} {obj.updated_by.last_name}".strip()
            return full_name or obj.updated_by.username or obj.updated_by.email
        return None

    def validate_idle_threshold_minutes(self, value):
        if value is None or value < 1:
            raise serializers.ValidationError("Idle threshold must be at least 1 minute.")
        if value > 1440:
            raise serializers.ValidationError("Idle threshold cannot exceed 1440 minutes (24 hours).")
        return value

    def validate_check_interval_seconds(self, value):
        if value is None or value < 5:
            raise serializers.ValidationError("Check interval must be at least 5 seconds.")
        if value > 3600:
            raise serializers.ValidationError("Check interval cannot exceed 3600 seconds.")
        return value

    def validate_heartbeat_timeout_minutes(self, value):
        if value is None or value < 1:
            raise serializers.ValidationError("Heartbeat timeout must be at least 1 minute.")
        if value > 1440:
            raise serializers.ValidationError("Heartbeat timeout cannot exceed 1440 minutes.")
        return value


class EmployeeWorkingStatusSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_email = serializers.SerializerMethodField()
    connection_status = serializers.SerializerMethodField()
    is_online = serializers.SerializerMethodField()
    effective_idle_threshold_minutes = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeWorkingStatus
        fields = [
            'id',
            'user',
            'user_name',
            'user_email',
            'status',
            'last_change',
            'last_activity_at',
            'last_heartbeat_at',
            'device_identifier',
            'agent_version',
            'custom_idle_threshold_minutes',
            'effective_idle_threshold_minutes',
            'connection_status',
            'is_online',
            'updated_at',
        ]
        read_only_fields = ['id', 'user', 'user_name', 'user_email', 'effective_idle_threshold_minutes', 'connection_status', 'is_online', 'updated_at']

    def get_user_name(self, obj):
        if obj.user:
            full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return full_name or obj.user.username or obj.user.email
        return None

    def get_user_email(self, obj):
        return obj.user.email if obj.user else None

    def get_effective_idle_threshold_minutes(self, obj):
        if obj.custom_idle_threshold_minutes is not None:
            return obj.custom_idle_threshold_minutes
        settings_obj = self.context.get('settings')
        if settings_obj and hasattr(settings_obj, 'idle_threshold_minutes'):
            return settings_obj.idle_threshold_minutes
        return 10

    def get_connection_status(self, obj):
        timeout_minutes = getattr(self.context.get('settings'), 'heartbeat_timeout_minutes', 15)
        return obj.connection_status(timeout_minutes=timeout_minutes)

    def get_is_online(self, obj):
        timeout_minutes = getattr(self.context.get('settings'), 'heartbeat_timeout_minutes', 15)
        return obj.is_online(timeout_minutes=timeout_minutes)


class WorkingStatusHistorySerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_email = serializers.SerializerMethodField()

    class Meta:
        model = WorkingStatusHistory
        fields = [
            'id',
            'user',
            'user_name',
            'user_email',
            'status',
            'changed_at',
            'last_activity_at',
            'device_identifier',
            'created_at',
        ]
        read_only_fields = ['id', 'user', 'user_name', 'user_email', 'created_at']

    def get_user_name(self, obj):
        if obj.user:
            full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return full_name or obj.user.username or obj.user.email
        return None

    def get_user_email(self, obj):
        return obj.user.email if obj.user else None


class WorkingBreakSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_email = serializers.SerializerMethodField()

    class Meta:
        model = WorkingBreak
        fields = [
            'id',
            'user',
            'user_name',
            'user_email',
            'session',
            'break_start',
            'break_end',
            'duration_seconds',
            'threshold_minutes',
            'break_source',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'user', 'user_name', 'user_email', 'created_at', 'updated_at']

    def get_user_name(self, obj):
        if obj.user:
            full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return full_name or obj.user.username or obj.user.email
        return None

    def get_user_email(self, obj):
        return obj.user.email if obj.user else None


class WorkingSessionSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    active_break = serializers.SerializerMethodField()

    class Meta:
        model = WorkingSession
        fields = [
            'id',
            'user',
            'user_name',
            'session_start',
            'session_end',
            'status',
            'active_break',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'user', 'user_name', 'created_at', 'updated_at']

    def get_user_name(self, obj):
        if obj.user:
            full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return full_name or obj.user.username or obj.user.email
        return None

    def get_active_break(self, obj):
        active_b = obj.breaks.filter(status='Active').order_by('-created_at').first()
        if active_b:
            return WorkingBreakSerializer(active_b).data
        return None


class InactivityEventSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    seconds_remaining = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = InactivityEvent
        fields = [
            'id',
            'user',
            'user_name',
            'session',
            'prompt_time',
            'response_deadline',
            'response_time',
            'outcome',
            'related_break',
            'seconds_remaining',
            'is_expired',
            'created_at',
        ]
        read_only_fields = ['id', 'user', 'user_name', 'seconds_remaining', 'is_expired', 'created_at']

    def get_user_name(self, obj):
        if obj.user:
            full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return full_name or obj.user.username or obj.user.email
        return None

    def get_seconds_remaining(self, obj):
        if not obj.response_deadline or obj.outcome != 'PENDING':
            return 0
        diff = (obj.response_deadline - timezone.now()).total_seconds()
        return max(0, int(diff))

    def get_is_expired(self, obj):
        if not obj.response_deadline:
            return False
        return timezone.now() > obj.response_deadline


class ScreenshotExecutionSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_email = serializers.SerializerMethodField()
    screenshot_url = serializers.SerializerMethodField()

    class Meta:
        model = ScreenshotExecution
        fields = [
            'id',
            'schedule',
            'user',
            'user_name',
            'user_email',
            'scheduled_date',
            'scheduled_time',
            'scheduled_datetime',
            'executed_at',
            'status',
            'screenshot_file',
            'screenshot_url',
            'error_message',
            'capture_source',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

    def get_user_name(self, obj):
        if obj.user:
            name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return name or obj.user.username or obj.user.email
        return None

    def get_user_email(self, obj):
        return obj.user.email if obj.user else None

    def get_screenshot_url(self, obj):
        if obj.screenshot_file:
            request = self.context.get('request')
            path = f"/api/wallet/calendar/{obj.id}/view-screenshot/"
            if request:
                return request.build_absolute_uri(path)
            return path
        return None


class ScreenshotScheduleSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    latest_execution = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    screenshot_url = serializers.SerializerMethodField()
    error_message = serializers.SerializerMethodField()

    class Meta:
        model = ScreenshotSchedule
        fields = [
            'id',
            'user',
            'user_name',
            'scheduled_date',
            'scheduled_time',
            'is_active',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
            'latest_execution',
            'status',
            'screenshot_url',
            'error_message',
        ]
        read_only_fields = ['id', 'user', 'created_by', 'created_at', 'updated_at']

    def get_user_name(self, obj):
        if obj.user:
            name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return name or obj.user.username or obj.user.email
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            name = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
            return name or obj.created_by.username or obj.created_by.email
        return None

    def _get_execution(self, obj):
        if not hasattr(obj, '_cached_execution'):
            # Prefer Captured execution if one exists for this schedule occurrence
            captured = obj.executions.filter(status='Captured').order_by('-executed_at', '-created_at').first()
            if captured:
                obj._cached_execution = captured
            else:
                obj._cached_execution = obj.executions.order_by('-executed_at', '-created_at').first()
        return obj._cached_execution

    def get_latest_execution(self, obj):
        exec_obj = self._get_execution(obj)
        if exec_obj:
            return ScreenshotExecutionSerializer(exec_obj, context=self.context).data
        return None

    def get_status(self, obj):
        exec_obj = self._get_execution(obj)
        if exec_obj:
            return exec_obj.status

        # If no execution recorded yet, calculate whether it is upcoming or missed
        today = get_wallet_local_date()
        now_time = get_wallet_local_time()
        if obj.scheduled_date < today:
            return 'Missed'
        elif obj.scheduled_date == today:
            # If scheduled time passed by more than 15 minutes, consider it missed
            from datetime import datetime, timedelta
            sched_dt = datetime.combine(today, obj.scheduled_time)
            cur_dt = datetime.combine(today, now_time)
            if cur_dt > sched_dt + timedelta(minutes=15):
                return 'Missed'
        return 'Scheduled'

    def get_screenshot_url(self, obj):
        exec_obj = self._get_execution(obj)
        if exec_obj and exec_obj.screenshot_file:
            request = self.context.get('request')
            path = f"/api/wallet/calendar/{exec_obj.id}/view-screenshot/"
            if request:
                return request.build_absolute_uri(path)
            return path
        return None

    def get_error_message(self, obj):
        exec_obj = self._get_execution(obj)
        if exec_obj:
            return exec_obj.error_message
        return None

    def validate(self, data):
        req = self.context.get('request')
        user = data.get('user') or (self.instance.user if self.instance else None) or (req.user if req and req.user.is_authenticated else None)
        scheduled_date = data.get('scheduled_date') or (self.instance.scheduled_date if self.instance else None)
        scheduled_time = data.get('scheduled_time') or (self.instance.scheduled_time if self.instance else None)

        if not scheduled_date:
            raise serializers.ValidationError({"scheduled_date": "Scheduled date is required."})
        if not scheduled_time:
            raise serializers.ValidationError({"scheduled_time": "Scheduled time is required."})

        # Check for duplicates
        qs = ScreenshotSchedule.objects.filter(
            user=user,
            scheduled_date=scheduled_date,
            scheduled_time=scheduled_time,
            is_active=True
        )
        if self.instance:
            qs = qs.exclude(id=self.instance.id)

        if qs.exists():
            formatted_time = scheduled_time.strftime('%I:%M %p') if hasattr(scheduled_time, 'strftime') else str(scheduled_time)
            raise serializers.ValidationError({
                "scheduled_time": f"A screenshot schedule already exists at {formatted_time} on {scheduled_date}."
            })

        return data


class ApplyAllSerializer(serializers.Serializer):
    source_date = serializers.DateField(required=True)
    scope = serializers.ChoiceField(choices=['month', 'year', 'future'], default='month')
    conflict_mode = serializers.ChoiceField(choices=['merge', 'replace'], default='merge')
    target_month = serializers.IntegerField(required=False, min_value=1, max_value=12)
    target_year = serializers.IntegerField(required=False, min_value=2000, max_value=2100)


