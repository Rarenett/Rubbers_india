from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db import models, transaction
from .models import RenewalSubject, RenewalReminder
from .serializers import RenewalSubjectSerializer, RenewalReminderSerializer


class RenewalSubjectViewSet(viewsets.ModelViewSet):
    queryset = RenewalSubject.objects.all().order_by('name')
    serializer_class = RenewalSubjectSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['name', 'description']
    filterset_fields = ['is_active']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class RenewalReminderViewSet(viewsets.ModelViewSet):
    serializer_class = RenewalReminderSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    search_fields = ['name', 'remarks', 'renewal_subject__name']
    filterset_fields = ['branch', 'department', 'renewal_subject', 'is_active', 'status']

    def get_queryset(self):
        return RenewalReminder.objects.filter(status=1).select_related(
            'branch',
            'renewal_subject',
            'department'
        ).prefetch_related(
            'allocated_to',
            'allocated_to__user',
            'allocated_to__dept_designation__department'
        ).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, status=1)

    @action(detail=False, methods=['get'], url_path='my-due')
    def my_due_reminders(self, request):
        user = request.user
        today = timezone.now().date()

        queryset = self.get_queryset().filter(
            is_active=True,
            renewal_date__isnull=False
        ).filter(
            models.Q(allocated_to__user=user) |
            models.Q(allocated_to__email__iexact=user.email)
        ).distinct()

        due_list = []
        for reminder in queryset:
            days_until = (reminder.renewal_date - today).days
            if 0 <= days_until <= reminder.reminder_days or (days_until < 0 and abs(days_until) <= 30):
                due_list.append(reminder)

        serializer = self.get_serializer(due_list, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='fetch-for-update')
    def fetch_for_update(self, request):
        branch_id = request.query_params.get('branch')
        subject_id = request.query_params.get('renewal_subject')
        name = request.query_params.get('name')

        qs = self.get_queryset().filter(is_active=True)
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if subject_id:
            qs = qs.filter(renewal_subject_id=subject_id)

        # If name is not provided, return available names for the dropdown
        if not name:
            raw_names = qs.values_list('name', flat=True)
            names = sorted(list({n.strip() for n in raw_names if n and n.strip()}), key=lambda x: x.lower())
            return Response({"names": names})

        # If name is provided, fetch the specific active reminder
        reminder = qs.filter(name__iexact=name.strip()).order_by('-id').first()
        if not reminder:
            return Response({"found": False, "detail": "No active renewal reminder found for the selected criteria."}, status=200)

        serializer = self.get_serializer(reminder)
        return Response({"found": True, "data": serializer.data})

    @action(detail=False, methods=['get'], url_path='history')
    def renewal_history(self, request):
        branch_id = request.query_params.get('branch')
        subject_id = request.query_params.get('renewal_subject')
        name = request.query_params.get('name')

        qs = RenewalReminder.objects.filter(is_active=True).select_related(
            'branch',
            'renewal_subject',
            'department'
        ).prefetch_related(
            'allocated_to',
            'allocated_to__user',
            'allocated_to__dept_designation__department'
        ).order_by('-id')

        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if subject_id:
            qs = qs.filter(renewal_subject_id=subject_id)

        if request.query_params.get('get_names') == 'true':
            raw_names = qs.values_list('name', flat=True)
            names = sorted(list({n.strip() for n in raw_names if n and n.strip()}), key=lambda x: x.lower())
            return Response({"names": names})

        if name:
            qs = qs.filter(name__iexact=name.strip())

        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='renew-update')
    def renew_update(self, request):
        previous_id = request.data.get('previous_reminder_id')
        if not previous_id:
            return Response({"detail": "previous_reminder_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            try:
                prev_reminder = RenewalReminder.objects.get(id=previous_id, status=1)
            except RenewalReminder.DoesNotExist:
                return Response({"detail": "Previous active renewal reminder not found."}, status=status.HTTP_404_NOT_FOUND)

            # Mark previous reminder as historical (status = 0)
            prev_reminder.status = 0
            prev_reminder.save(update_fields=['status', 'updated_at'])

            # Create new renewal reminder with status = 1
            branch_id = request.data.get('branch')
            subject_id = request.data.get('renewal_subject')
            name = request.data.get('name')
            department_id = request.data.get('department') or None
            renewal_date = request.data.get('renewal_date') or None
            reminder_days = int(request.data.get('reminder_days', 30))
            remarks = request.data.get('remarks', '')

            new_reminder = RenewalReminder.objects.create(
                branch_id=branch_id,
                renewal_subject_id=subject_id,
                name=name,
                department_id=department_id,
                renewal_date=renewal_date,
                reminder_days=reminder_days,
                remarks=remarks,
                status=1,
                is_active=True,
                created_by=request.user
            )

            allocated_to = request.data.get('allocated_to', [])
            if allocated_to and isinstance(allocated_to, list):
                new_reminder.allocated_to.set(allocated_to)

            serializer = self.get_serializer(new_reminder)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
