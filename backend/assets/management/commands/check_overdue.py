from django.core.management.base import BaseCommand
from django.utils import timezone
from assets.models import FileAllocation
from notifications_app.models import Notification
from django.contrib.auth import get_user_model

User = get_user_model()

class Command(BaseCommand):
    help = 'Checks for overdue file allocations and sends notifications to users and admins.'

    def handle(self, *args, **options):
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timezone.timedelta(days=1)

        # 1. Check for allocations due today
        due_today = FileAllocation.objects.filter(
            status__in=['Allocated', 'In Use'],
            due_date__range=(today_start, today_end)
        )

        for allocation in due_today:
            # Notify the assigned user
            Notification.objects.get_or_create(
                recipient=allocation.assigned_to,
                message=f"File '{allocation.file.file_name}' is due for return today.",
                notification_type='alert',
                badge_text='Due Today',
                badge_color='warning',
                icon='clock',
                created_at__gte=today_start # Avoid duplicate for the same day if run multiple times
            )
            self.stdout.write(self.style.SUCCESS(f"Notified {allocation.assigned_to.email} about due today: {allocation.file.file_name}"))

        # 2. Check for overdue allocations (past due date)
        overdue = FileAllocation.objects.filter(
            status__in=['Allocated', 'In Use'],
            due_date__lt=now
        )

        for allocation in overdue:
            # Update status to Overdue if not already set
            if allocation.status != 'Overdue':
                allocation.status = 'Overdue'
                allocation.save()
            
            # Update associated file status if needed (optional, but keep it consistent)
            # if allocation.file.status != 'Overdue':
            #    allocation.file.status = 'Overdue'
            #    allocation.file.save()

            # Notify the assigned user
            Notification.objects.get_or_create(
                recipient=allocation.assigned_to,
                message=f"File '{allocation.file.file_name}' is OVERDUE for return.",
                notification_type='alert',
                badge_text='Overdue',
                badge_color='danger',
                icon='alert-circle',
                created_at__gte=today_start # Avoid redundant notifications on the same day
            )

            # Notify superusers
            superusers = User.objects.filter(is_superuser=True)
            for su in superusers:
                Notification.objects.get_or_create(
                    recipient=su,
                    message=f"File '{allocation.file.file_name}' assigned to {allocation.assigned_to.email} is OVERDUE.",
                    notification_type='alert',
                    badge_text='Overdue',
                    badge_color='danger',
                    icon='alert-circle',
                    created_at__gte=today_start
                )
            
            self.stdout.write(self.style.WARNING(f"Notified {allocation.assigned_to.email} and admins about overdue: {allocation.file.file_name}"))

        self.stdout.write(self.style.SUCCESS('Successfully checked overdue allocations.'))
