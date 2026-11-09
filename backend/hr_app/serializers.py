from rest_framework import serializers
from django.utils import timezone
from inventory_app.models import Unit
from hr_app.models import (
    DutyName, Responsibility, AssignDutyandResponsibility, EmployeeDutyStatus
)

class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = '__all__'
        read_only_fields = ('id',)


class DutyNameSerializer(serializers.ModelSerializer):
    class Meta:
        model = DutyName
        fields = '__all__'

class ResponsibilitySerializer(serializers.ModelSerializer):
    dutyname_name = serializers.CharField(source='dutyname.name', read_only=True)
    class Meta:
        model = Responsibility
        fields = '__all__'

class AssignDutyandResponsibilitySerializer(serializers.ModelSerializer):
    dutyname_name = serializers.CharField(source='dutyname.name', read_only=True)
    dutyname_remarks = serializers.CharField(source='dutyname.remarks', read_only=True)
    department_name_details = serializers.SerializerMethodField()
    person_name_details = serializers.SerializerMethodField()
    responsibility_details = serializers.SerializerMethodField()
    ended_statuses = serializers.SerializerMethodField()
    
    class Meta:
        model = AssignDutyandResponsibility
        fields = '__all__'

    def validate(self, data):
        employees = data.get('person_name') or (self.instance.person_name.all() if self.instance else [])
        responsibilities = data.get('responsibility') or (self.instance.responsibility.all() if self.instance else [])
        
        for emp in employees:
            for resp in responsibilities:
                active_statuses = EmployeeDutyStatus.objects.filter(employee=emp, responsibility=resp, is_active=True)
                if self.instance:
                    active_statuses = active_statuses.exclude(assignment=self.instance)
                    
                if active_statuses.exists():
                    employee_name = emp.user.get_full_name() if emp.user else "Unknown"
                    raise serializers.ValidationError(
                        f"Responsibility '{resp.name}' is already assigned and active for employee {employee_name}."
                    )
                    
        return data

    def create(self, validated_data):
        employees = validated_data.pop('person_name', [])
        responsibilities = validated_data.pop('responsibility', [])
        departments = validated_data.pop('department_name', [])
        
        assignment = super().create(validated_data)
        
        assignment.person_name.set(employees)
        assignment.responsibility.set(responsibilities)
        assignment.department_name.set(departments)
        
        start_date = validated_data.get('start_date') or timezone.now().date()
        for emp in employees:
            for resp in responsibilities:
                EmployeeDutyStatus.objects.create(
                    assignment=assignment,
                    employee=emp,
                    duty_name=assignment.dutyname,
                    responsibility=resp,
                    start_date=start_date,
                    is_active=True
                )
        return assignment
        
    def update(self, instance, validated_data):
        employees = validated_data.pop('person_name', None)
        responsibilities = validated_data.pop('responsibility', None)
        departments = validated_data.pop('department_name', None)
        
        instance = super().update(instance, validated_data)
        
        if employees is not None:
            instance.person_name.set(employees)
        if responsibilities is not None:
            instance.responsibility.set(responsibilities)
        if departments is not None:
            instance.department_name.set(departments)
            
        current_employees = instance.person_name.all()
        current_responsibilities = instance.responsibility.all()
        start_date = instance.start_date or timezone.now().date()
        
        for emp in current_employees:
            for resp in current_responsibilities:
                status, created = EmployeeDutyStatus.objects.get_or_create(
                    assignment=instance,
                    employee=emp,
                    responsibility=resp,
                    defaults={
                        'duty_name': instance.dutyname,
                        'start_date': start_date,
                        'is_active': True
                    }
                )
                
        return instance


    def get_ended_statuses(self, obj):
        ended = obj.duty_statuses.filter(is_active=False)
        return [
            {
                'employee_id': status.employee_id,
                'responsibility_id': status.responsibility_id,
                'end_date': status.end_date.strftime('%Y-%m-%d') if status.end_date else None
            } for status in ended
        ]

    def get_department_name_details(self, obj):
        return ", ".join([dept.name for dept in obj.department_name.all()])

    def get_person_name_details(self, obj):
        details = []
        for emp in obj.person_name.all():
            name = emp.user.get_full_name() if (emp.user and hasattr(emp.user, 'get_full_name')) else emp.user.email if emp.user else "Unknown Employee"
            dept_name = emp.dept_designation.department.name if (hasattr(emp, 'dept_designation') and emp.dept_designation and emp.dept_designation.department) else ""
            details.append({"id": emp.id, "user_id": emp.user.id if emp.user else None, "name": name.strip(), "department_name": dept_name})
        return details

    def get_responsibility_details(self, obj):
        return [{"id": resp.id, "name": resp.name, "remarks": resp.remarks} for resp in obj.responsibility.all()]



class EmployeeDutyStatusSerializer(serializers.ModelSerializer):
    responsibility_name = serializers.CharField(source='responsibility.name', read_only=True)
    duty_name_display = serializers.CharField(source='duty_name.name', read_only=True)
    ended_by_name = serializers.CharField(source='ended_by.get_full_name', read_only=True)
    employee_name = serializers.SerializerMethodField()

    def get_employee_name(self, obj):
        if obj.employee and obj.employee.user:
            return obj.employee.user.get_full_name() or obj.employee.user.email
        return "Unknown Employee"

    class Meta:
        model = EmployeeDutyStatus
        fields = '__all__'


class CustomerTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = __import__('hr_app.models', fromlist=['CustomerType']).CustomerType
        fields = '__all__'

class HrDistributorSerializer(serializers.ModelSerializer):
    class Meta:
        model = __import__('hr_app.models', fromlist=['HrDistributor']).HrDistributor
        fields = '__all__'

    def sync_ledger(self, instance):
        try:
            from finance_app.models import Ledger, AccountGroup
            group = AccountGroup.objects.filter(name__icontains='Sundry Debtor').first()
            if instance.name and group:
                email_val = instance.email.strip() if instance.email else ''
                ledger = None
                if email_val:
                    ledger = Ledger.objects.filter(email__iexact=email_val).first()
                if not ledger:
                    ledger = Ledger.objects.filter(name__iexact=instance.name.strip()).first()
                
                if ledger:
                    ledger.name = instance.name.strip()
                    if email_val:
                        ledger.email = email_val
                    ledger.save()
                else:
                    Ledger.objects.create(
                        name=instance.name.strip(),
                        email=email_val,
                        accountGroup=group,
                        opening_balance=0,
                        closing_balance=0
                    )
        except Exception:
            pass

    def create(self, validated_data):
        instance = super().create(validated_data)
        self.sync_ledger(instance)
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        self.sync_ledger(instance)
        return instance


class AssignDutyandResponsibilitySerializer(serializers.ModelSerializer):
    dutyname_name = serializers.CharField(source='dutyname.name', read_only=True)
    dutyname_remarks = serializers.CharField(source='dutyname.remarks', read_only=True)
    department_name_details = serializers.SerializerMethodField()
    person_name_details = serializers.SerializerMethodField()
    responsibility_details = serializers.SerializerMethodField()
    ended_statuses = serializers.SerializerMethodField()
    
    class Meta:
        model = AssignDutyandResponsibility
        fields = '__all__'

    def validate(self, data):
        employees = data.get('person_name') or (self.instance.person_name.all() if self.instance else [])
        responsibilities = data.get('responsibility') or (self.instance.responsibility.all() if self.instance else [])
        
        for emp in employees:
            for resp in responsibilities:
                active_statuses = EmployeeDutyStatus.objects.filter(employee=emp, responsibility=resp, is_active=True)
                if self.instance:
                    active_statuses = active_statuses.exclude(assignment=self.instance)
                    
                if active_statuses.exists():
                    employee_name = emp.user.get_full_name() if emp.user else "Unknown"
                    raise serializers.ValidationError(
                        f"Responsibility '{resp.name}' is already assigned and active for employee {employee_name}."
                    )
                    
        return data

    def create(self, validated_data):
        employees = validated_data.pop('person_name', [])
        responsibilities = validated_data.pop('responsibility', [])
        departments = validated_data.pop('department_name', [])
        
        assignment = super().create(validated_data)
        
        assignment.person_name.set(employees)
        assignment.responsibility.set(responsibilities)
        assignment.department_name.set(departments)
        
        start_date = validated_data.get('start_date') or timezone.now().date()
        for emp in employees:
            for resp in responsibilities:
                EmployeeDutyStatus.objects.create(
                    assignment=assignment,
                    employee=emp,
                    duty_name=assignment.dutyname,
                    responsibility=resp,
                    start_date=start_date,
                    is_active=True
                )
        return assignment
        
    def update(self, instance, validated_data):
        employees = validated_data.pop('person_name', None)
        responsibilities = validated_data.pop('responsibility', None)
        departments = validated_data.pop('department_name', None)
        
        instance = super().update(instance, validated_data)
        
        if employees is not None:
            instance.person_name.set(employees)
        if responsibilities is not None:
            instance.responsibility.set(responsibilities)
        if departments is not None:
            instance.department_name.set(departments)
            
        current_employees = instance.person_name.all()
        current_responsibilities = instance.responsibility.all()
        start_date = instance.start_date or timezone.now().date()
        
        for emp in current_employees:
            for resp in current_responsibilities:
                status, created = EmployeeDutyStatus.objects.get_or_create(
                    assignment=instance,
                    employee=emp,
                    responsibility=resp,
                    defaults={
                        'duty_name': instance.dutyname,
                        'start_date': start_date,
                        'is_active': True
                    }
                )
                
        return instance


    def get_ended_statuses(self, obj):
        ended = obj.duty_statuses.filter(is_active=False)
        return [
            {
                'employee_id': status.employee_id,
                'responsibility_id': status.responsibility_id,
                'end_date': status.end_date.strftime('%Y-%m-%d') if status.end_date else None
            } for status in ended
        ]

    def get_department_name_details(self, obj):
        return ", ".join([dept.name for dept in obj.department_name.all()])

    def get_person_name_details(self, obj):
        details = []
        for emp in obj.person_name.all():
            name = emp.user.get_full_name() if (emp.user and hasattr(emp.user, 'get_full_name')) else emp.user.email if emp.user else "Unknown Employee"
            dept_name = emp.dept_designation.department.name if (hasattr(emp, 'dept_designation') and emp.dept_designation and emp.dept_designation.department) else ""
            details.append({"id": emp.id, "user_id": emp.user.id if emp.user else None, "name": name.strip(), "department_name": dept_name})
        return details

    def get_responsibility_details(self, obj):
        return [{"id": resp.id, "name": resp.name, "remarks": resp.remarks} for resp in obj.responsibility.all()]



class EmployeeDutyStatusSerializer(serializers.ModelSerializer):
    responsibility_name = serializers.CharField(source='responsibility.name', read_only=True)
    duty_name_display = serializers.CharField(source='duty_name.name', read_only=True)
    ended_by_name = serializers.CharField(source='ended_by.get_full_name', read_only=True)
    employee_name = serializers.SerializerMethodField()

    def get_employee_name(self, obj):
        if obj.employee and obj.employee.user:
            return obj.employee.user.get_full_name() or obj.employee.user.email
        return "Unknown Employee"

    class Meta:
        model = EmployeeDutyStatus
        fields = '__all__'


class CustomerTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = __import__('hr_app.models', fromlist=['CustomerType']).CustomerType
        fields = '__all__'

class HrDistributorSerializer(serializers.ModelSerializer):
    class Meta:
        model = __import__('hr_app.models', fromlist=['HrDistributor']).HrDistributor
        fields = '__all__'

    def sync_ledger(self, instance):
        try:
            from finance_app.models import Ledger, AccountGroup
            group = AccountGroup.objects.filter(name__icontains='Sundry Debtor').first()
            if instance.name and group:
                email_val = instance.email.strip() if instance.email else ''
                ledger = None
                if email_val:
                    ledger = Ledger.objects.filter(email__iexact=email_val).first()
                if not ledger:
                    ledger = Ledger.objects.filter(name__iexact=instance.name.strip()).first()
                
                if ledger:
                    ledger.name = instance.name.strip()
                    if email_val:
                        ledger.email = email_val
                    ledger.save()
                else:
                    Ledger.objects.create(
                        name=instance.name.strip(),
                        email=email_val,
                        accountGroup=group,
                        opening_balance=0,
                        closing_balance=0
                    )
        except Exception:
            pass

    def create(self, validated_data):
        instance = super().create(validated_data)
        self.sync_ledger(instance)
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        self.sync_ledger(instance)
        return instance

class HrVendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = __import__('hr_app.models', fromlist=['HrVendor']).HrVendor
        fields = '__all__'

class HrOtherCustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = __import__('hr_app.models', fromlist=['HrOtherCustomer']).HrOtherCustomer
        fields = '__all__'


class ResponsibilityReminderMasterSerializer(serializers.ModelSerializer):
    responsibility_name = serializers.CharField(source='responsibility.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    employee_details = serializers.SerializerMethodField()
    has_updates = serializers.SerializerMethodField()

    class Meta:
        model = __import__('hr_app.models', fromlist=['ResponsibilityReminderMaster']).ResponsibilityReminderMaster
        fields = '__all__'

    def get_has_updates(self, obj):
        return obj.details.filter(updates__isnull=False).exists()

    def get_employee_details(self, obj):
        details = []
        for emp in obj.employees.all():
            name = emp.user.get_full_name() if (emp.user and hasattr(emp.user, 'get_full_name')) else emp.user.email if emp.user else "Unknown"
            details.append({"id": emp.id, "name": name.strip()})
        return details

class ResponsibilityReminderDetailSerializer(serializers.ModelSerializer):
    responsibility_name = serializers.CharField(source='master.responsibility.name', read_only=True)
    department_name = serializers.CharField(source='master.department.name', read_only=True)
    frequency_days = serializers.IntegerField(source='master.frequency_days', read_only=True)
    start_date = serializers.DateField(source='master.start_date', read_only=True)
    employee_names = serializers.SerializerMethodField()

    class Meta:
        model = __import__('hr_app.models', fromlist=['ResponsibilityReminderDetail']).ResponsibilityReminderDetail
        fields = '__all__'

    def get_employee_names(self, obj):
        names = []
        for emp in obj.master.employees.all():
            name = emp.user.get_full_name() if (emp.user and hasattr(emp.user, 'get_full_name')) else emp.user.email if emp.user else "Unknown Employee"
            names.append(name.strip())
        return ", ".join(names)

class ResponsibilityUpdateSerializer(serializers.ModelSerializer):
    responsibility_name = serializers.CharField(source='reminder.master.responsibility.name', read_only=True)
    department_name = serializers.CharField(source='reminder.master.department.name', read_only=True)
    employee_name = serializers.SerializerMethodField()
    start_date = serializers.DateField(source='reminder.master.start_date', read_only=True)
    reminder_date = serializers.DateField(source='reminder.reminder_date', read_only=True)
    days_before = serializers.SerializerMethodField()

    class Meta:
        model = __import__('hr_app.models', fromlist=['ResponsibilityUpdate']).ResponsibilityUpdate
        fields = '__all__'
        read_only_fields = ['employee']

    def get_employee_name(self, obj):
        emp = obj.employee
        return emp.user.get_full_name() if (emp.user and hasattr(emp.user, 'get_full_name')) else emp.user.email if emp.user else "Unknown"

    def get_days_before(self, obj):
        if obj.reminder.reminder_date and obj.update_date:
            return (obj.reminder.reminder_date - obj.update_date).days
        return 0
