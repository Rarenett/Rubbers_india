import os
import json
from datetime import timedelta
from rest_framework import serializers
from django.db import transaction
from django.utils import timezone
from attendance_app.models import (
    LeaveType,
    LeaveRequest,
    LeaveRequestDate,
    LeaveRequestForwarding,
    LeaveRequestDocument,
    EmployeeLeaveType,
    EmployeeLeaveTransaction,
)


class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = [
            'id',
            'name',
            'code',
            'is_paid',
            'annual_limit',
            'is_cumulative',
            'max_limit',
            'can_surrender',
            'apply_before_days',
            'need_approval',
            'is_active',
        ]

    def validate_code(self, value):
        code = value.strip().upper()
        if not code:
            raise serializers.ValidationError("Leave code cannot be blank.")
        
        # Check uniqueness case-insensitively, excluding current record if updating
        instance = self.instance
        qs = LeaveType.objects.filter(code__iexact=code)
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A leave type with this code already exists.")
        return code

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Leave name cannot be blank.")
        return name

    def validate(self, attrs):
        annual_limit = attrs.get('annual_limit', getattr(self.instance, 'annual_limit', 0))
        max_limit = attrs.get('max_limit', getattr(self.instance, 'max_limit', 0))
        apply_before_days = attrs.get('apply_before_days', getattr(self.instance, 'apply_before_days', 0))
        is_cumulative = attrs.get('is_cumulative', getattr(self.instance, 'is_cumulative', False))

        if annual_limit is not None and annual_limit < 0:
            raise serializers.ValidationError({"annual_limit": "Annual limit cannot be negative."})

        if max_limit is not None and max_limit < 0:
            raise serializers.ValidationError({"max_limit": "Maximum accumulation limit cannot be negative."})

        if apply_before_days is not None and apply_before_days < 0:
            raise serializers.ValidationError({"apply_before_days": "Apply before days cannot be negative."})

        # If not cumulative, max_limit can be defaulted to 0 if not provided
        if not is_cumulative and 'max_limit' not in attrs and not self.instance:
            attrs['max_limit'] = 0

        return attrs


class LeaveRequestDateSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveRequestDate
        fields = ['id', 'leave_request', 'date', 'status', 'created_at']
        read_only_fields = ['id', 'created_at']


class LeaveRequestForwardingSerializer(serializers.ModelSerializer):
    forwarded_by_name = serializers.SerializerMethodField()
    forwarded_to_name = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequestForwarding
        fields = [
            'id',
            'leave_request',
            'forwarded_by',
            'forwarded_by_name',
            'forwarded_to',
            'forwarded_to_name',
            'forwarded_at',
            'remarks',
        ]
        read_only_fields = ['id', 'forwarded_at', 'forwarded_by_name', 'forwarded_to_name']

    def get_forwarded_by_name(self, obj):
        if obj.forwarded_by:
            return obj.forwarded_by.get_full_name() or obj.forwarded_by.username
        return None

    def get_forwarded_to_name(self, obj):
        if obj.forwarded_to:
            return obj.forwarded_to.get_full_name() or obj.forwarded_to.username
        return None


from rarenett_app.models import Employee


class LeaveRequestDocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()
    file_size = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequestDocument
        fields = ['id', 'file', 'file_url', 'file_name', 'original_name', 'file_size', 'uploaded_at']
        read_only_fields = ['id', 'file_url', 'file_name', 'file_size', 'uploaded_at']

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None

    def get_file_name(self, obj):
        return obj.original_name or (os.path.basename(obj.file.name) if obj.file else '')

    def get_file_size(self, obj):
        try:
            if obj.file and hasattr(obj.file, 'size'):
                return obj.file.size
        except Exception:
            pass
        return None


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(),
        required=False,
        allow_null=True
    )
    employee_name = serializers.SerializerMethodField()
    employee_department = serializers.SerializerMethodField()
    leave_type_name = serializers.CharField(source='leave_type.name', read_only=True)
    leave_type_code = serializers.CharField(source='leave_type.code', read_only=True)
    leave_type_is_paid = serializers.BooleanField(source='leave_type.is_paid', read_only=True)
    approved_by_name = serializers.SerializerMethodField()
    current_handler_name = serializers.SerializerMethodField()
    employee_user_id = serializers.SerializerMethodField()
    employee_email = serializers.SerializerMethodField()
    leave_dates = LeaveRequestDateSerializer(many=True, read_only=True)
    forwarding_history = LeaveRequestForwardingSerializer(many=True, read_only=True)
    documents = LeaveRequestDocumentSerializer(many=True, read_only=True)

    # Allow writing dates as a list of 'YYYY-MM-DD' strings
    dates = serializers.ListField(
        child=serializers.DateField(),
        write_only=True,
        required=False
    )

    class Meta:
        model = LeaveRequest
        fields = [
            'id',
            'employee',
            'employee_name',
            'employee_user_id',
            'employee_email',
            'employee_department',
            'leave_type',
            'leave_type_name',
            'leave_type_code',
            'leave_type_is_paid',
            'total_days',
            'reason',
            'status',
            'employee_decision',
            'current_handler',
            'current_handler_name',
            'decision_remarks',
            'approved_by',
            'approved_by_name',
            'approved_at',
            'employee_accepted_at',
            'employee_declined_at',
            'employee_decline_reason',
            'created_at',
            'leave_dates',
            'forwarding_history',
            'documents',
            'dates',
        ]
        read_only_fields = [
            'id',
            'employee_user_id',
            'employee_email',
            'status',
            'employee_decision',
            'current_handler',
            'current_handler_name',
            'decision_remarks',
            'approved_by',
            'approved_at',
            'employee_accepted_at',
            'employee_declined_at',
            'created_at',
            'leave_dates',
            'forwarding_history',
            'documents',
        ]

    def get_employee_name(self, obj):
        if not obj.employee:
            return None
        if obj.employee.user:
            return obj.employee.user.get_full_name() or obj.employee.user.username
        if getattr(obj.employee, 'candidate', None):
            return obj.employee.candidate.full_name
        return f"Employee #{obj.employee.id}"

    def get_employee_department(self, obj):
        if not obj.employee or not obj.employee.dept_designation:
            return None
        dept_desig = obj.employee.dept_designation
        if getattr(dept_desig, 'department', None):
            return dept_desig.department.name
        return None

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.username
        return None

    def get_current_handler_name(self, obj):
        if obj.current_handler:
            return obj.current_handler.get_full_name() or obj.current_handler.username
        return None

    def get_employee_user_id(self, obj):
        if obj.employee and obj.employee.user_id:
            return obj.employee.user_id
        return None

    def get_employee_email(self, obj):
        if not obj.employee:
            return None
        if obj.employee.user and obj.employee.user.email:
            return obj.employee.user.email
        if obj.employee.email:
            return obj.employee.email
        if getattr(obj.employee, 'candidate', None) and obj.employee.candidate.email:
            return obj.employee.candidate.email
        return None

    def to_internal_value(self, data):
        # Handle FormData / QueryDict where dates might be JSON string
        if hasattr(data, 'dict'):
            raw_list = data.getlist('dates') if hasattr(data, 'getlist') else []
            data = data.dict()
            if len(raw_list) > 1:
                data['dates'] = raw_list
        elif hasattr(data, 'copy'):
            data = data.copy()
        else:
            data = dict(data)

        raw_dates = data.get('dates')
        if isinstance(raw_dates, str):
            try:
                parsed = json.loads(raw_dates)
                if isinstance(parsed, list):
                    data['dates'] = parsed
            except Exception:
                if ',' in raw_dates:
                    data['dates'] = [d.strip() for d in raw_dates.split(',') if d.strip()]
                elif raw_dates.strip():
                    data['dates'] = [raw_dates.strip()]

        return super().to_internal_value(data)

    def validate(self, attrs):
        dates = attrs.get('dates', [])
        if not self.instance and not dates and not attrs.get('total_days'):
            raise serializers.ValidationError({"dates": "At least one leave date must be selected."})

        leave_type = attrs.get('leave_type', getattr(self.instance, 'leave_type', None))
        if leave_type and dates:
            apply_before_days = getattr(leave_type, 'apply_before_days', 0) or 0
            today = timezone.now().date()
            min_allowed_date = today + timedelta(days=apply_before_days)
            invalid_dates = [d for d in dates if d < min_allowed_date]
            if invalid_dates:
                invalid_str = ', '.join([d.strftime('%Y-%m-%d') if hasattr(d, 'strftime') else str(d) for d in invalid_dates])
                if apply_before_days > 0:
                    raise serializers.ValidationError({
                        "dates": f"It is not possible to select {invalid_str}. '{leave_type.name}' requires at least {apply_before_days} day(s) advance notice. Earliest date allowed is {min_allowed_date.strftime('%Y-%m-%d')}."
                    })
                else:
                    raise serializers.ValidationError({
                        "dates": f"It is not possible to select past date(s): {invalid_str}. Earliest date allowed is {min_allowed_date.strftime('%Y-%m-%d')}."
                    })

        return attrs

    def create(self, validated_data):
        dates = validated_data.pop('dates', [])
        if dates:
            # Sort unique dates
            sorted_dates = sorted(list(set(dates)))
            validated_data['total_days'] = len(sorted_dates)
        else:
            sorted_dates = []

        with transaction.atomic():
            leave_request = LeaveRequest.objects.create(**validated_data)
            for d in sorted_dates:
                LeaveRequestDate.objects.create(leave_request=leave_request, date=d)
            return leave_request

    def update(self, instance, validated_data):
        dates = validated_data.pop('dates', None)
        with transaction.atomic():
            for attr, val in validated_data.items():
                setattr(instance, attr, val)

            if dates is not None and instance.status in ['PENDING', 'FORWARDED']:
                instance.leave_dates.all().delete()
                sorted_dates = sorted(list(set(dates)))
                for d in sorted_dates:
                    LeaveRequestDate.objects.create(leave_request=instance, date=d)
                instance.total_days = len(sorted_dates)

            instance.save()
            return instance


class EmployeeLeaveTypeSerializer(serializers.ModelSerializer):
    leave_type_name = serializers.CharField(source='leave_type.name', read_only=True)
    leave_type_code = serializers.CharField(source='leave_type.code', read_only=True)
    is_paid = serializers.BooleanField(source='leave_type.is_paid', read_only=True)
    annual_limit = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True)
    is_cumulative = serializers.BooleanField(source='leave_type.is_cumulative', read_only=True)
    max_limit = serializers.IntegerField(source='leave_type.max_limit', read_only=True)
    employee_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = EmployeeLeaveType
        fields = [
            'id',
            'employee',
            'employee_name',
            'leave_type',
            'leave_type_name',
            'leave_type_code',
            'is_paid',
            'annual_limit',
            'is_cumulative',
            'max_limit',
            'effective_from',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
            'leave_type_name',
            'leave_type_code',
            'is_paid',
            'is_cumulative',
            'max_limit',
            'employee_name',
        ]

    def get_employee_name(self, obj):
        return str(obj.employee) if obj.employee else ''

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if data.get('annual_limit') is None and instance.leave_type:
            data['annual_limit'] = instance.leave_type.annual_limit
        return data


class EmployeeLeaveTransactionSerializer(serializers.ModelSerializer):
    leave_type_name = serializers.CharField(source='leave_type.name', read_only=True)
    leave_type_code = serializers.CharField(source='leave_type.code', read_only=True)
    employee_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = EmployeeLeaveTransaction
        fields = [
            'id',
            'employee',
            'employee_name',
            'leave_type',
            'leave_type_name',
            'leave_type_code',
            'date',
            'IN',
            'OUT',
            'is_approved',
            'employee_leave_type',
            'leave_request',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'employee_name',
            'leave_type_name',
            'leave_type_code',
            'created_at',
            'updated_at',
        ]

    def get_employee_name(self, obj):
        return str(obj.employee) if obj.employee else ''

