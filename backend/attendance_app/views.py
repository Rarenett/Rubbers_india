from datetime import datetime
from rest_framework import viewsets, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend

from django.db import transaction
from django.db.models import Q, Sum, Value, DecimalField
from django.db.models.functions import Coalesce

from attendance_app.models import (
    LeaveType,
    LeaveRequest,
    LeaveRequestDate,
    LeaveRequestForwarding,
    LeaveRequestDocument,
    EmployeeLeaveType,
    EmployeeLeaveTransaction,
)
from attendance_app.serializers import (
    LeaveTypeSerializer,
    LeaveRequestSerializer,
    LeaveRequestDateSerializer,
    LeaveRequestForwardingSerializer,
    EmployeeLeaveTypeSerializer,
    EmployeeLeaveTransactionSerializer,
)
from register_app.models import CustomUser
from rarenett_app.models import Employee


class LeaveTypeViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows Leave Types to be viewed or edited.
    """
    queryset = LeaveType.objects.all().order_by('name')
    serializer_class = LeaveTypeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_paid', 'is_cumulative', 'can_surrender', 'is_active']
    search_fields = ['name', 'code']
    ordering_fields = [
        'id', 'name', 'code', 'annual_limit', 'max_limit',
        'apply_before_days', 'is_active', 'is_paid'
    ]

    @action(detail=True, methods=['post'], url_path='toggle-active')
    def toggle_active(self, request, pk=None):
        """
        Quick toggle to switch is_active between True and False.
        """
        leave_type = self.get_object()
        leave_type.is_active = not leave_type.is_active
        leave_type.save(update_fields=['is_active'])
        return Response({
            'status': 'success',
            'id': leave_type.id,
            'is_active': leave_type.is_active,
            'message': f"Leave type marked as {'active' if leave_type.is_active else 'inactive'}."
        }, status=status.HTTP_200_OK)


class LeaveRequestViewSet(viewsets.ModelViewSet):
    """
    API endpoint for employee Leave Requests and approval workflow.
    """
    queryset = LeaveRequest.objects.select_related(
        'employee__user',
        'employee__candidate',
        'employee__dept_designation__department',
        'leave_type',
        'approved_by'
    ).prefetch_related(
        'leave_dates',
        'forwarding_history__forwarded_by',
        'forwarding_history__forwarded_to'
    ).all()
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'employee', 'leave_type']
    search_fields = [
        'employee__user__first_name',
        'employee__user__last_name',
        'employee__user__username',
        'employee__user__email',
        'leave_type__name',
        'leave_type__code',
        'reason'
    ]
    ordering_fields = ['created_at', 'total_days', 'status']

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if not user or not user.is_authenticated:
            return qs.none()
        if user.is_superuser:
            return qs

        # For the 'list' action, display only the requests the logged-in user sent
        if self.action == 'list':
            q_filter = Q(employee__user=user)
            if user.email:
                q_filter |= Q(employee__email__iexact=user.email) | Q(employee__candidate__email__iexact=user.email)
            return qs.filter(q_filter).distinct()

        # For detail actions (retrieve, approve, reject, forward, forward_recipients, accept, decline, cancel):
        # Allow access if the user is the applicant, the assigned reviewer (current_handler),
        # in the forwarding history, or an HR administrator/personnel.
        q_detail = (
            Q(employee__user=user) |
            Q(current_handler=user) |
            Q(forwarding_history__forwarded_to=user)
        )
        if user.email:
            q_detail |= (
                Q(employee__email__iexact=user.email) |
                Q(employee__candidate__email__iexact=user.email) |
                Q(current_handler__email__iexact=user.email)
            )

        # Allow users with HR role or in HR department to review/retrieve any request
        is_hr = False
        if hasattr(user, 'role') and user.role and user.role.name and user.role.name.upper() == 'HR':
            is_hr = True
        if not is_hr and user.email:
            try:
                from rarenett_app.models import Employee
                emp = Employee.objects.filter(
                    Q(user=user) | Q(email__iexact=user.email) | Q(candidate__email__iexact=user.email)
                ).select_related('dept_designation__department').first()
                if emp and emp.dept_designation and emp.dept_designation.department:
                    if emp.dept_designation.department.name.upper() in ['HR', 'HUMAN RESOURCES']:
                        is_hr = True
            except Exception:
                pass

        if is_hr:
            return qs

        return qs.filter(q_detail).distinct()

    @staticmethod
    def get_top_hr_employee_user():
        """
        Returns the CustomUser of the top-level employee (lowest level number)
        in the HR department.
        """
        try:
            from rarenett_app.models import Department, Employee
            from register_app.models import CustomUser

            hr_depts = Department.objects.filter(
                Q(name__iexact='HR') | Q(name__icontains='Human') | Q(name__icontains='HR')
            )
            if not hr_depts.exists():
                return None

            top_emp = Employee.objects.filter(
                dept_designation__department__in=hr_depts,
                dept_designation__level__isnull=False
            ).order_by('dept_designation__level').first()

            if not top_emp:
                return None

            if top_emp.user:
                return top_emp.user
            if top_emp.email:
                u = CustomUser.objects.filter(email__iexact=top_emp.email).first()
                if u:
                    return u
            if top_emp.candidate and top_emp.candidate.email:
                u = CustomUser.objects.filter(email__iexact=top_emp.candidate.email).first()
                if u:
                    return u
        except Exception:
            pass
        return None

    @staticmethod
    def is_top_hr_employee(user):
        """
        Returns True if the given user is the top-level employee in the HR department.
        """
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        top_hr_user = LeaveRequestViewSet.get_top_hr_employee_user()
        if top_hr_user and top_hr_user.id == user.id:
            return True
        if top_hr_user and top_hr_user.email and user.email and top_hr_user.email.lower() == user.email.lower():
            return True
        return False

    @staticmethod
    def get_reporting_manager_user(employee):
        if not employee:
            return None
        from rarenett_app.models import EmploymentDetails, Employee
        from register_app.models import CustomUser

        candidate = getattr(employee, 'candidate', None)
        emp_details = None
        if candidate:
            emp_details = EmploymentDetails.objects.filter(user=candidate).first()
        if not emp_details and employee.email:
            emp_details = EmploymentDetails.objects.filter(user__email__iexact=employee.email).first()
        
        if emp_details and emp_details.reporting_manager_id:
            mgr = Employee.objects.filter(pk=emp_details.reporting_manager_id).first()
            if mgr:
                if mgr.user:
                    return mgr.user
                if mgr.email:
                    u = CustomUser.objects.filter(email__iexact=mgr.email).first()
                    if u:
                        return u
                if mgr.candidate and mgr.candidate.email:
                    u = CustomUser.objects.filter(email__iexact=mgr.candidate.email).first()
                    if u:
                        return u
        return None

    def perform_create(self, serializer):
        user = self.request.user
        emp_id = self.request.data.get('employee')
        employee = None
        if emp_id and user.is_superuser:
            employee = Employee.objects.filter(pk=emp_id).first()
        
        if not employee:
            employee = Employee.objects.filter(user=user).first()

        if not employee and user.email:
            employee = Employee.objects.filter(
                Q(email__iexact=user.email) | Q(candidate__email__iexact=user.email)
            ).first()

        if not employee:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({
                "employee": f"No employee profile found for logged-in user '{user.username}'. Please contact HR to link an employee profile to your account."
            })

        # Determine if this leave type requires approval
        leave_type_id = self.request.data.get('leave_type')
        leave_type_obj = None
        if leave_type_id:
            from attendance_app.models import LeaveType
            leave_type_obj = LeaveType.objects.filter(pk=leave_type_id).first()

        needs_approval = True
        if leave_type_obj is not None:
            needs_approval = leave_type_obj.need_approval

        if needs_approval:
            # Normal flow: assign reporting manager as handler, status stays PENDING
            reporting_manager_user = self.get_reporting_manager_user(employee)
            leave_request = serializer.save(
                employee=employee,
                current_handler=reporting_manager_user
            )

            # Notify top-level HR and reporting manager
            try:
                from notifications_app.models import Notification
                emp_name = str(employee)
                top_hr_user = self.get_top_hr_employee_user()
                if top_hr_user and top_hr_user.id != user.id:
                    Notification.objects.create(
                        recipient=top_hr_user,
                        sender=user,
                        message=f"Leave request submitted by {emp_name} ({leave_request.total_days} days). Sent to reporting manager for review.",
                        notification_type='alert',
                        badge_text='HR Leave',
                        badge_color='info',
                        icon='calendar'
                    )
                if reporting_manager_user and reporting_manager_user.id != user.id and (not top_hr_user or reporting_manager_user.id != top_hr_user.id):
                    Notification.objects.create(
                        recipient=reporting_manager_user,
                        sender=user,
                        message=f"Leave request submitted by {emp_name} ({leave_request.total_days} days) awaiting your review.",
                        notification_type='alert',
                        badge_text='Leave Review',
                        badge_color='warning',
                        icon='calendar'
                    )
            except Exception:
                pass

        else:
            # Auto-approve: no approval needed — instantly approved & accepted
            now = timezone.now()
            leave_request = serializer.save(
                employee=employee,
                current_handler=None,
                status='APPROVED',
                approved_by=user,
                approved_at=now,
                employee_decision='ACCEPTED',
                employee_accepted_at=now,
                decision_remarks='Auto-approved (no approval required for this leave type).',
            )

            # Mark all individual dates as APPROVED
            leave_request.leave_dates.all().update(status='APPROVED')

            # Deduct from leave balance: write EmployeeLeaveTransaction OUT entry
            try:
                approved_days = leave_request.total_days or leave_request.leave_dates.filter(status='APPROVED').count() or 0
                EmployeeLeaveTransaction.objects.update_or_create(
                    leave_request=leave_request,
                    defaults={
                        'employee_id': leave_request.employee_id,
                        'leave_type_id': leave_request.leave_type_id,
                        'date': now.date(),
                        'IN': 0.0,
                        'OUT': approved_days,
                        'is_approved': True,
                    }
                )
            except Exception:
                pass

            # Notify the employee themselves that the leave was auto-approved
            try:
                from notifications_app.models import Notification
                Notification.objects.create(
                    recipient=user,
                    sender=user,
                    message=f"Your leave request ({leave_request.total_days} days of {leave_request.leave_type}) has been automatically approved.",
                    notification_type='success',
                    badge_text='Auto Approved',
                    badge_color='success',
                    icon='check-circle'
                )
            except Exception:
                pass

        # Handle uploaded documents (common to both paths)
        files = self.request.FILES.getlist('documents') or self.request.FILES.getlist('files')
        for f in files:
            LeaveRequestDocument.objects.create(
                leave_request=leave_request,
                file=f,
                original_name=f.name
            )

    def perform_update(self, serializer):
        leave_request = serializer.save()
        files = self.request.FILES.getlist('documents') or self.request.FILES.getlist('files')
        for f in files:
            LeaveRequestDocument.objects.create(
                leave_request=leave_request,
                file=f,
                original_name=f.name
            )
        deleted_document_ids = self.request.data.get('deleted_document_ids')
        if deleted_document_ids:
            if isinstance(deleted_document_ids, str):
                import json
                try:
                    deleted_document_ids = json.loads(deleted_document_ids)
                except Exception:
                    deleted_document_ids = [x.strip() for x in deleted_document_ids.split(',') if x.strip()]
            if isinstance(deleted_document_ids, list):
                LeaveRequestDocument.objects.filter(leave_request=leave_request, id__in=deleted_document_ids).delete()

    @action(detail=False, methods=['get'], url_path='received')
    def received(self, request):
        """
        List leave requests received by the current user for review/approval:
        - As the current_handler (e.g. reporting manager or forwarded recipient)
        - Or any request where the user is in forwarding_history
        - Superusers can see all pending/forwarded requests across the system
        """
        user = request.user
        if not user or not user.is_authenticated:
            return Response([])

        base_qs = LeaveRequest.objects.select_related(
            'employee__user',
            'employee__dept_designation__department',
            'employee__candidate',
            'leave_type',
            'current_handler',
            'approved_by'
        ).prefetch_related(
            'leave_dates',
            'forwarding_history__forwarded_by',
            'forwarding_history__forwarded_to'
        )

        if user.is_superuser:
            q_filter = Q(current_handler=user) | Q(current_handler__isnull=True) | Q(status__in=['PENDING', 'FORWARDED'])
        elif self.is_top_hr_employee(user):
            # Top-level HR employee can view all leave requests across the company
            q_filter = Q(id__isnull=False)
        else:
            q_filter = Q(current_handler=user) | Q(forwarding_history__forwarded_to=user)

        qs = base_qs.filter(q_filter).distinct().order_by('-created_at')

        status_param = request.query_params.get('status')
        if status_param and status_param != 'ALL':
            qs = qs.filter(status=status_param)

        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """
        Approve the leave request.
        If date_decisions or approved_date_ids/rejected_date_ids are passed,
        specify individual approval/rejection per date.
        """
        leave_request = self.get_object()
        # Verify decision permission: Only reporting manager (current_handler) or superuser
        is_handler = (leave_request.current_handler_id == request.user.id) or request.user.is_superuser
        if not is_handler:
            return Response(
                {'error': "Only the assigned reporting manager can review and decide on this leave request."},
                status=status.HTTP_403_FORBIDDEN
            )

        if leave_request.status in ['APPROVED', 'PARTIALLY_APPROVED', 'CANCELLED', 'REJECTED']:
            return Response(
                {'error': f"Cannot approve leave request with status '{leave_request.status}'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        remarks = request.data.get('remarks', '')
        date_decisions = request.data.get('date_decisions')
        approved_date_ids = request.data.get('approved_date_ids')
        rejected_date_ids = request.data.get('rejected_date_ids')

        all_dates = list(leave_request.leave_dates.all())

        if date_decisions:
            for item in date_decisions:
                d_id = item.get('id') or item.get('date_id')
                d_status = (item.get('status') or 'APPROVED').upper()
                if d_status in ['APPROVED', 'REJECTED']:
                    LeaveRequestDate.objects.filter(id=d_id, leave_request=leave_request).update(status=d_status)
        elif approved_date_ids is not None or rejected_date_ids is not None:
            app_ids = set(approved_date_ids or [])
            rej_ids = set(rejected_date_ids or [])
            for d in all_dates:
                if d.id in rej_ids:
                    d.status = 'REJECTED'
                    d.save(update_fields=['status'])
                elif d.id in app_ids or not rej_ids:
                    d.status = 'APPROVED'
                    d.save(update_fields=['status'])
        else:
            # Full approval of all dates
            leave_request.leave_dates.all().update(status='APPROVED')

        approved_count = leave_request.leave_dates.filter(status='APPROVED').count()
        rejected_count = leave_request.leave_dates.filter(status='REJECTED').count()

        if approved_count > 0 and rejected_count > 0:
            leave_request.status = 'PARTIALLY_APPROVED'
            leave_request.total_days = approved_count
            leave_request.employee_decision = 'PENDING'
        elif approved_count > 0 and rejected_count == 0:
            leave_request.status = 'APPROVED'
            leave_request.total_days = approved_count
            leave_request.employee_decision = 'PENDING'
        else:
            leave_request.status = 'REJECTED'
            leave_request.total_days = 0
            leave_request.employee_decision = None

        leave_request.approved_by = request.user
        leave_request.approved_at = timezone.now()
        if remarks:
            leave_request.decision_remarks = remarks
        leave_request.save(update_fields=['status', 'total_days', 'approved_by', 'approved_at', 'decision_remarks', 'employee_decision'])

        serializer = self.get_serializer(leave_request)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        """
        Reject the leave request and all or specified dates.
        """
        leave_request = self.get_object()
        # Verify decision permission: Only reporting manager (current_handler) or superuser
        is_handler = (leave_request.current_handler_id == request.user.id) or request.user.is_superuser
        if not is_handler:
            return Response(
                {'error': "Only the assigned reporting manager can review and decide on this leave request."},
                status=status.HTTP_403_FORBIDDEN
            )

        if leave_request.status in ['APPROVED', 'PARTIALLY_APPROVED', 'CANCELLED', 'REJECTED']:
            return Response(
                {'error': f"Cannot reject leave request with status '{leave_request.status}'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        remarks = request.data.get('remarks', '')
        date_decisions = request.data.get('date_decisions')
        approved_date_ids = request.data.get('approved_date_ids')
        rejected_date_ids = request.data.get('rejected_date_ids')

        all_dates = list(leave_request.leave_dates.all())

        if date_decisions:
            for item in date_decisions:
                d_id = item.get('id') or item.get('date_id')
                d_status = (item.get('status') or 'REJECTED').upper()
                if d_status in ['APPROVED', 'REJECTED']:
                    LeaveRequestDate.objects.filter(id=d_id, leave_request=leave_request).update(status=d_status)
        elif approved_date_ids is not None or rejected_date_ids is not None:
            app_ids = set(approved_date_ids or [])
            rej_ids = set(rejected_date_ids or [])
            for d in all_dates:
                if d.id in app_ids:
                    d.status = 'APPROVED'
                    d.save(update_fields=['status'])
                elif d.id in rej_ids or not app_ids:
                    d.status = 'REJECTED'
                    d.save(update_fields=['status'])
        else:
            # Full rejection of all dates
            leave_request.leave_dates.all().update(status='REJECTED')

        approved_count = leave_request.leave_dates.filter(status='APPROVED').count()
        rejected_count = leave_request.leave_dates.filter(status='REJECTED').count()

        if approved_count > 0 and rejected_count > 0:
            leave_request.status = 'PARTIALLY_APPROVED'
            leave_request.total_days = approved_count
            leave_request.employee_decision = 'PENDING'
        elif approved_count > 0 and rejected_count == 0:
            leave_request.status = 'APPROVED'
            leave_request.total_days = approved_count
            leave_request.employee_decision = 'PENDING'
        else:
            leave_request.status = 'REJECTED'
            leave_request.total_days = 0
            leave_request.employee_decision = None

        leave_request.approved_by = request.user
        leave_request.approved_at = timezone.now()
        if remarks:
            leave_request.decision_remarks = remarks
        leave_request.save(update_fields=['status', 'total_days', 'approved_by', 'approved_at', 'decision_remarks', 'employee_decision'])

        serializer = self.get_serializer(leave_request)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='forward')
    def forward(self, request, pk=None):
        """
        Forward the leave request to another user/approver.
        """
        leave_request = self.get_object()
        # Verify decision permission: Only reporting manager (current_handler) or superuser
        is_handler = (leave_request.current_handler_id == request.user.id) or request.user.is_superuser
        if not is_handler:
            return Response(
                {'error': "Only the assigned reporting manager can forward this leave request."},
                status=status.HTTP_403_FORBIDDEN
            )

        forwarded_to_id = request.data.get('forwarded_to')
        remarks = request.data.get('remarks', '')

        if not forwarded_to_id:
            return Response(
                {'forwarded_to': 'Target user is required for forwarding.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        forwarded_to_user = CustomUser.objects.filter(pk=forwarded_to_id).first()
        if not forwarded_to_user:
            return Response(
                {'forwarded_to': 'Target user not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        LeaveRequestForwarding.objects.create(
            leave_request=leave_request,
            forwarded_by=request.user,
            forwarded_to=forwarded_to_user,
            remarks=remarks
        )

        leave_request.status = 'FORWARDED'
        leave_request.current_handler = forwarded_to_user
        leave_request.save(update_fields=['status', 'current_handler'])

        serializer = self.get_serializer(leave_request)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='forward-recipients')
    def forward_recipients(self, request, pk=None):
        """
        Return eligible recipients to whom this leave request can be forwarded:
        1. This user's (applicant's) reporting manager (from EmploymentDetails).
        2. Current user's reporting manager (if any and different).
        3. HR employees (users with role HR, in HR department, with HR designation,
           or superusers/HR administrators).
        Excludes the current logged-in user.
        """
        leave_request = self.get_object()
        current_user = request.user
        recipients = []
        seen_user_ids = set()

        # 1. This user's (applicant's) reporting manager
        if leave_request.employee:
            applicant_mgr = LeaveRequestViewSet.get_reporting_manager_user(leave_request.employee)
            if applicant_mgr and applicant_mgr.id != current_user.id:
                if applicant_mgr.id not in seen_user_ids:
                    seen_user_ids.add(applicant_mgr.id)
                    recipients.append({
                        'id': applicant_mgr.id,
                        'name': applicant_mgr.get_full_name() or applicant_mgr.username,
                        'email': applicant_mgr.email,
                        'role': 'Reporting Manager',
                        'category': 'Reporting Manager',
                        'is_reporting_manager': True
                    })

        # 2. Current user's reporting manager (if current user has an Employee & EmploymentDetails)
        cur_emp = Employee.objects.filter(user=current_user).first()
        if not cur_emp and current_user.email:
            cur_emp = Employee.objects.filter(email__iexact=current_user.email).first()
        if cur_emp:
            cur_mgr = LeaveRequestViewSet.get_reporting_manager_user(cur_emp)
            if cur_mgr and cur_mgr.id != current_user.id:
                if cur_mgr.id not in seen_user_ids:
                    seen_user_ids.add(cur_mgr.id)
                    recipients.append({
                        'id': cur_mgr.id,
                        'name': cur_mgr.get_full_name() or cur_mgr.username,
                        'email': cur_mgr.email,
                        'role': 'Reporting Manager (My Manager)',
                        'category': 'Reporting Manager',
                        'is_reporting_manager': True
                    })

        # 3. HR employees
        hr_query = Q(role__name__iexact='HR') | \
                   Q(role__name__icontains='HR') | \
                   Q(employee__dept_designation__department__name__icontains='HR') | \
                   Q(employee__dept_designation__department__name__icontains='Human') | \
                   Q(employee__dept_designation__designation__name__icontains='HR') | \
                   Q(employee__candidate__employment_details__roles__name__iexact='HR')

        hr_users = CustomUser.objects.filter(hr_query, is_active=True).distinct()
        for u in hr_users:
            if u.id != current_user.id and u.id not in seen_user_ids:
                seen_user_ids.add(u.id)
                recipients.append({
                    'id': u.id,
                    'name': u.get_full_name() or u.username,
                    'email': u.email,
                    'role': u.role.name if u.role else 'HR',
                    'category': 'HR',
                    'is_hr': True
                })

        # Fallback to active superusers as HR administrators if no user has explicit HR role yet
        if not any(r.get('is_hr') for r in recipients):
            superusers = CustomUser.objects.filter(is_superuser=True, is_active=True)
            for su in superusers:
                if su.id != current_user.id and su.id not in seen_user_ids:
                    seen_user_ids.add(su.id)
                    recipients.append({
                        'id': su.id,
                        'name': su.get_full_name() or su.username,
                        'email': su.email,
                        'role': 'HR Admin',
                        'category': 'HR',
                        'is_hr': True
                    })

        return Response(recipients, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='employee-history')
    def employee_history(self, request):
        """
        Returns a detailed view of the last leaves taken by an employee
        along with leave balances calculated from EmployeeLeaveTransaction.
        Query params:
        - leave_request: ID of current leave request (to resolve employee & exclude current request)
        - employee: ID of employee
        - limit: number of past leaves to return (default 10)
        """
        leave_request_id = request.query_params.get('leave_request') or request.query_params.get('leave_request_id')
        emp_id = request.query_params.get('employee') or request.query_params.get('employee_id')
        cand_id = request.query_params.get('candidate') or request.query_params.get('candidate_id')
        limit = int(request.query_params.get('limit') or 10)

        current_request = None
        target_employee = None

        if leave_request_id:
            current_request = LeaveRequest.objects.filter(pk=leave_request_id).first()
            if current_request:
                target_employee = current_request.employee

        if not target_employee and emp_id and emp_id != 'me':
            target_employee = Employee.objects.filter(Q(pk=emp_id) | Q(user_id=emp_id)).first()

        if not target_employee and cand_id:
            target_employee = Employee.objects.filter(
                Q(candidate_id=cand_id) | Q(user_id=cand_id) | Q(id=cand_id)
            ).first()

        if not target_employee and request.user.is_authenticated:
            target_employee = Employee.objects.filter(user=request.user).first()
            if not target_employee and request.user.email:
                target_employee = Employee.objects.filter(
                    Q(email__iexact=request.user.email) | Q(candidate__email__iexact=request.user.email)
                ).first()

        if not target_employee:
            return Response({
                'employee': None,
                'leaves_taken': [],
                'all_recent_requests': [],
                'balances': {},
                'total_days_taken': 0
            }, status=status.HTTP_200_OK)

        date_from = request.query_params.get('date_from') or request.query_params.get('from_date')
        date_to = request.query_params.get('date_to') or request.query_params.get('to_date')

        # Query past leaves taken (approved / partially approved)
        past_qs = LeaveRequest.objects.filter(
            employee=target_employee,
            status__in=['APPROVED', 'PARTIALLY_APPROVED']
        )
        if current_request:
            past_qs = past_qs.exclude(pk=current_request.pk)

        if date_from:
            try:
                datetime.strptime(str(date_from).strip(), '%Y-%m-%d')
                past_qs = past_qs.filter(leave_dates__date__gte=date_from)
            except (ValueError, TypeError):
                pass
        if date_to:
            try:
                datetime.strptime(str(date_to).strip(), '%Y-%m-%d')
                past_qs = past_qs.filter(leave_dates__date__lte=date_to)
            except (ValueError, TypeError):
                pass

        past_qs = past_qs.distinct().select_related(
            'leave_type', 'approved_by'
        ).prefetch_related('leave_dates').order_by('-created_at')[:limit]

        leaves_taken = []
        for lr in past_qs:
            approved_dates = [
                d.date.strftime('%Y-%m-%d')
                for d in lr.leave_dates.filter(status='APPROVED').order_by('date')
            ]
            all_dates = [
                {'date': d.date.strftime('%Y-%m-%d'), 'status': d.status}
                for d in lr.leave_dates.order_by('date')
            ]
            leaves_taken.append({
                'id': lr.id,
                'leave_type_id': lr.leave_type_id,
                'leave_type_name': lr.leave_type.name if lr.leave_type else '',
                'leave_type_code': lr.leave_type.code if lr.leave_type else '',
                'leave_type_is_paid': lr.leave_type.is_paid if lr.leave_type else True,
                'total_days': float(lr.total_days or 0),
                'reason': lr.reason,
                'status': lr.status,
                'employee_decision': lr.employee_decision,
                'approved_by_name': (
                    lr.approved_by.get_full_name() or lr.approved_by.username
                ) if lr.approved_by else None,
                'approved_at': lr.approved_at.isoformat() if lr.approved_at else None,
                'decision_remarks': lr.decision_remarks,
                'created_at': lr.created_at.isoformat() if lr.created_at else None,
                'approved_dates': approved_dates,
                'dates': all_dates,
            })

        # Query all recent requests (including rejected/cancelled/pending for full context)
        recent_qs = LeaveRequest.objects.filter(employee=target_employee)
        if current_request:
            recent_qs = recent_qs.exclude(pk=current_request.pk)
        recent_qs = recent_qs.select_related(
            'leave_type', 'approved_by'
        ).prefetch_related('leave_dates').order_by('-created_at')[:limit]

        all_recent = []
        for lr in recent_qs:
            all_recent.append({
                'id': lr.id,
                'leave_type_id': lr.leave_type_id,
                'leave_type_name': lr.leave_type.name if lr.leave_type else '',
                'leave_type_code': lr.leave_type.code if lr.leave_type else '',
                'leave_type_is_paid': lr.leave_type.is_paid if lr.leave_type else True,
                'total_days': float(lr.total_days or 0),
                'reason': lr.reason,
                'status': lr.status,
                'employee_decision': lr.employee_decision,
                'approved_by_name': (
                    lr.approved_by.get_full_name() or lr.approved_by.username
                ) if lr.approved_by else None,
                'approved_at': lr.approved_at.isoformat() if lr.approved_at else None,
                'decision_remarks': lr.decision_remarks,
                'created_at': lr.created_at.isoformat() if lr.created_at else None,
                'dates': [
                    {'date': d.date.strftime('%Y-%m-%d'), 'status': d.status}
                    for d in lr.leave_dates.order_by('date')
                ],
            })

        # Calculate leave balances from EmployeeLeaveTransaction
        agg_qs = EmployeeLeaveTransaction.objects.filter(
            employee=target_employee
        ).values('leave_type_id').annotate(
            total_in=Coalesce(Sum('IN'), Value(0, output_field=DecimalField())),
            total_out=Coalesce(Sum('OUT'), Value(0, output_field=DecimalField()))
        )

        balances = {}
        for row in agg_qs:
            lt_id = row['leave_type_id']
            tin = float(row['total_in'] or 0)
            tout = float(row['total_out'] or 0)
            balances[lt_id] = {
                'leave_type_id': lt_id,
                'total_in': tin,
                'total_out': tout,
                'remaining': tin - tout,
            }

        active_types = LeaveType.objects.filter(is_active=True).values('id', 'name', 'code')
        for lt in active_types:
            lt_id = lt['id']
            if lt_id not in balances:
                balances[lt_id] = {
                    'leave_type_id': lt_id,
                    'leave_type_name': lt['name'],
                    'leave_type_code': lt['code'],
                    'total_in': 0.0,
                    'total_out': 0.0,
                    'remaining': 0.0,
                }
            else:
                balances[lt_id]['leave_type_name'] = lt['name']
                balances[lt_id]['leave_type_code'] = lt['code']

        total_taken = sum(l['total_days'] for l in leaves_taken)

        emp_name = str(target_employee)
        if target_employee.user:
            emp_name = target_employee.user.get_full_name() or target_employee.user.username
        elif getattr(target_employee, 'candidate', None) and getattr(target_employee.candidate, 'full_name', None):
            emp_name = target_employee.candidate.full_name

        emp_data = {
            'id': target_employee.id,
            'name': emp_name,
            'department': (
                target_employee.dept_designation.department.name
                if (target_employee.dept_designation and target_employee.dept_designation.department)
                else None
            ),
            'designation': (
                target_employee.dept_designation.designation.name
                if (target_employee.dept_designation and target_employee.dept_designation.designation)
                else None
            ),
        }

        return Response({
            'employee': emp_data,
            'current_leave_type_id': current_request.leave_type_id if current_request else None,
            'current_leave_type_name': current_request.leave_type.name if (current_request and current_request.leave_type) else None,
            'current_leave_type_code': current_request.leave_type.code if (current_request and current_request.leave_type) else None,
            'leaves_taken': leaves_taken,
            'all_recent_requests': all_recent,
            'balances': balances,
            'total_days_taken': total_taken,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        """
        Cancel a pending or forwarded leave request.
        """
        leave_request = self.get_object()
        is_applicant = (
            request.user.is_superuser or
            (leave_request.employee and leave_request.employee.user_id == request.user.id)
        )
        if not is_applicant:
            return Response(
                {'error': "Only the applicant can cancel this leave request."},
                status=status.HTTP_403_FORBIDDEN
            )

        if leave_request.status in ['CANCELLED', 'REJECTED', 'APPROVED', 'PARTIALLY_APPROVED']:
            return Response(
                {'error': f"Cannot cancel leave request with status '{leave_request.status}'."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        leave_request.status = 'CANCELLED'
        leave_request.save(update_fields=['status'])
        serializer = self.get_serializer(leave_request)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='accept')
    def accept(self, request, pk=None):
        """
        Employee acceptance of approved or partially approved leave.
        Request status remains APPROVED or PARTIALLY_APPROVED.
        Employee decision is recorded as ACCEPTED.
        """
        leave_request = self.get_object()
        is_applicant = (
            request.user.is_superuser or
            (leave_request.employee and leave_request.employee.user_id == request.user.id)
        )
        if not is_applicant:
            return Response(
                {'error': "Only the applicant can accept or decline this leave request."},
                status=status.HTTP_403_FORBIDDEN
            )

        if leave_request.status not in ['APPROVED', 'PARTIALLY_APPROVED']:
            return Response(
                {'error': "Only approved or partially approved requests can be accepted."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if leave_request.employee_decision == 'ACCEPTED':
            return Response(
                {'error': "This leave request has already been accepted."},
                status=status.HTTP_400_BAD_REQUEST
            )

        leave_request.employee_decision = 'ACCEPTED'
        leave_request.employee_accepted_at = timezone.now()
        leave_request.save(update_fields=['employee_decision', 'employee_accepted_at'])

        # Save to EmployeeLeaveTransaction: date = approved_date, IN = 0, OUT = approved days, is_approved = 1
        approved_date = leave_request.approved_at.date() if leave_request.approved_at else timezone.now().date()
        approved_days = leave_request.total_days or leave_request.leave_dates.filter(status='APPROVED').count() or 0

        EmployeeLeaveTransaction.objects.update_or_create(
            leave_request=leave_request,
            defaults={
                'employee_id': leave_request.employee_id,
                'leave_type_id': leave_request.leave_type_id,
                'date': approved_date,
                'IN': 0.0,
                'OUT': approved_days,
                'is_approved': True,
            }
        )

        serializer = self.get_serializer(leave_request)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='decline')
    def decline(self, request, pk=None):
        """
        Employee declines approved or partially approved leave.
        Request status remains APPROVED or PARTIALLY_APPROVED.
        Employee decision is recorded as DECLINED.
        """
        leave_request = self.get_object()
        is_applicant = (
            request.user.is_superuser or
            (leave_request.employee and leave_request.employee.user_id == request.user.id)
        )
        if not is_applicant:
            return Response(
                {'error': "Only the applicant can accept or decline this leave request."},
                status=status.HTTP_403_FORBIDDEN
            )

        if leave_request.status not in ['APPROVED', 'PARTIALLY_APPROVED']:
            return Response(
                {'error': "Only approved or partially approved requests can be declined."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if leave_request.employee_decision == 'DECLINED':
            return Response(
                {'error': "This leave request has already been declined."},
                status=status.HTTP_400_BAD_REQUEST
            )

        reason = request.data.get('reason', '')
        leave_request.employee_decision = 'DECLINED'
        leave_request.employee_declined_at = timezone.now()
        leave_request.employee_decline_reason = reason
        leave_request.save(update_fields=['employee_decision', 'employee_declined_at', 'employee_decline_reason'])

        # If a transaction was previously created for this leave request, clean it up
        EmployeeLeaveTransaction.objects.filter(leave_request=leave_request).delete()

        serializer = self.get_serializer(leave_request)
        return Response(serializer.data, status=status.HTTP_200_OK)


class LeaveRequestDateViewSet(viewsets.ModelViewSet):
    """
    API endpoint for individual Leave Request Dates.
    """
    queryset = LeaveRequestDate.objects.all().order_by('date')
    serializer_class = LeaveRequestDateSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['leave_request', 'status', 'date']
    ordering_fields = ['date', 'status']


class LeaveRequestForwardingViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for viewing Leave Request Forwarding history.
    """
    queryset = LeaveRequestForwarding.objects.select_related('forwarded_by', 'forwarded_to').all().order_by('forwarded_at')
    serializer_class = LeaveRequestForwardingSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['leave_request', 'forwarded_by', 'forwarded_to']


class EmployeeLeaveTypeViewSet(viewsets.ModelViewSet):
    """
    API endpoint for mapping which Leave Types are available for an Employee with effective_from.
    """
    queryset = EmployeeLeaveType.objects.select_related('employee', 'leave_type').all()
    serializer_class = EmployeeLeaveTypeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['leave_type', 'is_active']
    search_fields = [
        'employee__user__first_name',
        'employee__user__last_name',
        'employee__user__username',
        'leave_type__name',
        'leave_type__code',
    ]
    ordering_fields = ['effective_from', 'leave_type__name', 'id', 'created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        emp_id = self.request.query_params.get('employee') or self.request.query_params.get('employee_id')
        cand_id = self.request.query_params.get('candidate') or self.request.query_params.get('candidate_id')
        for_current_user = self.request.query_params.get('for_current_user')

        if emp_id == 'me' or for_current_user:
            qs = qs.filter(employee__user=self.request.user)
        elif emp_id:
            qs = qs.filter(employee_id=emp_id)
        elif cand_id:
            qs = qs.filter(Q(employee__candidate_id=cand_id) | Q(employee__user_id=cand_id) | Q(employee_id=cand_id))

        effective_from = self.request.query_params.get('effective_from')
        if effective_from:
            qs = qs.filter(effective_from=effective_from)

        return qs.order_by('effective_from', 'leave_type__name', 'id')

    @action(detail=False, methods=['post'], url_path='bulk-save')
    def bulk_save(self, request):
        emp_id = request.data.get('employee') or request.data.get('employee_id')
        cand_id = request.data.get('candidate') or request.data.get('candidate_id')

        if not emp_id and cand_id:
            from hr_app.models import Candidate
            candidate_obj = Candidate.objects.filter(id=cand_id).first()
            if candidate_obj and hasattr(candidate_obj, 'employee_profile') and candidate_obj.employee_profile:
                emp_id = candidate_obj.employee_profile.id

        if not emp_id and cand_id:
            from rarenett_app.models import Employee
            emp = Employee.objects.filter(candidate_id=cand_id).first()
            if not emp:
                emp = Employee.objects.filter(user_id=cand_id).first()
            if emp:
                emp_id = emp.id

        if not emp_id:
            return Response({'detail': 'Employee ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        rows = request.data.get('rows', [])
        with transaction.atomic():
            EmployeeLeaveType.objects.filter(employee_id=emp_id).delete()
            created_instances = []
            for r in rows:
                leave_type_id = r.get('leave_type')
                effective_from = r.get('effective_from')
                if not leave_type_id or not effective_from:
                    continue

                is_active = r.get('is_active', True)
                if isinstance(is_active, str):
                    is_active = is_active.lower() in ['true', '1', 'yes']

                annual_limit = r.get('annual_limit')
                if annual_limit == '' or annual_limit is None:
                    annual_limit = None
                else:
                    try:
                        annual_limit = float(annual_limit)
                    except (ValueError, TypeError):
                        annual_limit = None

                inst = EmployeeLeaveType.objects.create(
                    employee_id=emp_id,
                    leave_type_id=leave_type_id,
                    effective_from=effective_from,
                    annual_limit=annual_limit,
                    is_active=is_active
                )
                created_instances.append(inst)

            serialized = EmployeeLeaveTypeSerializer(created_instances, many=True)
            return Response(serialized.data, status=status.HTTP_200_OK)


class EmployeeLeaveTransactionViewSet(viewsets.ModelViewSet):
    """
    API endpoint for viewing and managing Employee Leave Transactions (ledger entries).
    """
    queryset = EmployeeLeaveTransaction.objects.select_related('employee', 'leave_type').all()
    serializer_class = EmployeeLeaveTransactionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['employee', 'leave_type', 'is_approved', 'date']
    search_fields = [
        'employee__user__first_name',
        'employee__user__last_name',
        'employee__user__username',
        'leave_type__name',
        'leave_type__code',
    ]
    ordering_fields = ['date', 'created_at', 'id', 'IN', 'OUT']

    def get_queryset(self):
        qs = super().get_queryset()
        emp_id = self.request.query_params.get('employee') or self.request.query_params.get('employee_id')
        cand_id = self.request.query_params.get('candidate') or self.request.query_params.get('candidate_id')
        for_current_user = self.request.query_params.get('for_current_user')

        if emp_id == 'me' or for_current_user:
            qs = qs.filter(employee__user=self.request.user)
        elif emp_id:
            qs = qs.filter(employee_id=emp_id)
        elif cand_id:
            qs = qs.filter(Q(employee__candidate_id=cand_id) | Q(employee__user_id=cand_id) | Q(employee_id=cand_id))

        leave_type_id = self.request.query_params.get('leave_type') or self.request.query_params.get('leave_type_id')
        if leave_type_id:
            qs = qs.filter(leave_type_id=leave_type_id)

        date_from = self.request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(date__gte=date_from)

        date_to = self.request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(date__lte=date_to)

        return qs.order_by('-date', '-id')

    @action(detail=False, methods=['get'], url_path='balances')
    def balances(self, request):
        """
        Calculates remaining leave balance for an employee per leave type.
        Formula: Remaining = SUM(IN) - SUM(OUT)
        Calculated from EmployeeLeaveTransaction.
        """
        user = request.user
        emp_id = request.query_params.get('employee') or request.query_params.get('employee_id')
        cand_id = request.query_params.get('candidate') or request.query_params.get('candidate_id')

        target_employee = None
        if emp_id and emp_id != 'me':
            target_employee = Employee.objects.filter(Q(pk=emp_id) | Q(user_id=emp_id)).first()
        elif cand_id:
            target_employee = Employee.objects.filter(
                Q(candidate_id=cand_id) | Q(user_id=cand_id) | Q(id=cand_id)
            ).first()
        elif user and user.is_authenticated:
            target_employee = Employee.objects.filter(user=user).first()
            if not target_employee and user.email:
                target_employee = Employee.objects.filter(
                    Q(email__iexact=user.email) | Q(candidate__email__iexact=user.email)
                ).first()

        if not target_employee:
            return Response({})

        agg_qs = EmployeeLeaveTransaction.objects.filter(
            employee=target_employee
        ).values('leave_type_id').annotate(
            total_in=Coalesce(Sum('IN'), Value(0, output_field=DecimalField())),
            total_out=Coalesce(Sum('OUT'), Value(0, output_field=DecimalField()))
        )

        result = {}
        for row in agg_qs:
            lt_id = row['leave_type_id']
            tin = float(row['total_in'] or 0)
            tout = float(row['total_out'] or 0)
            remaining = tin - tout
            result[lt_id] = {
                'leave_type_id': lt_id,
                'total_in': tin,
                'total_out': tout,
                'remaining': remaining,
            }

        active_types = LeaveType.objects.filter(is_active=True).values_list('id', flat=True)
        for lt_id in active_types:
            if lt_id not in result:
                result[lt_id] = {
                    'leave_type_id': lt_id,
                    'total_in': 0.0,
                    'total_out': 0.0,
                    'remaining': 0.0,
                }

        return Response(result)

