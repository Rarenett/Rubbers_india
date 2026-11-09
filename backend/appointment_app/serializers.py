from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Appointment
from rarenett_app.models import Department, Designation

User = get_user_model()

class AppointmentSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    designation_name = serializers.CharField(source='designation.name', read_only=True)
    concerned_staff_name = serializers.CharField(source='concerned_staff.get_full_name', read_only=True)
    contact_person_name = serializers.CharField(source='contact_person.get_full_name', read_only=True)
    visitor_category_name = serializers.CharField(source='visitor_category.name', read_only=True)

    class Meta:
        model = Appointment
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        cp = data.get('contact_person')
        if cp in ['', None]:
            data['contact_person'] = None
        elif isinstance(cp, str) and not cp.isdigit():
            from django.db.models import Q
            from rarenett_app.models import Employee
            user = User.objects.filter(
                Q(username__iexact=cp) |
                Q(first_name__iexact=cp) |
                Q(email__iexact=cp)
            ).first()
            if not user:
                for u in User.objects.filter(is_active=True):
                    if u.get_full_name().strip().lower() == cp.strip().lower():
                        user = u
                        break
            if not user:
                emp = Employee.objects.filter(
                    Q(candidate__first_name__iexact=cp)
                ).first()
                if emp and emp.user:
                    user = emp.user
                else:
                    for e in Employee.objects.all():
                        if getattr(e, 'full_name', '').strip().lower() == cp.strip().lower() and e.user:
                            user = e.user
                            break
            if user:
                data['contact_person'] = user.id
            else:
                data['contact_person'] = None
        return super().to_internal_value(data)

    def validate_appointment_date(self, value):
        import datetime
        if value and value < datetime.date.today():
            raise serializers.ValidationError("Appointment date cannot be in the past.")
        return value

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Fall back to department contact details if not directly set
        if not ret.get('contact_person_name') and instance.department and instance.department.contact_person:
            ret['contact_person_name'] = instance.department.contact_person
        if not ret.get('contact_number') and instance.department and instance.department.contact_number:
            ret['contact_number'] = instance.department.contact_number
        if instance.visitor:
            ret['visitor_name'] = instance.visitor.visitor_name
            ret['visitor_phone'] = instance.visitor.mobile_no
        elif instance.vehicle:
            ret['vehicle_number'] = instance.vehicle.vehicle_number
            ret['company'] = instance.vehicle.company
            ret['vehicle_type_name'] = instance.vehicle.vehicle_type.name if instance.vehicle.vehicle_type else None
        if instance.appointment_date:
            ret['formatted_date'] = instance.appointment_date.strftime('%d-%m-%Y')
        
        # Check associated gate entry or vehicle entry
        try:
            gate_entry = getattr(instance, 'gate_entry', None)
            if gate_entry:
                ret['gate_entry_id'] = gate_entry.id
                ret['is_inside'] = gate_entry.exit_time is None
                ret['gate_entry_exited'] = gate_entry.exit_time is not None
            else:
                veh_entry = instance.vehicle_entries.first() if hasattr(instance, 'vehicle_entries') else None
                if veh_entry:
                    ret['vehicle_entry_id'] = veh_entry.id
                    ret['is_inside'] = veh_entry.exit_time is None
                    ret['gate_entry_exited'] = veh_entry.exit_time is not None
        except Exception:
            pass

        # If pending but employee has active approveless clearance configured, serialize as approved
        if ret.get('status') == 'pending' and instance.concerned_staff:
            try:
                from gate_app.models import ApprovelessEntryConfig
                from django.db.models import Q
                if ApprovelessEntryConfig.objects.filter(
                    employee=instance.concerned_staff,
                    is_active=True
                ).filter(
                    Q(department=instance.department) | Q(department__isnull=True)
                ).exists():
                    ret['status'] = 'approved'
                    ret['is_approveless_approved'] = True
            except Exception:
                pass

        return ret

class StaffSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'full_name', 'email']
