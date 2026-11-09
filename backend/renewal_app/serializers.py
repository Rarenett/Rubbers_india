from rest_framework import serializers
from .models import RenewalSubject, RenewalReminder
from rarenett_app.models import Employee


class RenewalSubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = RenewalSubject
        fields = ['id', 'name', 'description', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class RenewalReminderSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True, default='')
    renewal_subject_name = serializers.CharField(source='renewal_subject.name', read_only=True, default='')
    department_name = serializers.CharField(source='department.name', read_only=True, default='')
    allocated_to = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Employee.objects.all(),
        required=False
    )
    allocated_to_details = serializers.SerializerMethodField()

    class Meta:
        model = RenewalReminder
        fields = [
            'id',
            'branch',
            'branch_name',
            'renewal_subject',
            'renewal_subject_name',
            'name',
            'department',
            'department_name',
            'allocated_to',
            'allocated_to_details',
            'renewal_date',
            'reminder_days',
            'remarks',
            'is_active',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_allocated_to_details(self, obj):
        result = []
        for emp in obj.allocated_to.all():
            name = ''
            if emp.user:
                name = emp.user.get_full_name() or emp.user.email
            else:
                name = emp.email or str(emp)
            result.append({
                'id': emp.id,
                'name': name,
                'email': emp.email or (emp.user.email if emp.user else ''),
                'department_name': emp.dept_designation.department.name if emp.dept_designation and emp.dept_designation.department else ''
            })
        return result
