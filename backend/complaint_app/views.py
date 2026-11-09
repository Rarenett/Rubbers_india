from rest_framework import viewsets, permissions, status, filters
from rest_framework.response import Response
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from .models import ComplaintCategory, Complaint, ComplaintUpdate, Pattern, CommentAction, PriorityRule
from .serializers import (
    ComplaintCategorySerializer, 
    ComplaintSerializer, 
    ComplaintUpdateSerializer,
    PatternSerializer,
    CommentActionSerializer,
    PriorityRuleSerializer
)
from rarenett_app.models import Employee, DepartmentDesignation
from notifications_app.models import Notification
from django.db import models
from django.db.models import Q

class ComplaintCategoryViewSet(viewsets.ModelViewSet):
    queryset = ComplaintCategory.objects.all()
    serializer_class = ComplaintCategorySerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [filters.SearchFilter]
    search_fields = ['category_code', 'category_name']

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except models.ProtectedError as e:
            return Response(
                {"error": "Cannot delete this category because it is linked to existing complaints."},
                status=status.HTTP_400_BAD_REQUEST
            )

class PriorityRuleViewSet(viewsets.ModelViewSet):
    queryset = PriorityRule.objects.all().order_by('priority_level', '-created_at')
    serializer_class = PriorityRuleSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['rule_name', 'description']
    filterset_fields = ['is_active', 'priority_level']


class PatternViewSet(viewsets.ModelViewSet):
    queryset = Pattern.objects.all().order_by('-created_at')
    serializer_class = PatternSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['pattern_no', 'pattern_head', 'pattern_type']
    filterset_fields = ['is_active', 'pattern_type', 'category']

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except models.ProtectedError as e:
            return Response(
                {"error": "Cannot delete this pattern because it is protected or linked to other records."},
                status=status.HTTP_400_BAD_REQUEST
            )

class CommentActionViewSet(viewsets.ModelViewSet):
    queryset = CommentAction.objects.all()
    serializer_class = CommentActionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
class ComplaintViewSet(viewsets.ModelViewSet):
    queryset = Complaint.objects.all().order_by('-created_at')
    serializer_class = ComplaintSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'priority', 'category']

    @action(detail=False, methods=['get'])
    def next_id(self, request):
        last_complaint = Complaint.objects.order_by('-id').first()
        next_id = (last_complaint.id + 1) if last_complaint else 1
        return Response({'next_id': f"CMP-{next_id}"})

    @action(detail=False, methods=['get'])
    def due_reminder(self, request):
        from django.utils import timezone
        today = timezone.now().date()
        user = request.user
        
        # Only show reminders for complaints the user is explicitly allocated to (assigned, responder, or decision maker).
        # We bypass the superuser 'see-all' rule here so admins aren't spammed with everyone's reminders.
        q = Q(assigned_to=user)
        
        employee = getattr(user, 'employee', None)
        matching_patterns = []
        if employee:
            # 1. Decision Maker visibility
            q |= Q(pattern__decision_makers__id=employee.id)
            
            # 2. Responder visibility
            dept = employee.dept_designation.department if employee.dept_designation else None
            desig = employee.dept_designation.designation if employee.dept_designation else None

            for p in Pattern.objects.all():
                explicit_employees = p.employees.all()
                if explicit_employees.exists():
                    if employee in explicit_employees:
                        matching_patterns.append(p)
                else:
                    depts = p.departments.all()
                    desigs = p.designations.all()
                    if not depts.exists() and not desigs.exists():
                        continue
                    dept_ok = (not depts.exists()) or (dept in depts)
                    desig_ok = (not desigs.exists()) or (desig in desigs)
                    if dept_ok and desig_ok:
                        matching_patterns.append(p)

            if matching_patterns:
                q |= Q(pattern__in=matching_patterns)

        # If user has no allocations, they get no reminders
        if not q.children:
            return Response(None)
            
        upcoming_complaints = Complaint.objects.filter(
            q,
            status__in=['Pending', 'In Progress'],
            cutoff_date__gte=today
        ).distinct().order_by('cutoff_date')
        
        most_urgent = upcoming_complaints.first()
        if most_urgent:
            serializer = self.get_serializer(most_urgent)
            return Response(serializer.data)
        
        return Response(None)

    def get_queryset(self):
        user = self.request.user
        is_review = self.request.query_params.get('is_review') == 'true'

        # Only true superusers see ALL complaints (Django admin / system admin)
        if user.is_superuser:
            if is_review:
                voted_filter = Q(status__in=['In Progress', 'Closed', 'Resolved']) | Q(actions__isnull=False) | Q(decision_type__isnull=False)
                return Complaint.objects.filter(voted_filter).distinct().order_by('-created_at')
            return Complaint.objects.all().order_by('-created_at')
            
        from register_app.permissions_utils import get_user_permissions
        perms = get_user_permissions(user)
        
        q = Q()
        employee = getattr(user, 'employee', None)
        
        if is_review:
            # 1. Decision Directory (Review Hub) Visibility
            # A complaint only goes to the predefined evaluator side AFTER the complaint vote is done in a person
            voted_filter = Q(status__in=['In Progress', 'Closed', 'Resolved']) | Q(actions__isnull=False) | Q(decision_type__isnull=False)
            emp_filter = Q(pattern__decision_makers__id=employee.id) if employee else Q(pk__in=[])
            # Always visible if explicitly listed as Final Decision Maker AND vote is done
            q |= (emp_filter & voted_filter)
            
            if 'complaint decision' in perms and perms['complaint decision'].get('view', False):
                # If they have broad admin review permissions, also show ones with no specific decision makers configured
                q |= (Q(pattern__decision_makers__isnull=True) & voted_filter)
        else:
            # 2. Regular Complaint List Visibility
            q |= Q(user=user) | Q(assigned_to=user)
            
            # Add Responder visibility
            matching_patterns = []
            if employee:
                dept = employee.dept_designation.department if employee.dept_designation else None
                desig = employee.dept_designation.designation if employee.dept_designation else None

                for p in Pattern.objects.all():
                    is_evaluator = p.decision_makers.filter(id=employee.id).exists()
                    explicit_employees = p.employees.all()
                    if explicit_employees.exists():
                        # Pattern uses explicit employee list — only match if this employee is in it
                        if employee in explicit_employees:
                            matching_patterns.append(p)
                    else:
                        # Predefined evaluators should not receive first approval via department/designation fallback
                        if is_evaluator:
                            continue
                        depts = p.departments.all()
                        desigs = p.designations.all()

                        # If no targeting criteria at all, skip — don't expose to everyone
                        if not depts.exists() and not desigs.exists():
                            continue

                        dept_ok = (not depts.exists()) or (dept in depts)
                        desig_ok = (not desigs.exists()) or (desig in desigs)

                        if dept_ok and desig_ok:
                            matching_patterns.append(p)

                if matching_patterns:
                    q |= Q(pattern__in=matching_patterns)

        # If q is still empty, and we didn't add anything, ensure we don't return all records
        if not q.children:
            return Complaint.objects.none()

        queryset = Complaint.objects.filter(q).distinct().order_by('-created_at')
        return queryset

    def perform_create(self, serializer):
        complaint = serializer.save(user=self.request.user)
        self.route_complaint(complaint)

    def route_complaint(self, complaint):
        pattern = complaint.pattern
        if not pattern:
            return

        target_users = []
        pattern_type = pattern.pattern_type

        # Always resolve depts/desigs so they are available for HOD/BOD logic below
        depts = pattern.departments.all()
        desigs = pattern.designations.all()

        # Check for explicit employees first
        explicit_employees = pattern.employees.all()
        if explicit_employees.exists():
            employees = explicit_employees
        else:
            # If no targeting criteria at all, send no notifications — do not blast all employees
            if not depts.exists() and not desigs.exists():
                return

            # Filter by department and/or designation as configured in the pattern
            employees = Employee.objects.all()
            if depts.exists():
                employees = employees.filter(dept_designation__department__in=depts)
            if desigs.exists():
                employees = employees.filter(dept_designation__designation__in=desigs)
            
            # Exclude final decision makers (evaluators) from the primary responder routing pool
            if pattern.decision_makers.exists():
                non_evaluators = employees.exclude(id__in=pattern.decision_makers.all())
                if non_evaluators.exists():
                    employees = non_evaluators

        if pattern_type == 'Single':
            emp = employees.first()
            if emp:
                complaint.assigned_to = emp.user
                complaint.save()
                target_users.append(emp.user)

        elif pattern_type == 'Multiple':
            target_users = [emp.user for emp in employees]

        elif pattern_type == 'HOD':
            # If explicit designations aren't set, find anyone with 'HOD' in their designation name
            if not desigs.exists():
                hod_employees = employees.filter(dept_designation__designation__name__icontains='HOD')
            else:
                hod_employees = employees
            target_users = [emp.user for emp in hod_employees]

        elif pattern_type == 'BOD':
            # BOD usually doesn't care about department, but we respect it if set in Pattern
            if not desigs.exists():
                bod_employees = employees.filter(dept_designation__designation__name__icontains='BOD')
            else:
                bod_employees = employees
            target_users = [emp.user for emp in bod_employees]

        # Create notifications
        for target_user in target_users:
            if target_user != self.request.user: # Don't notify self
                Notification.objects.create(
                    recipient=target_user,
                    sender=self.request.user,
                    message=f"New complaint routed to you: {complaint.title}",
                    notification_type='complaint',
                    badge_text='Complaint',
                    badge_color='orange'
                )

    @action(detail=True, methods=['post'])
    def submit_decision(self, request, pk=None):
        complaint = self.get_object()
        
        # Check if the complaint is blocked
        is_finalized = complaint.status == 'Closed' or (complaint.admin_decision and complaint.admin_decision != 'Pending')
        
        from django.utils import timezone
        today = timezone.now().date()
        is_past_cutoff = complaint.cutoff_date and today > complaint.cutoff_date
        
        if is_finalized or is_past_cutoff:
            return Response(
                {"detail": "Cannot submit decision. The complaint is either closed, finalized by an admin, or the cutoff date has passed."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Only allow responders (assigned or in pattern) or admins to submit decision
        # Visibility is already handled by get_queryset
        
        complaint.positive_feedback = request.data.get('positive_feedback')
        complaint.negative_feedback = request.data.get('negative_feedback')
        complaint.decision_type = request.data.get('decision_type')
        complaint.responder_remarks = request.data.get('responder_remarks')
        
        if 'responder_attachment' in request.FILES:
            complaint.responder_attachment = request.FILES['responder_attachment']
            
        # Automatically transition status to Closed if a decision is made, 
        # or at least to 'In Progress' if it was Pending.
        if complaint.status == 'Pending':
            complaint.status = 'In Progress'
            
        complaint.save()
        
        # Update existing CommentAction record or create a new one for this voter
        responder_name = request.user.get_full_name() or request.user.email
        action = CommentAction.objects.filter(complaint_post=complaint, created_by=request.user).first()
        if not action:
            action = CommentAction(complaint_post=complaint, created_by=request.user)
        action.comment_name = f"Resolution by {responder_name}"
        action.positive_feedback = complaint.positive_feedback
        action.negative_feedback = complaint.negative_feedback
        action.decision = complaint.decision_type.upper() if complaint.decision_type else 'NEUTRAL'
        action.notes = complaint.responder_remarks
        if request.FILES.get('responder_attachment'):
            action.supporting_document = request.FILES.get('responder_attachment')
        action.narration = f"Resolution report submitted by {responder_name}"
        action.save()

        # Log this as a special update
        ComplaintUpdate.objects.create(
            complaint=complaint,
            user=request.user,
            status=complaint.status,
            remark=f"Decision Submitted: {complaint.decision_type}. Remarks: {complaint.responder_remarks}"
        )
        
        # Notify predefined final evaluators that the complaint vote is done and ready for final decision
        if complaint.pattern and complaint.pattern.decision_makers.exists():
            for dm in complaint.pattern.decision_makers.all():
                if dm.user and dm.user != request.user:
                    Notification.objects.create(
                        recipient=dm.user,
                        sender=request.user,
                        message=f"Complaint #{complaint.id} vote submitted by {responder_name}. Ready for final evaluation.",
                        notification_type='complaint',
                        badge_text='Evaluation',
                        badge_color='purple'
                    )

        return Response({
            "status": "success",
            "message": "Decision submitted successfully and logged for review.",
            "complaint": ComplaintSerializer(complaint, context={'request': request}).data
        })
        
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def set_admin_decision(self, request, pk=None):
        complaint = self.get_object()
        
        # Authorization: superusers can always decide. Otherwise, if the complaint's
        # pattern has specific Final Decision Makers configured, only those employees
        # (matched by pattern.decision_makers) may decide. If the pattern has no
        # decision makers configured, fall back to the legacy is_staff check.
        pattern = complaint.pattern
        is_authorized = request.user.is_superuser
        if not is_authorized:
            if pattern is not None and pattern.decision_makers.exists():
                employee = getattr(request.user, 'employee', None)
                is_authorized = employee is not None and pattern.decision_makers.filter(id=employee.id).exists()
            else:
                is_authorized = request.user.is_staff

        if not is_authorized:
            return Response({"detail": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
            
        decision = request.data.get('admin_decision')
        remarks = request.data.get('admin_remarks')
        if decision not in dict(Complaint.ADMIN_DECISION_CHOICES):
            return Response({"detail": "Invalid decision type"}, status=status.HTTP_400_BAD_REQUEST)
            
        complaint.admin_decision = decision
        if remarks is not None:
            complaint.admin_remarks = remarks
        
        # If Admin approves/rejects, maybe also close the ticket
        if decision in ['Approved', 'Rejected']:
            complaint.status = 'Closed'
            
        complaint.save()
        
        # Log this as an admin resolution
        ComplaintUpdate.objects.create(
            complaint=complaint,
            user=request.user,
            status=complaint.status,
            remark=f"Admin Final Decision: {decision}"
        )
        
        serializer = self.get_serializer(complaint)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_update(self, request, pk=None):
        complaint = self.get_object()
        serializer = ComplaintUpdateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save(complaint=complaint, user=request.user)
            
            # Update complaint status if provided
            new_status = request.data.get('status')
            if new_status:
                complaint.status = new_status
                complaint.save()
                
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        try:
            queryset = self.get_queryset()
            stats = {
                'total': queryset.count(),
                'pending': queryset.filter(status='Pending').count(),
                'in_progress': queryset.filter(status='In Progress').count(),
                'resolved': queryset.filter(status='Resolved').count(),
                'closed': queryset.filter(status='Closed').count(),
            }
            return Response(stats)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.exception("Error in statistics action")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)