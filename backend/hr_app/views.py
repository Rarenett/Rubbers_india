from rest_framework import viewsets, status
from rest_framework.response import Response
from inventory_app.models import Unit
from .models import (
    DutyName, Responsibility, AssignDutyandResponsibility
)
from .serializers import (
    UnitSerializer,
    DutyNameSerializer, ResponsibilitySerializer, AssignDutyandResponsibilitySerializer
)
from register_app.permissions import module_permission

class UnitViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Unit CRUD operations (points to inventory_app.Unit)
    """
    queryset = Unit.objects.all().order_by('name')
    serializer_class = UnitSerializer
    permission_classes = [module_permission('hr')]

    def get_queryset(self):
        try:
            from inventory_app.views import ensure_default_units
            ensure_default_units()
        except Exception:
            pass
        return super().get_queryset()

class DutyNameViewSet(viewsets.ModelViewSet):
    queryset = DutyName.objects.all().order_by('name')
    serializer_class = DutyNameSerializer
    # permission_classes = [module_permission('hr')] # adjust as needed

class ResponsibilityViewSet(viewsets.ModelViewSet):
    queryset = Responsibility.objects.all().order_by('dutyname__name', 'name')
    serializer_class = ResponsibilitySerializer
    # permission_classes = [module_permission('hr')]

class AssignDutyandResponsibilityViewSet(viewsets.ModelViewSet):
    queryset = AssignDutyandResponsibility.objects.all()
    serializer_class = AssignDutyandResponsibilitySerializer
    # permission_classes = [module_permission('hr')]

from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import EmployeeDutyStatus
from .serializers import EmployeeDutyStatusSerializer
from rarenett_app.models import Employee
from django.db import transaction

class EmployeeDutyStatusViewSet(viewsets.ModelViewSet):
    queryset = EmployeeDutyStatus.objects.all()
    serializer_class = EmployeeDutyStatusSerializer

    @action(detail=False, methods=['get'], url_path='by-employee/(?P<employee_id>[^/.]+)')
    def by_employee(self, request, employee_id=None):
        statuses = self.queryset.filter(employee_id=employee_id, is_active=True)
        serializer = self.get_serializer(statuses, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'], url_path='end')
    def end_responsibility(self, request, pk=None):
        status_obj = self.get_object()
        if not status_obj.is_active:
            return Response({'error': 'Status is already inactive'}, status=400)
        
        status_obj.is_active = False
        end_date = request.data.get('end_date')
        if end_date:
            status_obj.end_date = end_date
        else:
            status_obj.end_date = timezone.now().date()
            
        status_obj.ended_by = request.user
        status_obj.ended_at = timezone.now()
        status_obj.save()
        return Response({'status': 'ended'})

    @action(detail=False, methods=['post'], url_path='end-duty')
    def end_duty(self, request):
        employee_id = request.data.get('employee_id')
        duty_name_id = request.data.get('duty_name_id')
        
        if not employee_id or not duty_name_id:
            return Response({'error': 'employee_id and duty_name_id are required'}, status=400)
            
        with transaction.atomic():
            statuses = EmployeeDutyStatus.objects.filter(
                employee_id=employee_id, 
                duty_name_id=duty_name_id, 
                is_active=True
            )
            count = statuses.count()
            
            end_date = request.data.get('end_date') or timezone.now().date()
            
            statuses.update(
                is_active=False,
                end_date=end_date,
                ended_by=request.user,
                ended_at=timezone.now()
            )
        return Response({'status': 'ended', 'count': count})


class HREmployeeViewSet(viewsets.ReadOnlyModelViewSet):
    from rarenett_app.models import Employee
    from rarenett_app.serializers import EmployeeSerializer
    queryset = Employee.objects.all()
    serializer_class = EmployeeSerializer
    
    def get_queryset(self):
        qs = super().get_queryset()
        dept = self.request.query_params.get('department')
        desig = self.request.query_params.get('designation')
        search = self.request.query_params.get('search')
        
        if dept:
            qs = qs.filter(dept_designation__department_id=dept)
        if desig:
            qs = qs.filter(dept_designation__designation_id=desig)
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search) |
                Q(dept_designation__department__name__icontains=search) |
                Q(dept_designation__designation__name__icontains=search)
            )
        return qs

class CustomerTypeViewSet(viewsets.ModelViewSet):
    queryset = __import__('hr_app.models', fromlist=['CustomerType']).CustomerType.objects.all()
    serializer_class = __import__('hr_app.serializers', fromlist=['CustomerTypeSerializer']).CustomerTypeSerializer

class HrDistributorViewSet(viewsets.ModelViewSet):
    queryset = __import__('hr_app.models', fromlist=['HrDistributor']).HrDistributor.objects.all()
    serializer_class = __import__('hr_app.serializers', fromlist=['HrDistributorSerializer']).HrDistributorSerializer

class HrVendorViewSet(viewsets.ModelViewSet):
    queryset = __import__('hr_app.models', fromlist=['HrVendor']).HrVendor.objects.all()
    serializer_class = __import__('hr_app.serializers', fromlist=['HrVendorSerializer']).HrVendorSerializer
    def get_queryset(self):
        queryset = super().get_queryset()
        if hasattr(self.request.user, 'employee'):
            # Employees see their own updates
            queryset = queryset.filter(employee=self.request.user.employee)
        return queryset

    def perform_create(self, serializer):
        if hasattr(self.request.user, 'employee'):
            serializer.save(employee=self.request.user.employee)
        else:
            serializer.save()

class HrOtherCustomerViewSet(viewsets.ModelViewSet):
    queryset = __import__('hr_app.models', fromlist=['HrOtherCustomer']).HrOtherCustomer.objects.all()
    serializer_class = __import__('hr_app.serializers', fromlist=['HrOtherCustomerSerializer']).HrOtherCustomerSerializer


class ResponsibilityReminderMasterViewSet(viewsets.ModelViewSet):
    from hr_app.models import ResponsibilityReminderMaster, ResponsibilityReminderDetail
    from hr_app.serializers import ResponsibilityReminderMasterSerializer
    queryset = ResponsibilityReminderMaster.objects.all().order_by('-created_at')
    serializer_class = ResponsibilityReminderMasterSerializer
    
    def create(self, request, *args, **kwargs):
        import datetime
        from django.db import transaction
        from rest_framework import status
        from rest_framework.response import Response
        from hr_app.models import ResponsibilityReminderMaster, ResponsibilityReminderDetail
        data = request.data
        start_date_str = data.get('start_date')
        end_date_str = data.get('end_date')
        frequency_days = int(data.get('frequency_days', 0))
        
        if not start_date_str or not end_date_str or frequency_days <= 0:
            return Response({'error': 'start_date, end_date and positive frequency_days are required.'}, status=400)
            
        start_date = datetime.datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.datetime.strptime(end_date_str, '%Y-%m-%d').date()
        
        if start_date > end_date:
            return Response({'error': 'start_date must be before end_date.'}, status=400)
            
        employees = data.get('employees', [])
        
        with transaction.atomic():
            master = ResponsibilityReminderMaster.objects.create(
                responsibility_id=data.get('responsibility'),
                department_id=data.get('department'),
                start_date=start_date,
                end_date=end_date,
                frequency_days=frequency_days,
                remind_me_before=int(data.get('remind_me_before', 0))
            )
            if employees:
                master.employees.set(employees)

            current_date = start_date
            details_to_create = []
            while current_date <= end_date:
                details_to_create.append(ResponsibilityReminderDetail(
                    master=master,
                    reminder_date=current_date,
                    is_acknowledged=False
                ))
                current_date += datetime.timedelta(days=frequency_days)
            
            ResponsibilityReminderDetail.objects.bulk_create(details_to_create)
                
        serializer = self.get_serializer(master)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        import datetime
        from django.db import transaction
        from rest_framework import status
        from rest_framework.response import Response
        from hr_app.models import ResponsibilityReminderDetail

        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        data = request.data
        
        start_date_str = data.get('start_date')
        end_date_str = data.get('end_date')
        frequency_days = int(data.get('frequency_days', 0))
        
        if not start_date_str or not end_date_str or frequency_days <= 0:
            return Response({'error': 'start_date, end_date and positive frequency_days are required.'}, status=400)
            
        start_date = datetime.datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.datetime.strptime(end_date_str, '%Y-%m-%d').date()
        
        if start_date > end_date:
            return Response({'error': 'start_date must be before end_date.'}, status=400)

        employees = data.get('employees', [])

        with transaction.atomic():
            # Update master
            instance.responsibility_id = data.get('responsibility')
            instance.department_id = data.get('department')
            instance.start_date = start_date
            instance.end_date = end_date
            instance.frequency_days = frequency_days
            instance.remind_me_before = int(data.get('remind_me_before', 0))
            instance.save()
            
            if employees:
                instance.employees.set(employees)
            else:
                instance.employees.clear()

            # Delete old details
            instance.details.all().delete()

            # Generate new details
            current_date = start_date
            details_to_create = []
            while current_date <= end_date:
                details_to_create.append(ResponsibilityReminderDetail(
                    master=instance,
                    reminder_date=current_date,
                    is_acknowledged=False
                ))
                current_date += datetime.timedelta(days=frequency_days)
            
            ResponsibilityReminderDetail.objects.bulk_create(details_to_create)

        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class ResponsibilityReminderDetailViewSet(viewsets.ModelViewSet):
    from hr_app.models import ResponsibilityReminderDetail
    from hr_app.serializers import ResponsibilityReminderDetailSerializer
    queryset = ResponsibilityReminderDetail.objects.all().order_by('reminder_date')
    serializer_class = ResponsibilityReminderDetailSerializer

    from rest_framework.decorators import action
    from rest_framework.response import Response

    @action(detail=False, methods=['get'])
    def pending_reminders(self, request):
        from hr_app.models import ResponsibilityReminderDetail
        import datetime
        
        if not hasattr(request.user, 'employee'):
            return Response([])
            
        employee = request.user.employee
        today = datetime.date.today()
        
        reminders = ResponsibilityReminderDetail.objects.filter(
            master__employees=employee,
            is_acknowledged=False
        ).exclude(
            updates__employee=employee
        ).select_related('master')
        
        active_reminders = []
        for detail in reminders:
            popup_start_date = detail.reminder_date - datetime.timedelta(days=detail.master.remind_me_before)
            if today >= popup_start_date:
                active_reminders.append(detail)
                
        serializer = self.get_serializer(active_reminders, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_assigned(self, request):
        import datetime
        if not hasattr(request.user, 'employee'):
            return Response([])
        employee = request.user.employee
        reminders = self.get_queryset().filter(master__employees=employee).exclude(updates__employee=employee)
        
        today = datetime.date.today()
        active_reminders = []
        for detail in reminders:
            popup_start_date = detail.reminder_date - datetime.timedelta(days=detail.master.remind_me_before)
            if today >= popup_start_date:
                active_reminders.append(detail)
                
        serializer = self.get_serializer(active_reminders, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def report_details(self, request):
        responsibility_id = request.query_params.get('responsibility_id')
        if not responsibility_id:
            return Response({'error': 'responsibility_id is required'}, status=400)
        
        qs = self.queryset.filter(master__responsibility_id=responsibility_id)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

class ResponsibilityUpdateViewSet(viewsets.ModelViewSet):
    serializer_class = __import__('hr_app.serializers', fromlist=['ResponsibilityUpdateSerializer']).ResponsibilityUpdateSerializer
    queryset = __import__('hr_app.models', fromlist=['ResponsibilityUpdate']).ResponsibilityUpdate.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        if hasattr(self.request.user, 'employee'):
            queryset = queryset.filter(employee=self.request.user.employee)
        return queryset

    def perform_create(self, serializer):
        if hasattr(self.request.user, 'employee'):
            serializer.save(employee=self.request.user.employee)
        else:
            serializer.save()

    from rest_framework.decorators import action
    from rest_framework.response import Response

    @action(detail=False, methods=['get'])
    def report_responsibilities(self, request):
        from hr_app.models import Responsibility
        qs = Responsibility.objects.filter(
            reminders__isnull=False
        ).distinct()
        data = [{'id': r.id, 'name': r.name} for r in qs]
        return Response(data)

    @action(detail=False, methods=['get'])
    def report_updates(self, request):
        responsibility_id = request.query_params.get('responsibility_id')
        if not responsibility_id:
            return Response({'error': 'responsibility_id is required'}, status=400)
        
        qs = self.queryset.filter(reminder__master__responsibility_id=responsibility_id)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
