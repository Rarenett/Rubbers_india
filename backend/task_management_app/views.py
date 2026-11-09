from django.shortcuts import render
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils import timezone
from .models import Task, WebPushSubscription
from .serializers import TaskSerializer, AdminTaskSerializer
from datetime import timedelta
from django.db.models import Q

class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Filter by current user and exclude deleted tasks.
        # This will show ALL tasks assigned to the current user (including self-assigned)
        queryset = Task.objects.filter(user=self.request.user, deletedAt__isnull=True)
        return queryset.order_by('plannedDate', 'plannedStartTime')

    @action(detail=True, methods=['post'])
    def mark_reminder_triggered(self, request, pk=None):
        task = self.get_object()
        r_type = request.data.get('reminderType')
        if str(r_type) == '1': task.firstReminderTriggered = True
        if str(r_type) == '2': task.secondReminderTriggered = True
        if str(r_type) == '3': task.thirdReminderTriggered = True
        if str(r_type) == '4': task.fourthReminderTriggered = True
        if str(r_type) == '5': task.fifthReminderTriggered = True
        task.save()
        return Response({'status': 'marked'})

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def mark_reminder_triggered(self, request, pk=None):
        task = self.get_object()
        r_type = request.data.get('reminderType')
        if str(r_type) == '1': task.firstReminderTriggered = True
        if str(r_type) == '2': task.secondReminderTriggered = True
        if str(r_type) == '3': task.thirdReminderTriggered = True
        if str(r_type) == '4': task.fourthReminderTriggered = True
        if str(r_type) == '5': task.fifthReminderTriggered = True
        task.save()
        return Response({'status': 'marked'})

    def perform_destroy(self, instance):
        # Soft delete
        instance.deletedAt = timezone.now()
        instance.save()

    @action(detail=True, methods=['post'])
    def start_task(self, request, pk=None):
        task = self.get_object()
        task.status = 'In Progress'
        task.startedAt = timezone.now()
        task.save()
        return Response({'status': 'Task started'})

    @action(detail=True, methods=['post'])
    def complete_task(self, request, pk=None):
        task = self.get_object()
        task.status = 'Completed'
        task.completedAt = timezone.now()
        task.completionNotes = request.data.get('completionNotes', '')
        task.save()
        return Response({'status': 'Task completed'})

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        task = self.get_object()
        new_status = request.data.get('status')
        if new_status in dict(Task.STATUS_CHOICES):
            task.status = new_status
            if new_status == 'Completed':
                task.completedAt = timezone.now()
                task.completionNotes = request.data.get('completionNotes', '')
            else:
                task.completedAt = None
            task.save()
            return Response({'status': f'Task status updated to {new_status}'})
        return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)
        
    @action(detail=True, methods=['post'])
    def postpone_task(self, request, pk=None):
        task = self.get_object()
        try:
            days_to_postpone = int(request.data.get('days', 0))
        except ValueError:
            return Response({'error': 'Invalid days provided.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if not task.allowPostpone:
            return Response({'error': 'Postponement not allowed for this task.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if days_to_postpone <= 0:
            return Response({'error': 'Number of days must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if task.postponedDaysUsed + days_to_postpone > task.maxPostponeDays:
            return Response({'error': f'Cannot postpone by {days_to_postpone} days. Only {task.maxPostponeDays - task.postponedDaysUsed} days remaining.'}, status=status.HTTP_400_BAD_REQUEST)
            
        task.postponedDaysUsed += days_to_postpone
        
        # Shift plannedDate and deadline
        if task.plannedDate:
            task.plannedDate = task.plannedDate + timedelta(days=days_to_postpone)
        if task.deadline:
            task.deadline = task.deadline + timedelta(days=days_to_postpone)
            
        task.save()
        return Response({'status': 'Task postponed successfully.'})
        
    @action(detail=False, methods=['get'])
    def today(self, request):
        now = timezone.now()
        today = timezone.localtime(now).date() if timezone.is_aware(now) else now.date()
        # Show all self-assigned tasks up to today or tasks that have been postponed, excluding completed ones.
        # Tasks assigned by admin are viewed under the Admin Tasks tab.
        tasks = self.get_queryset().filter(
            Q(plannedDate__lte=today) | Q(postponedDaysUsed__gt=0),
            assigned_by__isnull=True
        ).exclude(status='Completed')
        serializer = self.get_serializer(tasks, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def active_reminders(self, request):
        now = timezone.now()
        if timezone.is_aware(now):
            now = timezone.localtime(now)
            
        # Find tasks that are not completed, cancelled or deleted
        tasks = self.get_queryset().exclude(status__in=['Completed', 'Cancelled'])
        
        due_reminders = []
        for task in tasks:
            if not task.deadline:
                continue
            # Removed the restriction that prevented reminders from triggering before the planned start time.
            # Reminders should strictly trigger exactly X minutes before the deadline, regardless of start time.
            reminder_triggered = False
            # Helper to check and trigger a reminder
            def check_reminder(triggered, mins, type_num, trigger_field):
                nonlocal reminder_triggered
                if not triggered and mins is not None:
                    rem_time = task.deadline - timedelta(minutes=mins)
                    if now >= rem_time:
                        due_reminders.append({
                            'taskId': task.id,
                            'taskName': task.taskName,
                            'reminderType': type_num,
                            'minutes': mins,
                            'deadline': task.deadline
                        })
                        setattr(task, trigger_field, True)
                        reminder_triggered = True

            check_reminder(task.firstReminderTriggered, task.firstReminderMinutes, 1, 'firstReminderTriggered')
            check_reminder(task.secondReminderTriggered, task.secondReminderMinutes, 2, 'secondReminderTriggered')
            check_reminder(task.thirdReminderTriggered, task.thirdReminderMinutes, 3, 'thirdReminderTriggered')
            check_reminder(task.fourthReminderTriggered, task.fourthReminderMinutes, 4, 'fourthReminderTriggered')
            check_reminder(task.fifthReminderTriggered, task.fifthReminderMinutes, 5, 'fifthReminderTriggered')
                    
            if reminder_triggered:
                task.save(update_fields=[
                    'firstReminderTriggered', 'secondReminderTriggered', 
                    'thirdReminderTriggered', 'fourthReminderTriggered', 'fifthReminderTriggered'
                ])

        return Response(due_reminders)

    @action(detail=False, methods=['post'])
    def subscribe_push(self, request):
        sub_info = request.data
        endpoint = sub_info.get('endpoint')
        keys = sub_info.get('keys', {})
        p256dh = keys.get('p256dh')
        auth = keys.get('auth')

        if not endpoint or not p256dh or not auth:
            return Response({'error': 'Invalid subscription data'}, status=status.HTTP_400_BAD_REQUEST)

        # Update or create subscription for this user and endpoint
        WebPushSubscription.objects.update_or_create(
            user=request.user,
            endpoint=endpoint,
            defaults={
                'p256dh': p256dh,
                'auth': auth,
            }
        )
        return Response({'status': 'Subscribed successfully'})

class AdminTaskViewSet(viewsets.ModelViewSet):
    serializer_class = AdminTaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Admin sees all tasks they assigned
        queryset = Task.objects.filter(
            assigned_by=self.request.user, 
            deletedAt__isnull=True
        )

        if self.request.query_params.get('postponed') == 'true':
            queryset = queryset.filter(postponedDaysUsed__gt=0)
            
        return queryset.order_by('-createdAt')

    @action(detail=True, methods=['post'])
    def mark_reminder_triggered(self, request, pk=None):
        task = self.get_object()
        r_type = request.data.get('reminderType')
        if str(r_type) == '1': task.firstReminderTriggered = True
        if str(r_type) == '2': task.secondReminderTriggered = True
        if str(r_type) == '3': task.thirdReminderTriggered = True
        if str(r_type) == '4': task.fourthReminderTriggered = True
        if str(r_type) == '5': task.fifthReminderTriggered = True
        task.save()
        return Response({'status': 'marked'})

    def perform_create(self, serializer):
        serializer.save(assigned_by=self.request.user)

    @action(detail=True, methods=['post'])
    def mark_reminder_triggered(self, request, pk=None):
        task = self.get_object()
        r_type = request.data.get('reminderType')
        if str(r_type) == '1': task.firstReminderTriggered = True
        if str(r_type) == '2': task.secondReminderTriggered = True
        if str(r_type) == '3': task.thirdReminderTriggered = True
        if str(r_type) == '4': task.fourthReminderTriggered = True
        if str(r_type) == '5': task.fifthReminderTriggered = True
        task.save()
        return Response({'status': 'marked'})

    def perform_destroy(self, instance):
        instance.deletedAt = timezone.now()
        instance.save()

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        task = self.get_object()
        new_status = request.data.get('status')
        if new_status in dict(Task.STATUS_CHOICES):
            task.status = new_status
            if new_status == 'Completed':
                task.completedAt = timezone.now()
                task.completionNotes = request.data.get('completionNotes', '')
            else:
                task.completedAt = None
            task.save()
            return Response({'status': f'Task status updated to {new_status}'})
        return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

