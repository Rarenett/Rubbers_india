from rest_framework import serializers
from payroll_app.models import (
    PayrollUnit,
    PayrollCompoundUnit,
    AttendanceProductionType,
    CalculationType,
    PayHead,
    PayHeadComputation,
    PayHeadComputationSlab,
    PayHeadComputationFormulaItem,
    EmployeePayHead,
)

class PayrollUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollUnit
        fields = ['id', 'symbol', 'formal_name', 'decimals', 'is_active']


class PayrollCompoundUnitSerializer(serializers.ModelSerializer):
    compound_unit_name = serializers.CharField(source='compound_unit.formal_name', read_only=True)
    compound_unit_symbol = serializers.CharField(source='compound_unit.symbol', read_only=True)
    base_unit_name = serializers.CharField(source='base_unit.formal_name', read_only=True)
    base_unit_symbol = serializers.CharField(source='base_unit.symbol', read_only=True)

    class Meta:
        model = PayrollCompoundUnit
        fields = [
            'id', 'compound_unit', 'base_unit', 'conversion_factor', 'is_active',
            'compound_unit_name', 'compound_unit_symbol', 'base_unit_name', 'base_unit_symbol'
        ]


class AttendanceProductionTypeSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    period_type_display = serializers.CharField(source='get_period_type_display', read_only=True)
    payroll_unit_name = serializers.CharField(source='payroll_unit.formal_name', read_only=True)
    payroll_unit_symbol = serializers.CharField(source='payroll_unit.symbol', read_only=True)
    compound_unit_display = serializers.SerializerMethodField()

    def get_compound_unit_display(self, obj):
        if obj.compound_unit:
            cu = obj.compound_unit.compound_unit
            bu = obj.compound_unit.base_unit
            cf = obj.compound_unit.conversion_factor
            cf_val = int(cf) if cf == int(cf) else f"{cf:g}"
            return f"1 {cu.symbol} = {cf_val} {bu.symbol}"
        return None

    class Meta:
        model = AttendanceProductionType
        fields = [
            'id', 'name', 'type', 'type_display',
            'period_type', 'period_type_display',
            'payroll_unit', 'payroll_unit_name', 'payroll_unit_symbol',
            'compound_unit', 'compound_unit_display',
            'is_active'
        ]


class CalculationTypeSerializer(serializers.ModelSerializer):
    payroll_units = serializers.PrimaryKeyRelatedField(
        many=True, queryset=PayrollUnit.objects.all(), required=False
    )
    payroll_units_details = PayrollUnitSerializer(source='payroll_units', many=True, read_only=True)
    attendance_production_types = serializers.PrimaryKeyRelatedField(
        many=True, queryset=AttendanceProductionType.objects.all(), required=False
    )
    attendance_production_types_details = AttendanceProductionTypeSerializer(
        source='attendance_production_types', many=True, read_only=True
    )

    class Meta:
        model = CalculationType
        fields = [
            'id',
            'name',
            'is_calculation_period_required',
            'payroll_units',
            'payroll_units_details',
            'attendance_production_types',
            'attendance_production_types_details',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class PayHeadComputationSlabSerializer(serializers.ModelSerializer):
    slab_type_display = serializers.CharField(source='get_slab_type_display', read_only=True)

    class Meta:
        model = PayHeadComputationSlab
        fields = [
            'id',
            'effective_from',
            'amount_greater_than',
            'amount_up_to',
            'slab_type',
            'slab_type_display',
            'value',
            'order',
        ]


class PayHeadComputationFormulaItemSerializer(serializers.ModelSerializer):
    function_display = serializers.CharField(source='get_function_display', read_only=True)
    pay_head_name = serializers.CharField(source='pay_head.name', read_only=True, default=None)
    attendance_type_name = serializers.CharField(source='attendance_type.name', read_only=True, default=None)

    class Meta:
        model = PayHeadComputationFormulaItem
        fields = [
            'id',
            'function',
            'function_display',
            'pay_head',
            'pay_head_name',
            'attendance_type',
            'attendance_type_name',
            'order',
        ]


class PayHeadComputationSerializer(serializers.ModelSerializer):
    compute_method_display = serializers.CharField(source='get_compute_method_display', read_only=True)
    slabs = PayHeadComputationSlabSerializer(many=True, required=False)
    formula_items = PayHeadComputationFormulaItemSerializer(many=True, required=False)

    class Meta:
        model = PayHeadComputation
        fields = [
            'id',
            'compute_method',
            'compute_method_display',
            'formula_items',
            'slabs',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class PayHeadSerializer(serializers.ModelSerializer):
    pay_head_type_display = serializers.CharField(source='get_pay_head_type_display', read_only=True)
    income_type_display = serializers.CharField(source='get_income_type_display', read_only=True)
    calculation_type_name = serializers.CharField(source='calculation_type.name', read_only=True, default=None)
    calculation_type_display = serializers.CharField(source='calculation_type.name', read_only=True, default=None)
    calculation_period_symbol = serializers.CharField(source='calculation_period.symbol', read_only=True, default=None)
    calculation_period_formal_name = serializers.CharField(source='calculation_period.formal_name', read_only=True, default=None)
    calculation_period_display = serializers.SerializerMethodField()
    under_name = serializers.CharField(source='under.name', read_only=True, default=None)
    attendance_production_type_name = serializers.CharField(source='attendance_production_type.name', read_only=True, default=None)
    attendance_production_type_unit = serializers.SerializerMethodField()
    production_type_unit = serializers.SerializerMethodField()
    computation_method = serializers.CharField(source='computation.compute_method', read_only=True, default=None)
    computation_method_display = serializers.CharField(source='computation.get_compute_method_display', read_only=True, default=None)
    created_by_name = serializers.SerializerMethodField()
    computation = PayHeadComputationSerializer(required=False, allow_null=True)

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_calculation_period_display(self, obj):
        if obj.calculation_period:
            return f"{obj.calculation_period.formal_name} ({obj.calculation_period.symbol})"
        return None

    def get_attendance_production_type_unit(self, obj):
        if obj.attendance_production_type:
            apt = obj.attendance_production_type
            if apt.payroll_unit:
                return apt.payroll_unit.symbol or apt.payroll_unit.formal_name or ''
            if apt.compound_unit and apt.compound_unit.compound_unit:
                return apt.compound_unit.compound_unit.symbol or apt.compound_unit.compound_unit.formal_name or ''
        return None

    def get_production_type_unit(self, obj):
        return self.get_attendance_production_type_unit(obj)

    def create(self, validated_data):
        computation_data = validated_data.pop('computation', None)
        pay_head = super().create(validated_data)
        if computation_data:
            slabs_data = computation_data.pop('slabs', [])
            formula_items_data = computation_data.pop('formula_items', [])
            comp = PayHeadComputation.objects.create(pay_head=pay_head, **computation_data)
            for idx, s_data in enumerate(slabs_data):
                order = s_data.pop('order', idx)
                PayHeadComputationSlab.objects.create(computation=comp, order=order, **s_data)
            for idx, f_data in enumerate(formula_items_data):
                order = f_data.pop('order', idx)
                PayHeadComputationFormulaItem.objects.create(computation=comp, order=order, **f_data)
        return pay_head

    def update(self, instance, validated_data):
        computation_data = validated_data.pop('computation', None)
        pay_head = super().update(instance, validated_data)
        if computation_data is not None:
            slabs_data = computation_data.pop('slabs', [])
            formula_items_data = computation_data.pop('formula_items', [])
            comp, _ = PayHeadComputation.objects.get_or_create(
                pay_head=pay_head,
                defaults={'compute_method': computation_data.get('compute_method', 'on_current_earnings_total')}
            )
            if 'compute_method' in computation_data:
                comp.compute_method = computation_data['compute_method']
                comp.save()
            comp.slabs.all().delete()
            for idx, s_data in enumerate(slabs_data):
                order = s_data.pop('order', idx)
                PayHeadComputationSlab.objects.create(computation=comp, order=order, **s_data)
            comp.formula_items.all().delete()
            for idx, f_data in enumerate(formula_items_data):
                order = f_data.pop('order', idx)
                PayHeadComputationFormulaItem.objects.create(computation=comp, order=order, **f_data)
        return pay_head

    class Meta:
        model = PayHead
        fields = [
            'id',
            'name',
            'pay_head_type',
            'pay_head_type_display',
            'income_type',
            'income_type_display',
            'under',
            'under_name',
            'affect_net_salary',
            'use_for_gratuity',
            'calculation_type',
            'calculation_type_name',
            'calculation_type_display',
            'calculation_period',
            'calculation_period_symbol',
            'calculation_period_formal_name',
            'calculation_period_display',
            'attendance_production_type',
            'attendance_production_type_name',
            'attendance_production_type_unit',
            'production_type_unit',
            'computation',
            'computation_method',
            'computation_method_display',
            'is_active',
            'created_at',
            'created_by',
            'created_by_name',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']


class EmployeePayHeadSerializer(serializers.ModelSerializer):
    pay_head_name = serializers.CharField(source='pay_head.name', read_only=True)
    pay_head_type = serializers.CharField(source='pay_head.pay_head_type', read_only=True)
    pay_head_type_display = serializers.CharField(source='pay_head.get_pay_head_type_display', read_only=True)
    calculation_type_name = serializers.CharField(source='pay_head.calculation_type.name', read_only=True, default='')
    computed_on = serializers.SerializerMethodField()
    computation_method_display = serializers.SerializerMethodField()
    attendance_production_type_unit = serializers.SerializerMethodField()
    production_type_unit = serializers.SerializerMethodField()
    default_period = serializers.SerializerMethodField()

    class Meta:
        model = EmployeePayHead
        fields = [
            'id',
            'employee',
            'effective_from',
            'pay_head',
            'pay_head_name',
            'rate',
            'per',
            'order',
            'pay_head_type',
            'pay_head_type_display',
            'calculation_type_name',
            'computed_on',
            'computation_method_display',
            'attendance_production_type_unit',
            'production_type_unit',
            'default_period',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_computed_on(self, obj):
        if hasattr(obj.pay_head, 'computation') and obj.pay_head.computation:
            return obj.pay_head.computation.get_compute_method_display()
        return '-'

    def get_computation_method_display(self, obj):
        if hasattr(obj.pay_head, 'computation') and obj.pay_head.computation:
            return obj.pay_head.computation.get_compute_method_display()
        return None

    def get_attendance_production_type_unit(self, obj):
        if obj.pay_head and obj.pay_head.attendance_production_type:
            apt = obj.pay_head.attendance_production_type
            if apt.payroll_unit:
                return apt.payroll_unit.symbol or apt.payroll_unit.formal_name or ''
            if apt.compound_unit and apt.compound_unit.compound_unit:
                return apt.compound_unit.compound_unit.symbol or apt.compound_unit.compound_unit.formal_name or ''
        return None

    def get_production_type_unit(self, obj):
        return self.get_attendance_production_type_unit(obj)

    def get_default_period(self, obj):
        if not obj.pay_head:
            return ''
        if obj.pay_head.calculation_period:
            return obj.pay_head.calculation_period.symbol or obj.pay_head.calculation_period.formal_name or ''
        if obj.pay_head.attendance_production_type:
            apt = obj.pay_head.attendance_production_type
            if apt.payroll_unit:
                return apt.payroll_unit.symbol or apt.payroll_unit.formal_name or ''
            if apt.compound_unit and apt.compound_unit.compound_unit:
                return apt.compound_unit.compound_unit.symbol or apt.compound_unit.compound_unit.formal_name or ''
            return apt.name or ''
        return ''




