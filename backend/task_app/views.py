from asyncio import mixins
from django.db.models import Q, F
from django.http.multipartparser import MultiPartParser
from django.shortcuts import render
from django.utils import timezone
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
# Create your views here.
from rest_framework import generics, status
from rest_framework import viewsets, permissions, filters, status
from rest_framework.mixins import DestroyModelMixin
from rest_framework.response import Response
from django.db import models
from decimal import Decimal
from urllib3 import request
from .models import Subtask, SubtaskAttachment, Task, TaskAttachment, TaskCategory, TaskProgressUpdate, TaskSubCategory, TaskVoteRequest,Team,TaskAssignment
from .serializers import MyLeafAssignmentSerializer, SubtaskSerializer, TaskAttachmentSerializer, TaskCategorySerializer, TaskProgressUpdateSerializer, TaskSerializer, TaskSubCategorySerializer, TaskVoteRequestSerializer, TaskVoterSerializer,DepartmentSerializer,EmployeeMiniSerializer,TeamSerializer,TaskAssignmentSerializer,TaskAssignmentBulkSaveSerializer
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rarenett_app.models import Employee,Department
from .serializers import SubtaskSerializer, TaskAttachmentSerializer, TaskCategorySerializer, TaskSerializer, TaskSubCategorySerializer, TaskVoteRequestSerializer, TaskVoterSerializer,DepartmentSerializer,EmployeeMiniSerializer,TeamSerializer,TaskAssignmentSerializer,TaskAssignmentBulkSaveSerializer, MyAssignedSubtaskSerializer
from .utils import get_completion_and_due_info

class TaskCategoryViewSet(viewsets.ModelViewSet):
    queryset = TaskCategory.objects.all().order_by('category_name')
    serializer_class = TaskCategorySerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [filters.SearchFilter]
    search_fields = ['category_name']

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except models.ProtectedError:
            return Response(
                {"error": "Cannot delete this category because it is linked to existing tasks."},
                status=status.HTTP_400_BAD_REQUEST
            )

class TaskSubCategoryViewSet(viewsets.ModelViewSet):
    queryset = TaskSubCategory.objects.select_related('category').all().order_by(
        'category__category_name', 'subcategory_name'
    )
    serializer_class = TaskSubCategorySerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [filters.SearchFilter]
    search_fields = ['subcategory_name', 'category__category_name']
 
    def get_queryset(self):
        queryset = super().get_queryset()
        category_id = self.request.query_params.get('category')
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        return queryset
 
    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except models.ProtectedError:
            return Response(
                {"error": "Cannot delete this sub-category because it is linked to existing tasks."},
                status=status.HTTP_400_BAD_REQUEST
            )

class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.select_related('subcategory', 'subcategory__category').prefetch_related('attachments').all().order_by('-created_at')
    serializer_class = TaskSerializer
    permission_classes = [permissions.AllowAny]
    # MultiPartParser/FormParser are required to accept file uploads
    # (multipart/form-data) alongside the plain JSON case.
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [filters.SearchFilter]
    search_fields = ['task_name']
 
    def get_queryset(self):
        queryset = super().get_queryset()
        task_type = self.request.query_params.get('task_type')
        if task_type:
            queryset = queryset.filter(task_type=task_type)
        subcategory_id = self.request.query_params.get('subcategory')
        if subcategory_id:
            queryset = queryset.filter(subcategory_id=subcategory_id)
        return queryset
 
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task = serializer.save()
        self._save_attachments(task, request)
        out_serializer = self.get_serializer(task)
        headers = self.get_success_headers(out_serializer.data)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED, headers=headers)
 
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        task = serializer.save()
        self._save_attachments(task, request)
        out_serializer = self.get_serializer(task)
        return Response(out_serializer.data)
 
    def _save_attachments(self, task, request):
        # Multiple files are sent under the same form field name
        # ("attachments"); request.FILES.getlist collects all of them.
        files = request.FILES.getlist('attachments')
        for f in files:
            TaskAttachment.objects.create(task=task, file=f, original_filename=f.name)
 
    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except models.ProtectedError:
            return Response(
                {"error": "Cannot delete this task because it is linked to other records."},
                status=status.HTTP_400_BAD_REQUEST
            )
 
 
class TaskAttachmentViewSet(DestroyModelMixin, viewsets.GenericViewSet):
    
    queryset = TaskAttachment.objects.all()
    serializer_class = TaskAttachmentSerializer
    permission_classes = [permissions.AllowAny]

def is_admin_user(user):
    if not user or not user.is_authenticated:
        return False
    return bool(
        user.is_superuser or
        (getattr(user, 'role', None) and getattr(user.role, 'name', '') and user.role.name.lower() in ['admin', 'administrator', 'super admin']) or
        getattr(user, 'username', '').lower() in ['admin', 'superuser'] or
        getattr(user, 'username', '').lower().startswith('admin')
    )


def _get_all_subtask_ids_for_task(task_id):
    subtask_ids = set()
    queue = list(Subtask.objects.filter(task_id=task_id).values_list('id', flat=True))
    while queue:
        sid = queue.pop(0)
        subtask_ids.add(sid)
        for cid in Subtask.objects.filter(parent_subtask_id=sid).values_list('id', flat=True):
            if cid not in subtask_ids:
                queue.append(cid)
    return subtask_ids


class SubtaskListCreateView(generics.ListCreateAPIView):
    queryset = Subtask.objects.all().order_by('-created_at')
    serializer_class = SubtaskSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [IsAuthenticated]

    def get_serializer_context(self):
        return {'request': self.request}

    def get_queryset(self):
        qs = super().get_queryset()
        task_id = self.request.query_params.get('task')
        if task_id:
            qs = qs.filter(task_id=task_id)
        parent_subtask_id = self.request.query_params.get('parent_subtask')
        if parent_subtask_id:
            qs = qs.filter(parent_subtask_id=parent_subtask_id)

        user = self.request.user
        if not user or not user.is_authenticated:
            return qs.none()

        if not is_admin_user(user):
            # If a specific task or parent_subtask is being queried (e.g. for splitting on Assign Task page),
            # preserve task-specific assignment logic. For the general subtask list, only return subtasks
            # created by the logged-in user.
            if not task_id and not parent_subtask_id:
                qs = qs.filter(Q(created_by=user) | Q(assignments__assigned_by=user)).distinct()

        return qs


class SubtaskDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Subtask.objects.all()
    serializer_class = SubtaskSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [IsAuthenticated]

    def get_serializer_context(self):
        return {'request': self.request}

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user or not user.is_authenticated:
            return qs.none()

        if not is_admin_user(user):
            qs = qs.filter(Q(created_by=user) | Q(assignments__assigned_by=user)).distinct()

        return qs


class SubtaskAttachmentDeleteView(APIView):
    def delete(self, request, pk):
        try:
            attachment = SubtaskAttachment.objects.get(pk=pk)
        except SubtaskAttachment.DoesNotExist:
            return Response({'error': 'Attachment not found'}, status=status.HTTP_404_NOT_FOUND)
        attachment.file.delete(save=False)
        attachment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class TaskVoteRequestViewSet(viewsets.ModelViewSet):
    queryset = TaskVoteRequest.objects.select_related(
        'task', 'assigned_employee', 'assigned_department'
    ).prefetch_related('voters')
    serializer_class = TaskVoteRequestSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'], url_path='cast-vote')
    def cast_vote(self, request, pk=None):
        vote_request = self.get_object()
        if not vote_request.is_open or vote_request.result_status in ('approved', 'rejected'):
            return Response({'detail': 'Voting is closed for this task.'}, status=400)

        vote_value = request.data.get('vote')
        if vote_value not in ('yes', 'no'):
            return Response({'detail': 'vote must be "yes" or "no".'}, status=400)

        employee = Employee.objects.filter(user=request.user).first()
        bod = getattr(request.user, 'bod_profile', None)

        voter = None
        if employee:
            voter = vote_request.voters.filter(employee=employee).first()
        if not voter and bod:
            voter = vote_request.voters.filter(bod=bod).first()

        if not voter:
            return Response({'detail': 'You are not an approver for this task.'}, status=403)

        voter.vote = vote_value
        voter.remarks = request.data.get('remarks', '')
        voter.voted_at = timezone.now()
        voter.save()
        return Response(TaskVoterSerializer(voter).data)

    @action(detail=True, methods=['post'], url_path='reschedule')
    def reschedule(self, request, pk=None):
        vote_request = self.get_object()
        new_cutoff = request.data.get('cutoff_date')
        if not new_cutoff:
            return Response({'detail': 'New cutoff date & time is required.'}, status=status.HTTP_400_BAD_REQUEST)

        remarks = request.data.get('remarks', '')
        if remarks is not None:
            vote_request.remarks = remarks

        vote_request.cutoff_date = new_cutoff
        vote_request.is_active = True
        # Marks the start of a NEW voting round. Only voters who are still
        # 'pending' belong to this new round — anyone who already voted
        # keeps their vote from the earlier round and won't see this
        # request again.
        vote_request.reopened_at = timezone.now()
        vote_request.save()

        # Clear stray remarks/voted_at on pending voters only.
        # Already-cast yes/no votes are never touched.
        vote_request.voters.filter(vote='pending').update(remarks='', voted_at=None)

        serializer = self.get_serializer(vote_request)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='my-pending-votes')
    def my_pending_votes(self, request):
        employee = Employee.objects.filter(user=request.user).first()
        bod = getattr(request.user, 'bod_profile', None)
        if not employee and not bod:
            return Response([])

        qs = self.get_queryset().filter(is_active=True)
        visible = []
        for vr in qs:
            if not vr.is_open:
                continue  # cutoff passed -> hidden from everyone

            # If final decision has already been taken before cutoff date, disappear from my-vote page
            if vr.result_status in ('approved', 'rejected'):
                continue

            voter = None
            if employee:
                voter = vr.voters.filter(employee=employee).first()
            if not voter and bod:
                voter = vr.voters.filter(bod=bod).first()
            if not voter:
                continue  # not one of this request's voters
            # Visible while voting is open and final decision is not yet reached, allowing voters to change their vote
            visible.append(vr)

        return Response(self.get_serializer(visible, many=True).data)

    @action(detail=False, methods=['get'], url_path='my-created-requests')
    def my_created_requests(self, request):
        """Assigned-By side: every request I created, with full voter breakdown."""
        qs = self.get_queryset().filter(created_by=request.user).order_by('-created_at')
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=False, methods=['get'], url_path='my-assigned-tasks')
    def my_assigned_tasks(self, request):
        """Assigned-To side: only tasks that already passed their vote."""
        if is_admin_user(request.user):
            qs = self.get_queryset().filter(is_active=True).distinct()
            approved = [vr for vr in qs if vr.result_status == 'approved']
            return Response(self.get_serializer(approved, many=True).data)

        employee = Employee.objects.filter(user=request.user).first()
        if not employee:
            return Response([])
        qs = self.get_queryset().filter(
            Q(assigned_employee=employee) |
            Q(
                task__task_type='individual',
                task__assignments__employee=employee,
                task__assignments__percentage=Decimal('100.00'),
                task__assignments__parent_subtask__isnull=True,
                task__assignments__subtask__subtask_name=F('task__task_name')
            ),
            is_active=True
        ).distinct()
        approved = [vr for vr in qs if vr.result_status == 'approved']
        return Response(self.get_serializer(approved, many=True).data)


# Team

class DepartmentListView(generics.ListAPIView):
    """All departments, for the 'All Departments' team-building mode."""
    queryset = Department.objects.all().order_by('name')  # adjust ordering field if needed
    serializer_class = DepartmentSerializer
    permission_classes = [permissions.AllowAny]
 
 
class DepartmentEmployeeListView(generics.ListAPIView):
    """Employees belonging to one department, fetched when its checkbox is ticked."""
    serializer_class = EmployeeMiniSerializer
    permission_classes = [permissions.AllowAny]
 
    def get_queryset(self):
        department_id = self.kwargs['department_id']
        # NOTE: 'department' is assumed to be the FK name on Employee that
        # points to Department. Change 'department_id' below if yours differs.
        return Employee.objects.filter(dept_designation__department_id=department_id).order_by('id')
 
 
class MyDepartmentEmployeeListView(generics.ListAPIView):
    """Employees in the current user's own department, for the 'My Department' mode."""
    serializer_class = EmployeeMiniSerializer
    permission_classes = [IsAuthenticated]
 
    def get_queryset(self):
        me = Employee.objects.filter(user=self.request.user).first()
        # NOTE: same assumption as above — Employee.department_id.
        dept_id = me.dept_designation.department_id if (me and me.dept_designation) else None
        if not dept_id:
            return Employee.objects.none()
        return Employee.objects.filter(dept_designation__department_id=dept_id).order_by('id')
 
 
class TeamViewSet(viewsets.ModelViewSet):
    queryset = Team.objects.select_related('task', 'created_by').prefetch_related('members__employee').all()
    serializer_class = TeamSerializer
    permission_classes = [IsAuthenticated]
 
    def get_serializer_context(self):
        return {'request': self.request}
 
    def get_queryset(self):
        queryset = super().get_queryset()
        task_id = self.request.query_params.get('task')
        if task_id:
            queryset = queryset.filter(task_id=task_id)
        subtask_id = self.request.query_params.get('subtask')
        if subtask_id:
            queryset = queryset.filter(subtask_id=subtask_id)
        return queryset

# Assign Task
class TaskAssignmentViewSet(viewsets.ModelViewSet):
    queryset = TaskAssignment.objects.select_related('task', 'subtask', 'employee').all()
    serializer_class = TaskAssignmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        task_id = self.request.query_params.get('task')
        if task_id:
            queryset = queryset.filter(task_id=task_id)
        parent_subtask_id = self.request.query_params.get('parent_subtask')
        if parent_subtask_id:
            queryset = queryset.filter(parent_subtask_id=parent_subtask_id)
        return queryset

    @action(detail=False, methods=['get'], url_path='current-employee')
    def current_employee(self, request):
        employee = Employee.objects.filter(user=request.user).first()
        if not employee:
            return Response(None)
        return Response(EmployeeMiniSerializer(employee, context={'request': request}).data)

    @action(detail=False, methods=['post'], url_path='bulk-save')
    def bulk_save(self, request):
        serializer = TaskAssignmentBulkSaveSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        saved = serializer.save()
        out = TaskAssignmentSerializer(saved, many=True)
        return Response(out.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='approve-member')
    def approve_member(self, request):
        task_id = request.data.get('task')
        parent_subtask_id = request.data.get('parent_subtask')
        employee_id = request.data.get('employee')
        employee_ids = request.data.get('employee_ids')

        if not task_id and not parent_subtask_id:
            return Response({'error': 'Task or parent subtask ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        qs = TaskAssignment.objects.all()
        if task_id:
            qs = qs.filter(task_id=task_id, parent_subtask__isnull=True)
        elif parent_subtask_id:
            qs = qs.filter(parent_subtask_id=parent_subtask_id)

        if employee_ids and isinstance(employee_ids, list):
            qs = qs.filter(employee_id__in=employee_ids)
        elif employee_id and employee_id != 'all':
            qs = qs.filter(employee_id=employee_id)

        if not qs.exists():
            return Response({'error': 'No assignments found to approve.'}, status=status.HTTP_404_NOT_FOUND)

        count = qs.update(is_approved=True)
        return Response({'message': f'Approved {count} assignment(s).', 'count': count}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='approve-all')
    def approve_all(self, request):
        return self.approve_member(request)

    @action(detail=False, methods=['get'], url_path='my-subtasks')
    def my_subtasks(self, request):
        """Every subtask assigned to me at ANY depth, as an independent task
        card — own name, own team, own documents.

        Includes both:
        - Level-2 assignments (subtask directly from a top-level task)
        - Level-3+ assignments (sub-subtask from another person's subtask)
        No parent_subtask__isnull filter so N-level depth works correctly.
        """
        if is_admin_user(request.user):
            qs = (
                TaskAssignment.objects
                .filter(is_approved=True)
                .exclude(
                    subtask__task_type='individual',
                    subtask__subtask_name=F('task__task_name'),
                    percentage=Decimal('100.00')
                )
                .select_related('subtask', 'task', 'assigned_by', 'parent_subtask', 'employee')
                .prefetch_related('subtask__attachments', 'subtask__subtask_teams__members__employee')
            )
            serializer = MyAssignedSubtaskSerializer(qs, many=True, context={'request': request})
            return Response(serializer.data)

        employee = Employee.objects.filter(user=request.user).first()
        if not employee:
            return Response([])
        qs = (
            TaskAssignment.objects
            .filter(employee=employee, is_approved=True)
            .exclude(
                subtask__task_type='individual',
                subtask__subtask_name=F('task__task_name'),
                percentage=Decimal('100.00')
            )
            .select_related('subtask', 'task', 'assigned_by', 'parent_subtask')
            .prefetch_related('subtask__attachments', 'subtask__subtask_teams__members__employee')
        )
        serializer = MyAssignedSubtaskSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='my-leaf-assignments')
    def my_leaf_assignments(self, request):
        """Every task assigned to me or delegated by me. Powers the task cards on the 'Update Progress' page.
        """
        data = []
        seen_task_ids = set()
        seen_assignment_ids = set()

        if is_admin_user(request.user):
            # Admin view: see all approved tasks in pending/all tasks, and all delegated subtasks in delegated tasks
            # 1. Approved tasks (from TaskVoteRequest)
            approved_vrs = (
                TaskVoteRequest.objects
                .filter(is_active=True)
                .select_related('task', 'task__subcategory', 'assigned_employee', 'created_by')
                .order_by('-created_at')
            )
            approved_vrs = [vr for vr in approved_vrs if vr.result_status == 'approved']
            for vr in approved_vrs:
                if vr.task_id in seen_task_ids:
                    continue
                seen_task_ids.add(vr.task_id)
                task = vr.task
                completed_pct = round(float(task.completed_percentage), 1)
                rollup_pct = round(float(task.rollup_percentage), 1)
                creator_name = (
                    vr.created_by.get_full_name() or vr.created_by.username
                    if vr.created_by else 'Management'
                )
                has_subtasks = task.subtasks.exists() or task.assignments.filter(is_approved=True).exists()
                cutoff_dt, submission_dt, due_dates_count = get_completion_and_due_info(vr, completed_pct=completed_pct)

                data.append({
                    'id': f"vr_{vr.id}",
                    'subtask': None,
                    'subtask_name': task.task_name,
                    'subtask_description': task.description,
                    'task_name': task.subcategory.subcategory_name if (task.subcategory and hasattr(task.subcategory, 'subcategory_name')) else None,
                    'task_start_date': task.start_date or (task.created_at.date() if task.created_at else None),
                    'task_due_date': task.due_date,
                    'start_date': task.start_date or (task.created_at.date() if task.created_at else None),
                    'end_date': task.due_date,
                    'created_at': task.created_at,
                    'parent_subtask_name': None,
                    'assigned_by_name': creator_name,
                    'assigned_to_name': str(vr.assigned_employee) if vr.assigned_employee else None,
                    'completed_percentage': completed_pct,
                    'remaining_percentage': max(0.0, 100.0 - completed_pct),
                    'is_delegated': False,
                    'can_update_progress': True,
                    'is_delegated_by_me': False,
                    'has_subtasks': has_subtasks,
                    'auto_rollup_percentage': rollup_pct,
                    'cutoff_date': cutoff_dt,
                    'submission_date': submission_dt,
                    'due_dates_count': due_dates_count,
                })

            # 2. Approved delegated subtask assignments (appear in Delegated Tasks tab for admin)
            delegated_assignments = (
                TaskAssignment.objects
                .filter(is_approved=True)
                .exclude(
                    subtask__task_type='individual',
                    subtask__subtask_name=F('task__task_name'),
                    percentage=Decimal('100.00')
                )
                .select_related('subtask', 'subtask__task', 'task', 'parent_subtask', 'employee', 'assigned_by')
                .order_by('-created_at')
            )
            for a in delegated_assignments:
                if a.id in seen_assignment_ids:
                    continue
                seen_assignment_ids.add(a.id)
                item = MyLeafAssignmentSerializer(a, context={'request': request}).data
                item['is_delegated'] = True
                item['can_update_progress'] = True
                item['is_delegated_by_me'] = True
                item['assigned_to_name'] = str(a.employee) if a.employee else None
                item['assigned_by_name'] = (
                    a.assigned_by.get_full_name() or a.assigned_by.username
                    if a.assigned_by else None
                )
                data.append(item)

            return Response(data)

        # Non-admin users: exact existing logic
        employee = Employee.objects.filter(user=request.user).first()

        # 1. Assignments where current user is the assignee
        if employee:
            qs = (
                TaskAssignment.objects
                .filter(employee=employee, is_approved=True)
                .exclude(
                    subtask__task_type='individual',
                    subtask__subtask_name=F('task__task_name'),
                    percentage=Decimal('100.00')
                )
                .select_related('subtask', 'subtask__task', 'task', 'parent_subtask', 'assigned_by')
            )
            for a in qs:
                seen_assignment_ids.add(a.id)
                item = MyLeafAssignmentSerializer(a, context={'request': request}).data
                item['is_delegated_by_me'] = False
                item['can_update_progress'] = True
                item['has_subtasks'] = a.is_delegated
                if a.is_delegated:
                    item['auto_rollup_percentage'] = float(a.completed_percentage)
                item['is_delegated'] = False
                data.append(item)

        # 2. Tasks created by the current user and assigned to others via approved TaskVoteRequest
        # (e.g. John created a task and assigned to Aleena; John monitors it under Delegated Tasks)
        created_vote_requests = (
            TaskVoteRequest.objects
            .filter(created_by=request.user, is_active=True)
            .select_related('task', 'task__subcategory', 'assigned_employee', 'created_by')
            .order_by('-created_at')
        )
        if employee:
            created_vote_requests = created_vote_requests.exclude(assigned_employee=employee)
        approved_vrs = [vr for vr in created_vote_requests if vr.result_status == 'approved']
        for vr in approved_vrs:
            if vr.task_id in seen_task_ids:
                continue
            seen_task_ids.add(vr.task_id)
            task = vr.task
            completed_pct = round(float(task.completed_percentage), 1)
            rollup_pct = round(float(task.rollup_percentage), 1)
            cutoff_dt, submission_dt, due_dates_count = get_completion_and_due_info(vr, completed_pct=completed_pct)

            data.append({
                'id': f"vr_{vr.id}",
                'subtask': None,
                'subtask_name': task.task_name,
                'subtask_description': task.description,
                'task_name': task.subcategory.subcategory_name if (task.subcategory and hasattr(task.subcategory, 'subcategory_name')) else None,
                'task_start_date': task.start_date or (task.created_at.date() if task.created_at else None),
                'task_due_date': task.due_date,
                'start_date': task.start_date or (task.created_at.date() if task.created_at else None),
                'end_date': task.due_date,
                'created_at': task.created_at,
                'parent_subtask_name': None,
                'assigned_by_name': None,
                'assigned_to_name': str(vr.assigned_employee) if vr.assigned_employee else None,
                'completed_percentage': completed_pct,
                'remaining_percentage': max(0.0, 100.0 - completed_pct),
                'is_delegated': True,
                'can_update_progress': False,
                'is_delegated_by_me': True,
                'has_subtasks': True,
                'auto_rollup_percentage': rollup_pct,
                'cutoff_date': cutoff_dt,
                'submission_date': submission_dt,
                'due_dates_count': due_dates_count,
            })

        # 3. Tasks assigned to the current user via approved TaskVoteRequest
        # (e.g. John assigned task to Aleena; Aleena is responsible to John, so it stays in My Pending Tasks with Update + Details)
        if employee:
            assigned_vote_requests = (
                TaskVoteRequest.objects
                .filter(assigned_employee=employee, is_active=True)
                .select_related('task', 'task__subcategory', 'assigned_employee', 'created_by')
                .order_by('-created_at')
            )
            approved_assigned_vrs = [
                vr for vr in assigned_vote_requests
                if vr.result_status == 'approved'
            ]
            for vr in approved_assigned_vrs:
                if vr.task_id in seen_task_ids:
                    continue
                seen_task_ids.add(vr.task_id)
                task = vr.task
                completed_pct = round(float(task.completed_percentage), 1)
                rollup_pct = round(float(task.rollup_percentage), 1)

                creator_name = (
                    vr.created_by.get_full_name() or vr.created_by.username
                    if vr.created_by else 'Management'
                )

                has_subtasks = task.subtasks.exists() or task.assignments.filter(is_approved=True).exists()
                cutoff_dt, submission_dt, due_dates_count = get_completion_and_due_info(vr, completed_pct=completed_pct)

                data.append({
                    'id': f"vr_{vr.id}",
                    'subtask': None,
                    'subtask_name': task.task_name,
                    'subtask_description': task.description,
                    'task_name': task.subcategory.subcategory_name if (task.subcategory and hasattr(task.subcategory, 'subcategory_name')) else None,
                    'task_start_date': task.start_date or (task.created_at.date() if task.created_at else None),
                    'task_due_date': task.due_date,
                    'start_date': task.start_date or (task.created_at.date() if task.created_at else None),
                    'end_date': task.due_date,
                    'created_at': task.created_at,
                    'parent_subtask_name': None,
                    'assigned_by_name': creator_name,
                    'assigned_to_name': None,
                    'completed_percentage': completed_pct,
                    'remaining_percentage': max(0.0, 100.0 - completed_pct),
                    'is_delegated': False,
                    'can_update_progress': True,
                    'is_delegated_by_me': False,
                    'has_subtasks': has_subtasks,
                    'auto_rollup_percentage': rollup_pct,
                    'cutoff_date': cutoff_dt,
                    'submission_date': submission_dt,
                    'due_dates_count': due_dates_count,
                })

        # 4. Assignments where current user assigned the subtask to someone else (delegated split subtasks)
        # OR split subtasks belonging to tasks/subtasks assigned to the current user (e.g. split by admin)
        delegated_filter = Q(assigned_by=request.user, is_approved=True)
        if employee:
            my_subtask_ids = list(
                TaskAssignment.objects
                .filter(employee=employee, is_approved=True)
                .values_list('subtask_id', flat=True)
            )
            all_my_subtask_ids = set(my_subtask_ids)
            stack = list(my_subtask_ids)
            while stack:
                curr = stack.pop()
                children = list(Subtask.objects.filter(parent_subtask_id=curr).values_list('id', flat=True))
                for ch in children:
                    if ch not in all_my_subtask_ids:
                        all_my_subtask_ids.add(ch)
                        stack.append(ch)

            my_vr_task_ids = list(
                TaskVoteRequest.objects
                .filter(assigned_employee=employee, is_active=True)
                .values_list('task_id', flat=True)
            )

            if all_my_subtask_ids:
                delegated_filter |= Q(parent_subtask_id__in=all_my_subtask_ids, is_approved=True)

            if my_vr_task_ids:
                delegated_filter |= Q(task_id__in=my_vr_task_ids, parent_subtask__isnull=True, is_approved=True)

        delegated_qs = TaskAssignment.objects.filter(delegated_filter)
        if employee:
            delegated_qs = delegated_qs.exclude(employee=employee)
        delegated_assignments = delegated_qs.select_related('subtask', 'subtask__task', 'task', 'parent_subtask', 'employee', 'assigned_by')
        for a in delegated_assignments:
            if a.id in seen_assignment_ids:
                continue
            seen_assignment_ids.add(a.id)
            item = MyLeafAssignmentSerializer(a, context={'request': request}).data
            item['is_delegated'] = True
            item['can_update_progress'] = False
            item['is_delegated_by_me'] = True
            item['assigned_to_name'] = str(a.employee) if a.employee else None
            item['assigned_by_name'] = (
                a.assigned_by.get_full_name() or a.assigned_by.username
                if a.assigned_by else None
            )
            data.append(item)

        return Response(data)

    @action(detail=False, methods=['get'], url_path='subtasks-overview')
    def subtasks_overview(self, request):
        """Returns the task and all its subtasks + assigned persons for the Detail view."""
        assignment_id = request.query_params.get('assignment')
        if not assignment_id:
            return Response({'error': 'assignment parameter is required'}, status=status.HTTP_400_BAD_REQUEST)

        task = None
        vr = None
        target_assignment = None

        if str(assignment_id).startswith('vr_'):
            vr_id = str(assignment_id).replace('vr_', '')
            try:
                vr = TaskVoteRequest.objects.select_related('task', 'assigned_employee', 'created_by').get(id=vr_id)
                task = vr.task
            except (TaskVoteRequest.DoesNotExist, ValueError):
                return Response({'error': 'Vote request not found'}, status=status.HTTP_404_NOT_FOUND)
        elif str(assignment_id).isdigit():
            try:
                target_assignment = TaskAssignment.objects.select_related('task', 'subtask').get(id=assignment_id)
                task = target_assignment.task or (target_assignment.subtask.get_root_task() if target_assignment.subtask else None)
            except TaskAssignment.DoesNotExist:
                return Response({'error': 'Assignment not found'}, status=status.HTTP_404_NOT_FOUND)

        if not task:
            return Response({'subtasks': [], 'task': None})

        # Find all descendant subtasks
        subtask_ids = _get_all_subtask_ids_for_task(task.id)

        # Get all approved assignments for this task and its subtasks
        assignments_qs = (
            TaskAssignment.objects
            .filter(
                Q(task=task) | Q(subtask_id__in=subtask_ids),
                is_approved=True
            )
            .select_related('subtask', 'employee', 'parent_subtask', 'assigned_by')
            .order_by('id')
        )

        all_assignments = list(assignments_qs)
        is_scoped = False

        if request.user and request.user.is_authenticated and not is_admin_user(request.user) and not str(assignment_id).startswith('vr_'):
            employee = Employee.objects.filter(user=request.user).first()
            # Seed assignments given TO them (employee = me) or BY them (assigned_by = me)
            seed_assignments = [
                a for a in all_assignments
                if (employee and a.employee_id == employee.id) or (a.assigned_by_id == request.user.id)
            ]
            if seed_assignments:
                visible_ids = {a.id for a in seed_assignments}
                subtask_queue = [a.subtask_id for a in seed_assignments if a.subtask_id]
                seen_subtask_ids = set(subtask_queue)

                while subtask_queue:
                    curr_subtask_id = subtask_queue.pop(0)
                    for a in all_assignments:
                        is_child = (
                            a.parent_subtask_id == curr_subtask_id or
                            (a.subtask_id and a.subtask and a.subtask.parent_subtask_id == curr_subtask_id)
                        )
                        if is_child and a.id not in visible_ids:
                            visible_ids.add(a.id)
                            if a.subtask_id and a.subtask_id not in seen_subtask_ids:
                                seen_subtask_ids.add(a.subtask_id)
                                subtask_queue.append(a.subtask_id)

                all_assignments = [a for a in all_assignments if a.id in visible_ids]
                is_scoped = True

        subtasks_data = []
        for a in all_assignments:
            st_completed = float(a.completed_percentage or 0)
            st_cutoff, st_submission, st_due_count = get_completion_and_due_info(a, completed_pct=st_completed)
            subtasks_data.append({
                'id': a.id,
                'subtask_id': a.subtask_id,
                'subtask_name': a.subtask.subtask_name if a.subtask else task.task_name,
                'subtask_type': a.subtask.task_type if a.subtask else 'individual',
                'subtask_type_display': a.subtask.get_task_type_display() if a.subtask else 'Individual',
                'employee_id': a.employee_id,
                'employee_name': str(a.employee) if a.employee else '—',
                'percentage': float(a.percentage or 0),
                'completed_percentage': st_completed,
                'parent_subtask_id': a.parent_subtask_id,
                'parent_subtask_name': a.parent_subtask.subtask_name if a.parent_subtask else None,
                'assigned_by_name': (
                    a.assigned_by.get_full_name() or a.assigned_by.username
                    if a.assigned_by else None
                ),
                'start_date': a.subtask.start_date if (a.subtask and a.subtask.start_date) else task.start_date,
                'end_date': a.subtask.end_date if (a.subtask and a.subtask.end_date) else task.due_date,
                'cutoff_date': st_cutoff,
                'submission_date': st_submission,
                'due_dates_count': st_due_count,
            })

        if not subtasks_data:
            assigned_emp = (vr.assigned_employee if vr else None)
            d_completed = float(task.completed_percentage or 0)
            d_cutoff, d_submission, d_due_count = get_completion_and_due_info(vr if vr else task, completed_pct=d_completed)
            subtasks_data.append({
                'id': f"direct_{task.id}",
                'subtask_id': None,
                'subtask_name': task.task_name,
                'subtask_type': task.task_type,
                'subtask_type_display': task.get_task_type_display() if hasattr(task, 'get_task_type_display') else task.task_type,
                'employee_id': assigned_emp.id if assigned_emp else None,
                'employee_name': str(assigned_emp) if assigned_emp else '—',
                'percentage': 100.0,
                'completed_percentage': d_completed,
                'parent_subtask_id': None,
                'parent_subtask_name': None,
                'assigned_by_name': (
                    (vr.created_by.get_full_name() or vr.created_by.username)
                    if (vr and vr.created_by) else 'Management'
                ),
                'start_date': task.start_date,
                'end_date': task.due_date,
                'cutoff_date': d_cutoff,
                'submission_date': d_submission,
                'due_dates_count': d_due_count,
            })

        if target_assignment and is_scoped:
            t_completed = float(target_assignment.completed_percentage or 0)
            t_obj = target_assignment
        else:
            t_completed = float(task.completed_percentage or 0)
            t_obj = vr if vr else task

        t_cutoff, t_submission, t_due_count = get_completion_and_due_info(t_obj, completed_pct=t_completed)
        task_payload = {
            'id': task.id,
            'task_name': task.task_name,
            'completed_percentage': t_completed,
            'rollup_percentage': float(task.rollup_percentage or 0),
            'due_date': task.due_date,
            'assigned_employee_name': str(vr.assigned_employee) if (vr and vr.assigned_employee) else None,
            'created_by_name': (
                (vr.created_by.get_full_name() or vr.created_by.username)
                if (vr and vr.created_by) else 'Management'
            ),
            'cutoff_date': t_cutoff,
            'submission_date': t_submission,
            'due_dates_count': t_due_count,
        }

        return Response({
            'task': task_payload,
            'subtasks': subtasks_data,
        })

    def get_serializer_context(self):
        return {'request': self.request}


class TaskProgressUpdateViewSet(viewsets.ModelViewSet):
    """Log entries for the 'Update Progress' page: Description of Work,
    Challenges Faced, Pending Task, and the % completed since the last
    entry. GET ?assignment=<id> returns that assignment's update history
    (newest first) for the progress-bar timeline."""
    queryset = TaskProgressUpdate.objects.select_related(
        'assignment', 'assignment__subtask', 'task', 'created_by'
    ).all()
    serializer_class = TaskProgressUpdateSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_context(self):
        return {'request': self.request}

    def get_queryset(self):
        queryset = super().get_queryset()
        assignment_id = self.request.query_params.get('assignment')
        if assignment_id:
            if str(assignment_id).startswith('vr_'):
                vr_id = str(assignment_id).replace('vr_', '')
                try:
                    vr = TaskVoteRequest.objects.get(id=vr_id)
                    subtask_ids = _get_all_subtask_ids_for_task(vr.task_id)
                    return queryset.filter(
                        Q(task_id=vr.task_id) |
                        Q(assignment__task_id=vr.task_id) |
                        Q(assignment__subtask_id__in=subtask_ids)
                    ).distinct().order_by('-created_at')
                except (TaskVoteRequest.DoesNotExist, ValueError):
                    return queryset.none()
            elif str(assignment_id).isdigit():
                try:
                    assign = TaskAssignment.objects.get(id=assignment_id)
                    descendant_ids = [assign.id]
                    if assign.subtask_id:
                        stack = [assign.subtask_id]
                        while stack:
                            parent_id = stack.pop()
                            children = TaskAssignment.objects.filter(parent_subtask_id=parent_id)
                            for child in children:
                                descendant_ids.append(child.id)
                                if child.subtask_id:
                                    stack.append(child.subtask_id)
                    return queryset.filter(
                        assignment_id__in=descendant_ids
                    ).distinct().order_by('-created_at')
                except TaskAssignment.DoesNotExist:
                    return queryset.none()
            else:
                return queryset.none()
        return queryset


    def create(self, request, *args, **kwargs):
        assignment_val = request.data.get('assignment')
        if assignment_val and str(assignment_val).startswith('vr_'):
            vr_id = str(assignment_val).replace('vr_', '')
            try:
                vr = TaskVoteRequest.objects.get(id=vr_id)
                task = vr.task
                if hasattr(request.data, '_mutable') and not request.data._mutable:
                    request.data._mutable = True
                request.data['task'] = task.id
                request.data['assignment'] = None
                request.data['is_cumulative'] = True
                if 'percentage' not in request.data or request.data.get('percentage') in [None, '', 'undefined']:
                    request.data['percentage'] = str(task.completed_percentage)
            except (TaskVoteRequest.DoesNotExist, ValueError):
                pass
        elif assignment_val and str(assignment_val).isdigit():
            pass
        return super().create(request, *args, **kwargs)


# ─── My Task Report ───

def _report_attach_children(assignment, depth=0, max_depth=25):
    """Recursively attach an in-memory `_children` list of TaskAssignment
    rows delegated further from `assignment`'s own subtask. Depth-limited
    as a safety net against accidental circular data."""
    if depth >= max_depth:
        assignment._children = []
        return
    children = list(
        TaskAssignment.objects
        .filter(parent_subtask_id=assignment.subtask_id)
        .select_related('subtask', 'employee', 'assigned_by')
        .order_by('id')
    )
    assignment._children = children
    for child in children:
        _report_attach_children(child, depth + 1, max_depth)


def _report_build_split_tree(task):
    """Top-level TaskAssignment rows for `task` (parent_subtask is null,
    task=task), each with its full descendant tree attached via
    `_report_attach_children`."""
    top_nodes = list(
        TaskAssignment.objects
        .filter(task=task, parent_subtask__isnull=True)
        .select_related('subtask', 'employee', 'assigned_by')
        .order_by('id')
    )
    for node in top_nodes:
        _report_attach_children(node)
    return top_nodes


def _report_serialize_node(assignment, employee_id):
    children = getattr(assignment, '_children', [])
    completed = assignment.completed_percentage
    return {
        'assignment_id': assignment.id,
        'subtask_id': assignment.subtask_id,
        'subtask_name': assignment.subtask.subtask_name if assignment.subtask_id else None,
        'subtask_type': assignment.subtask.task_type if assignment.subtask_id else None,
        'employee_id': assignment.employee_id,
        'employee_name': str(assignment.employee) if assignment.employee_id else None,
        'is_me': bool(employee_id and assignment.employee_id == employee_id),
        'percentage': float(assignment.percentage or 0),
        'completed_percentage': float(completed),
        'remaining_percentage': float(max(Decimal('0'), Decimal('100') - Decimal(str(completed or 0)))),
        'is_delegated': assignment.is_delegated,
        'assigned_by_name': (
            (assignment.assigned_by.get_full_name() or assignment.assigned_by.username)
            if assignment.assigned_by_id else None
        ),
        'created_at': assignment.created_at,
        'children': [_report_serialize_node(c, employee_id) for c in children],
    }


def _report_flatten_my_nodes(nodes, acc):
    for n in nodes:
        if n['is_me']:
            acc.append(n)
        _report_flatten_my_nodes(n['children'], acc)


class MyTaskReportView(APIView):
    """
    GET /api/task/my-task-report/

    Report for the currently logged-in user: every task they're involved
    with (as an original assignee, or as someone a subtask/sub-subtask was
    delegated to), their own row(s) inside that task, and the complete
    split of the task across everyone it was divided among.

    Optional query param `status`:
      - 'active'    -> only tasks not yet 100% complete
      - 'completed' -> only tasks at 100% complete
      - 'overdue'   -> only tasks past their due date and not complete
      (omit for every task)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = Employee.objects.filter(user=request.user).first()
        is_admin = is_admin_user(request.user)
        empty = {
            'summary': {
                'total_tasks': 0, 'completed_tasks': 0,
                'in_progress_tasks': 0, 'overdue_tasks': 0,
                'average_completion': 0,
            },
            'tasks': [],
        }
        if not employee and not is_admin:
            return Response(empty)

        employee_id = employee.id if employee else None

        if not is_admin:
            # 1. Tasks where I hold a direct, top-level TaskAssignment.
            task_ids = set(
                TaskAssignment.objects
                .filter(employee=employee, task__isnull=False, is_approved=True)
                .values_list('task_id', flat=True)
            )

            # 2. Tasks where I hold a nested assignment (a subtask or
            # sub-subtask delegated down to me) — walk up to the root Task.
            nested_assignments = (
                TaskAssignment.objects
                .filter(employee=employee, task__isnull=True, is_approved=True)
                .select_related('subtask', 'parent_subtask')
            )
            for a in nested_assignments:
                root = None
                if a.subtask_id:
                    root = a.subtask.get_root_task()
                elif a.parent_subtask_id:
                    root = a.parent_subtask.get_root_task()
                if root:
                    task_ids.add(root.id)

            # 3. Tasks assigned to me via an approved TaskVoteRequest, even
            # before any TaskAssignment row exists yet (fresh approval).
            approved_vr_task_ids = set()
            vr_qs = list(
                TaskVoteRequest.objects
                .filter(assigned_employee=employee, is_active=True)
                .select_related('task', 'created_by')
            )
            for vr in vr_qs:
                if vr.result_status == 'approved':
                    approved_vr_task_ids.add(vr.task_id)
            task_ids |= approved_vr_task_ids

            tasks_qs = (
                Task.objects
                .filter(id__in=task_ids)
                .select_related('subcategory', 'subcategory__category')
                .order_by('-created_at')
            )
        else:
            approved_vr_task_ids = set()
            vr_qs = []
            tasks_qs = (
                Task.objects
                .all()
                .select_related('subcategory', 'subcategory__category')
                .order_by('-created_at')
            )

        status_filter = request.query_params.get('status')
        import datetime
        today = datetime.date.today()

        report_rows = []
        completed_count = 0
        in_progress_count = 0
        overdue_count = 0
        completion_total = Decimal('0')
        total_tasks = 0

        for task in tasks_qs:
            total_tasks += 1
            split_tree_nodes = _report_build_split_tree(task)
            split_tree = [_report_serialize_node(n, employee_id) for n in split_tree_nodes]

            my_assignments = []
            _report_flatten_my_nodes(split_tree, my_assignments)

            if not split_tree:
                if not is_admin:
                    # Assigned directly to me but not split into any TaskAssignment
                    # row yet (approved just now, nothing logged so far).
                    if task.id in approved_vr_task_ids:
                        vr = next(
                            (v for v in vr_qs if v.task_id == task.id and v.result_status == 'approved'),
                            None
                        )
                        synthetic = {
                            'assignment_id': None,
                            'subtask_id': None,
                            'subtask_name': task.task_name,
                            'subtask_type': task.task_type,
                            'employee_id': employee.id,
                            'employee_name': str(employee),
                            'is_me': True,
                            'percentage': 100.0,
                            'completed_percentage': float(task.completed_percentage),
                            'remaining_percentage': float(
                                max(Decimal('0'), Decimal('100') - Decimal(str(task.completed_percentage or 0)))
                            ),
                            'is_delegated': False,
                            'assigned_by_name': (
                                (vr.created_by.get_full_name() or vr.created_by.username)
                                if (vr and vr.created_by_id) else 'Management'
                            ),
                            'created_at': vr.created_at if vr else task.created_at,
                            'children': [],
                        }
                        my_assignments = [synthetic]
                        split_tree = [synthetic]
                else:
                    # Admin view: check if there's an approved vote request with an assigned employee
                    vr_list = list(
                        task.vote_requests
                        .filter(is_active=True)
                        .select_related('assigned_employee', 'created_by')
                    )
                    vr = next((v for v in vr_list if v.result_status == 'approved' and v.assigned_employee), None)
                    if vr and vr.assigned_employee:
                        target_emp = vr.assigned_employee
                        is_me = bool(employee and target_emp.id == employee.id)
                        synthetic = {
                            'assignment_id': None,
                            'subtask_id': None,
                            'subtask_name': task.task_name,
                            'subtask_type': task.task_type,
                            'employee_id': target_emp.id,
                            'employee_name': str(target_emp),
                            'is_me': is_me,
                            'percentage': 100.0,
                            'completed_percentage': float(task.completed_percentage),
                            'remaining_percentage': float(
                                max(Decimal('0'), Decimal('100') - Decimal(str(task.completed_percentage or 0)))
                            ),
                            'is_delegated': False,
                            'assigned_by_name': (
                                (vr.created_by.get_full_name() or vr.created_by.username)
                                if (vr and vr.created_by_id) else 'Management'
                            ),
                            'created_at': vr.created_at,
                            'children': [],
                        }
                        split_tree = [synthetic]
                        if is_me:
                            my_assignments = [synthetic]

            task_completed_pct = float(task.completed_percentage)
            is_overdue = bool(task.due_date and task.due_date < today and task_completed_pct < 100)

            if task_completed_pct >= 100:
                completed_count += 1
            else:
                in_progress_count += 1
            if is_overdue:
                overdue_count += 1
            completion_total += Decimal(str(task_completed_pct))

            row = {
                'task': {
                    'id': task.id,
                    'task_name': task.task_name,
                    'task_type': task.task_type,
                    'category_name': (
                        task.subcategory.category.category_name
                        if (task.subcategory_id and task.subcategory.category_id) else None
                    ),
                    'subcategory_name': task.subcategory.subcategory_name if task.subcategory_id else None,
                    'description': task.description,
                    'start_date': task.start_date,
                    'due_date': task.due_date,
                    'is_active': task.is_active,
                    'is_overdue': is_overdue,
                    'completed_percentage': task_completed_pct,
                },
                'my_assignments': my_assignments,
                'split_tree': split_tree,
            }

            if status_filter == 'completed' and task_completed_pct < 100:
                continue
            if status_filter == 'active' and task_completed_pct >= 100:
                continue
            if status_filter == 'overdue' and not is_overdue:
                continue

            report_rows.append(row)

        avg_completion = float(round(completion_total / total_tasks, 2)) if total_tasks else 0

        summary = {
            'total_tasks': total_tasks,
            'completed_tasks': completed_count,
            'in_progress_tasks': in_progress_count,
            'overdue_tasks': overdue_count,
            'average_completion': avg_completion,
        }

        return Response({'summary': summary, 'tasks': report_rows})


# ─── Vote Status Report: Not Voted / Not Started After Voting ───


def _vote_report_task_payload(task):
    return {
        'id': task.id,
        'task_name': task.task_name,
        'task_type': task.task_type,
        'category_name': (
            task.subcategory.category.category_name
            if task.subcategory and task.subcategory.category else None
        ),
        'subcategory_name': task.subcategory.subcategory_name if task.subcategory else None,
        'start_date': task.start_date,
        'due_date': task.due_date,
        'completed_percentage': float(task.completed_percentage or 0),
    }


def _vote_report_voter_name(voter):
    if voter.bod_id:
        return voter.bod.name
    if voter.employee_id:
        return str(voter.employee)
    return None


def _vote_report_requests(request):
    """Active vote requests the logged-in user is involved in: created by
    them, assigned to them, or where they are a voter, or all if superuser."""
    if request.user.is_superuser:
        return (
            TaskVoteRequest.objects
            .filter(is_active=True)
            .select_related(
                'task', 'task__subcategory', 'task__subcategory__category',
                'assigned_employee', 'assigned_department', 'created_by',
            )
            .prefetch_related('voters', 'voters__employee', 'voters__bod')
            .distinct()
            .order_by('-created_at')
        )

    employee = Employee.objects.filter(user=request.user).first()
    bod = getattr(request.user, 'bod_profile', None)

    involved = Q(created_by=request.user)
    if employee:
        involved |= Q(assigned_employee=employee) | Q(voters__employee=employee)
    if bod:
        involved |= Q(voters__bod=bod)

    return (
        TaskVoteRequest.objects
        .filter(involved, is_active=True)
        .select_related(
            'task', 'task__subcategory', 'task__subcategory__category',
            'assigned_employee', 'assigned_department', 'created_by',
        )
        .prefetch_related('voters', 'voters__employee', 'voters__bod')
        .distinct()
        .order_by('-created_at')
    )


def _vote_report_common(vr):
    return {
        'vote_request_id': vr.id,
        'task': _vote_report_task_payload(vr.task),
        'approval_type': vr.approval_type,
        'assigned_employee_name': str(vr.assigned_employee) if vr.assigned_employee_id else None,
        'assigned_department_name': vr.assigned_department.name if vr.assigned_department_id else None,
        'created_by_name': (
            (vr.created_by.get_full_name() or vr.created_by.username)
            if vr.created_by_id else None
        ),
    }


class NotVotedTasksReportView(APIView):
    """
    GET /api/task/not-voted-tasks-report/

    Active vote requests (that the logged-in user created, is assigned to,
    or is a voter on) where at least one voter has still not voted —
    whether voting is still open or the cutoff passed with votes missing.
    """



    permission_classes = [IsAuthenticated]

    def get(self, request):
        items = []
        for vr in _vote_report_requests(request):
            voters = list(vr.voters.all())
            pending_voters = [v for v in voters if v.vote == 'pending']
            if not pending_voters:
                continue
            items.append({
                **_vote_report_common(vr),
                'cutoff_date': vr.cutoff_date,
                'is_open': vr.is_open,
                'cutoff_passed': not vr.is_open,
                'result_status': vr.result_status,
                'total_voters': len(voters),
                'yes_count': sum(1 for v in voters if v.vote == 'yes'),
                'no_count': sum(1 for v in voters if v.vote == 'no'),
                'pending_count': len(pending_voters),
                'pending_voters': [_vote_report_voter_name(v) for v in pending_voters],
                'remarks': vr.remarks,
                'created_at': vr.created_at,
            })

        summary = {
            'total_tasks': len(items),
            'voting_open': sum(1 for i in items if not i['cutoff_passed']),
            'cutoff_passed': sum(1 for i in items if i['cutoff_passed']),
        }
        return Response({'summary': summary, 'items': items})


class NotStartedTasksReportView(APIView):
    """
    GET /api/task/not-started-tasks-report/ 

    Tasks whose vote was APPROVED (same rule as
    TaskVoteRequest.result_status) and are pending completion (completed_percentage < 100).
    One row per task.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        import datetime
        today = datetime.date.today()
        items = []
        seen_task_ids = set()

        for vr in _vote_report_requests(request):
            task = vr.task
            if task.id in seen_task_ids or vr.result_status != 'approved':
                continue
            completed = float(task.completed_percentage)
            if completed >= 100:
                continue
            seen_task_ids.add(task.id)
            voted_times = [v.voted_at for v in vr.voters.all() if v.voted_at]
            items.append({
                **_vote_report_common(vr),
                'approved_on': max(voted_times) if voted_times else None,
                'completed_percentage': completed,
                'start_date_passed': bool(task.start_date and task.start_date < today),
                'created_at': vr.created_at,
            })

        summary = {
            'total_tasks': len(items),
            'start_date_passed': sum(1 for i in items if i['start_date_passed']),
        }
        return Response({'summary': summary, 'items': items})
