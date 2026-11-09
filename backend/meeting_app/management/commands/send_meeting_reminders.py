from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime
from meeting_app.models import Meeting
from meeting_app.utils import send_meeting_reminder

class Command(BaseCommand):
    help = 'Send meeting reminders 1 hour before scheduled start time'

    def handle(self, *args, **options):
        # Current time (Naive to match server clock/user input)
        # Note: We use django.utils.timezone.now()'s date part just for broad filtering
        # but the utility handles the fine-grained naive comparison.
        now_utc = timezone.now()
        
        # Broad filter for meetings today (to avoid scanning entire DB)
        meetings = Meeting.objects.filter(
            approval_status='approved',
            reminder_sent=False,
            # Catch today's meetings (using UTC date is usually safe for broad filter)
            meeting_date__gte=now_utc.date()
        )
        
        sent_count = 0
        self.stdout.write(f"Scanning {meetings.count()} approved meetings for reminders...")
        
        for meeting in meetings:
            # The utility now handles the time window check internally using naive datetime.now()
            if send_meeting_reminder(meeting):
                self.stdout.write(f"Sent reminder for: {meeting.meeting_title} ({meeting.meeting_code})")
                sent_count += 1

        self.stdout.write(self.style.SUCCESS(f"Successfully sent {sent_count} reminders."))
