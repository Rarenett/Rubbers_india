from rest_framework import viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils import timezone
from django.db.models import Q
from .models import Appointment
from .serializers import AppointmentSerializer, StaffSerializer
from rarenett_app.models import Department, Designation, Employee, DepartmentDesignation
from django.contrib.auth import get_user_model

User = get_user_model()

from gate_app.models import Visitor, Vehicle

class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.all()
    serializer_class = AppointmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Appointment.objects.none()

        if user.is_superuser:
            return Appointment.objects.all()

        # Check role for Admin / Super Admin
        user_role = getattr(user, 'role', None)
        if user_role and user_role.name.lower() in ['admin', 'administrator', 'super admin']:
            return Appointment.objects.all()

        try:
            employee = Employee.objects.get(user=user)
            dept = employee.dept_designation.department if employee.dept_designation else None

            # Gate or Security department can see all appointments
            if dept and dept.name.lower() in ['gate', 'security']:
                return Appointment.objects.all()
            if user_role and user_role.name.lower() in ['watchman', 'security', 'gate']:
                return Appointment.objects.all()

            # Regular employees only see appointments placed from their user id
            return Appointment.objects.filter(created_by=user)
        except Employee.DoesNotExist:
            return Appointment.objects.filter(created_by=user)

    def perform_create(self, serializer):
        concerned_staff = serializer.validated_data.get('concerned_staff')
        department = serializer.validated_data.get('department')
        has_approveless = False
        if concerned_staff:
            from gate_app.models import ApprovelessEntryConfig
            has_approveless = ApprovelessEntryConfig.objects.filter(
                employee=concerned_staff,
                is_active=True
            ).filter(
                Q(department=department) | Q(department__isnull=True)
            ).exists()

        if concerned_staff == self.request.user or has_approveless:
            status = 'approved'
        else:
            status = 'pending'

        extra_kwargs = {'created_by': self.request.user, 'status': status}

        # Connect number with Visitor / Vehicle model if not explicitly linked
        vehicle = serializer.validated_data.get('vehicle')
        vehicle_number = serializer.validated_data.get('vehicle_number')
        if not vehicle and vehicle_number:
            v_clean = vehicle_number.strip()
            v_obj = Vehicle.objects.filter(
                Q(vehicle_number__iexact=v_clean) | Q(vehicle_number__iexact=v_clean.replace(" ", ""))
            ).first()
            if v_obj:
                extra_kwargs['vehicle'] = v_obj
        elif vehicle and not vehicle_number:
            extra_kwargs['vehicle_number'] = vehicle.vehicle_number

        visitor = serializer.validated_data.get('visitor')
        visitor_phone = serializer.validated_data.get('visitor_phone')
        visitor_name = serializer.validated_data.get('visitor_name')
        if not visitor and visitor_phone:
            p_clean = visitor_phone.strip()
            vis_obj = Visitor.objects.filter(
                Q(mobile_no__iexact=p_clean) | Q(mobile_no__iexact=p_clean.replace(" ", ""))
            ).first()
            if vis_obj:
                extra_kwargs['visitor'] = vis_obj
                if not visitor_name:
                    extra_kwargs['visitor_name'] = vis_obj.visitor_name
        elif visitor:
            if not visitor_phone:
                extra_kwargs['visitor_phone'] = visitor.mobile_no
            if not visitor_name:
                extra_kwargs['visitor_name'] = visitor.visitor_name

        serializer.save(**extra_kwargs)

    @action(detail=False, methods=['get'])
    def today_appointments(self, request):
        today = timezone.now().date()
        number = request.query_params.get('number') or request.query_params.get('search')

        queryset = Appointment.objects.filter(
            status__in=['pending', 'approved', 'Pending', 'Approved'],
            appointment_date=today
        )

        if number:
            clean_num = number.strip()
            num_clean = clean_num.replace(" ", "").replace("-", "")

            q_filter = (
                Q(visitor_phone__icontains=clean_num) |
                Q(visitor__mobile_no__icontains=clean_num) |
                Q(vehicle_number__icontains=clean_num) |
                Q(vehicle__vehicle_number__icontains=clean_num)
            )
            if num_clean:
                q_filter |= (
                    Q(visitor_phone__icontains=num_clean) |
                    Q(visitor__mobile_no__icontains=num_clean) |
                    Q(vehicle_number__icontains=num_clean) |
                    Q(vehicle__vehicle_number__icontains=num_clean)
                )

            queryset = queryset.filter(q_filter)

        queryset = queryset.order_by('appointment_time')

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def get_my_department(self, request):
        try:
            employee = Employee.objects.get(user=request.user)
            dept = employee.dept_designation.department if employee.dept_designation else None
            if dept:
                return Response({
                    "id": dept.id,
                    "name": dept.name,
                    "contact_person": dept.contact_person,
                    "contact_number": dept.contact_number,
                    "requires_visitor_approval": dept.requires_visitor_approval
                })
        except Employee.DoesNotExist:
            pass
        return Response({"error": "No department found"}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'])
    def designations_by_department(self, request):
        department_id = request.query_params.get('department_id')
        if not department_id:
            return Response({"error": "department_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Filter through DepartmentDesignation
        dept_designations = DepartmentDesignation.objects.filter(department_id=department_id, designation__is_active=True)
        data = [{"id": dd.designation.id, "title": dd.designation.name} for dd in dept_designations]
        return Response(data)

    @action(detail=False, methods=['get'])
    def staff_by_designation(self, request):
        department_id = request.query_params.get('department_id')
        designation_id = request.query_params.get('designation_id')
        
        if not department_id or not designation_id:
            return Response({"error": "department_id and designation_id are required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Filter through DepartmentDesignation link in Employee
        employees = Employee.objects.filter(
            dept_designation__department_id=department_id, 
            dept_designation__designation_id=designation_id,
            user__is_active=True
        )
        staff_users = [emp.user for emp in employees]
        serializer = StaffSerializer(staff_users, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def all_departments(self, request):
        departments = Department.objects.filter(is_active=True)
        data = [
            {
                "id": d.id,
                "name": d.name,
                "contact_person": d.contact_person,
                "contact_number": d.contact_number,
                "requires_visitor_approval": d.requires_visitor_approval
            }
            for d in departments
        ]
        return Response(data)

    @action(detail=False, methods=['get'])
    def my_pending_approvals(self, request):
        user = request.user
        if not user or not user.is_authenticated:
            return Response([])

        if user.is_superuser:
            qs = Appointment.objects.filter(status='pending')
        else:
            qs = Appointment.objects.filter(
                Q(concerned_staff=user) | Q(contact_person=user),
                status='pending'
            )

        date_param = request.query_params.get('date', 'today')
        if date_param and date_param != 'all':
            if date_param == 'today':
                from django.utils import timezone
                qs = qs.filter(appointment_date=timezone.now().date())
            else:
                qs = qs.filter(appointment_date=date_param)

        appointments = qs.order_by('-appointment_date', '-appointment_time')
        serializer = self.get_serializer(appointments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_approved_requests(self, request):
        user = request.user
        if not user or not user.is_authenticated:
            return Response([])

        if user.is_superuser:
            qs = Appointment.objects.filter(status__in=['approved', 'completed'])
        else:
            qs = Appointment.objects.filter(
                Q(concerned_staff=user) | Q(contact_person=user),
                status__in=['approved', 'completed']
            )

        date_param = request.query_params.get('date', 'today')
        if date_param and date_param != 'all':
            if date_param == 'today':
                from django.utils import timezone
                qs = qs.filter(appointment_date=timezone.now().date())
            else:
                qs = qs.filter(appointment_date=date_param)

        appointments = qs.order_by('-appointment_date', '-appointment_time')
        serializer = self.get_serializer(appointments, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_rejected_requests(self, request):
        user = request.user
        if not user or not user.is_authenticated:
            return Response([])

        if user.is_superuser:
            qs = Appointment.objects.filter(status='rejected')
        else:
            qs = Appointment.objects.filter(
                Q(concerned_staff=user) | Q(contact_person=user),
                status='rejected'
            )

        date_param = request.query_params.get('date', 'today')
        if date_param and date_param != 'all':
            if date_param == 'today':
                from django.utils import timezone
                qs = qs.filter(appointment_date=timezone.now().date())
            else:
                qs = qs.filter(appointment_date=date_param)

        appointments = qs.order_by('-appointment_date', '-appointment_time')
        serializer = self.get_serializer(appointments, many=True)
        return Response(serializer.data)


    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        try:
            appointment = Appointment.objects.get(pk=pk)
        except Appointment.DoesNotExist:
            return Response({"error": "Appointment not found"}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        is_admin = user.is_superuser or (getattr(user, 'role', None) and user.role.name.lower() in ['admin', 'administrator', 'super admin'])
        if not (is_admin or appointment.concerned_staff == user or appointment.contact_person == user):
            return Response({"error": "You are not authorized to approve this appointment."}, status=status.HTTP_403_FORBIDDEN)

        appointment.status = 'approved'
        appointment.save()
        return Response({"status": "approved", "message": "Appointment approved successfully."})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        try:
            appointment = Appointment.objects.get(pk=pk)
        except Appointment.DoesNotExist:
            return Response({"error": "Appointment not found"}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        is_admin = user.is_superuser or (getattr(user, 'role', None) and user.role.name.lower() in ['admin', 'administrator', 'super admin'])
        if not (is_admin or appointment.concerned_staff == user or appointment.contact_person == user):
            return Response({"error": "You are not authorized to reject this appointment."}, status=status.HTTP_403_FORBIDDEN)

        appointment.status = 'rejected'
        appointment.save()
        return Response({"status": "rejected", "message": "Appointment rejected successfully."})
