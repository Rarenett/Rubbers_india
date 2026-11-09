from django.utils import timezone
from .models import Meeting
from notifications_app.models import Notification
from emails_app.models import Email, EmailRecipient

def send_meeting_reminder(meeting, sender=None):
    """
    Utility function to send a reminder notification and email to all participants.
    Returns True if sent, False otherwise.
    """
    if meeting.reminder_sent:
        return False

    # Perform naive comparison to match server's local clock
    import datetime
    now_naive = datetime.datetime.now()
    meeting_dt_naive = datetime.datetime.combine(meeting.meeting_date, meeting.start_time)
    
    # Check if we are far in the future or in the past (already started)
    # Allows a wider window for manual runs (e.g. up to 15m after start)
    time_diff = meeting_dt_naive - now_naive
    
    # Constraints: approved and within 1 hour window
    # We also catch if it just started (up to 15m ago)
    if not (datetime.timedelta(minutes=-15) <= time_diff <= datetime.timedelta(hours=1)):
        return False
        
    participant_links = meeting.participants_link.all()
    all_participant_users = []
    for link in participant_links:
        all_participant_users.extend(link.participant.all())
    
    unique_participants = set(all_participant_users)
    if not unique_participants:
        return False

    # 1. Create Notifications
    notif_message = f"Reminder: Meeting '{meeting.meeting_title}' starts in 1 hour (or less) at {meeting.start_time.strftime('%H:%M')}."
    notifications = []
    for user in unique_participants:
        notifications.append(Notification(
            recipient=user,
            sender=sender or meeting.created_by,
            message=notif_message,
            notification_type='meeting_reminder',
            badge_text='Reminder',
            badge_color='warning',
            avatar_color='warning',
            icon='flaticon-381-clock'
        ))
    
    if notifications:
        Notification.objects.bulk_create(notifications)

    # 2. Create Internal Email
    email_subject = f"Reminder: Meeting Scheduled in 1 hr - {meeting.meeting_title}"
    email_body = (
        f"Dear Participant,\n\n"
        f"This is a reminder that the meeting '{meeting.meeting_title}' is scheduled to start soon (within 1 hour).\n\n"
        f"Meeting Details:\n"
        f"Title: {meeting.meeting_title}\n"
        f"Code: {meeting.meeting_code}\n"
        f"Date: {meeting.meeting_date.strftime('%d-%m-%Y')}\n"
        f"Time: {meeting.start_time.strftime('%H:%M')} - {meeting.end_time.strftime('%H:%M')}\n"
        f"Room: {meeting.meeting_room.room_name if meeting.meeting_room else 'N/A'}\n"
        f"Description: {meeting.meeting_description}\n\n"
        f"Please join on time.\n\n"
        f"Regards,\n"
        f"Meeting Management System"
    )

    # Resolve sender
    email_sender = sender
    if not email_sender:
        email_sender = meeting.created_by
    if not email_sender and unique_participants:
        email_sender = list(unique_participants)[0]

    email_obj = Email.objects.create(
        sender=email_sender,
        subject=email_subject,
        body=email_body
    )

    email_recipients = []
    for user in unique_participants:
        email_recipients.append(EmailRecipient(
            user=user,
            email=email_obj,
            recipient_type='to'
        ))
    
    if email_recipients:
        EmailRecipient.objects.bulk_create(email_recipients)

    # 3. Mark as sent
    meeting.reminder_sent = True
    meeting.save(update_fields=['reminder_sent'])
    return True
