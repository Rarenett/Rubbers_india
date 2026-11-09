import json
import logging
from datetime import timedelta
from django.utils import timezone
from pywebpush import webpush, WebPushException
from django.conf import settings
from .models import Task, WebPushSubscription

logger = logging.getLogger(__name__)

def check_and_send_reminders():
    now = timezone.now()
    if timezone.is_aware(now):
        now = timezone.localtime(now)
        
    tasks = Task.objects.exclude(status__in=['Completed', 'Cancelled', 'Deleted']).exclude(deletedAt__isnull=False)
    
    for task in tasks:
        if not task.deadline:
            continue
            
        reminder_triggered = False
        
        def send_push(title, body, tag):
            from django.db.models import Q
            if task.assigned_by:
                subs = WebPushSubscription.objects.filter(Q(user=task.user) | Q(user=task.assigned_by))
            else:
                subs = WebPushSubscription.objects.filter(user=task.user)
                
            for sub in subs:
                try:
                    webpush(
                        subscription_info={
                            "endpoint": sub.endpoint,
                            "keys": {
                                "p256dh": sub.p256dh,
                                "auth": sub.auth
                            }
                        },
                        data=json.dumps({"title": title, "body": body, "data": {"taskId": task.id, "tag": tag}}),
                        vapid_private_key=settings.WEBPUSH_SETTINGS["VAPID_PRIVATE_KEY"],
                        vapid_claims={
                            "sub": f"mailto:{settings.WEBPUSH_SETTINGS['VAPID_ADMIN_EMAIL']}"
                        }
                    )
                except WebPushException as ex:
                    logger.error("Web Push failed: {}", repr(ex))
                    if ex.response and ex.response.status_code in [404, 410]:
                        sub.delete()
        
        def check_reminder(triggered, mins, trigger_field, typeNum):
            nonlocal reminder_triggered
            if not triggered and mins is not None:
                rem_time = None
                if task.reminderSystem == 'Duration Based':
                    from datetime import datetime
                    start_time = datetime.combine(task.plannedDate, task.plannedStartTime)
                    if timezone.is_aware(now):
                        start_time = timezone.make_aware(start_time)
                    rem_time = start_time + timedelta(minutes=mins)
                    message = f"Task: {task.taskName}\n{mins} minutes have passed since start!"
                else:
                    # End Time Based
                    rem_time = task.deadline - timedelta(minutes=mins)
                    message = f"Task: {task.taskName}\n{mins} minutes remaining!"

                if now >= rem_time:
                    send_push("Task Reminder", message, f"{task.id}-rem-{typeNum}")
                    setattr(task, trigger_field, True)
                    reminder_triggered = True

        check_reminder(task.firstReminderTriggered, task.firstReminderMinutes, 'firstReminderTriggered', 1)
        check_reminder(task.secondReminderTriggered, task.secondReminderMinutes, 'secondReminderTriggered', 2)
        check_reminder(task.thirdReminderTriggered, task.thirdReminderMinutes, 'thirdReminderTriggered', 3)
        check_reminder(task.fourthReminderTriggered, task.fourthReminderMinutes, 'fourthReminderTriggered', 4)
        check_reminder(task.fifthReminderTriggered, task.fifthReminderMinutes, 'fifthReminderTriggered', 5)
                
        # If the deadline has passed and the task isn't completed, mark it as Incomplete
        deadline_passed = now >= task.deadline
        if deadline_passed and task.status not in ['Completed', 'Cancelled', 'Incomplete']:
            task.status = 'Incomplete'
            task.save(update_fields=['status'])
        
        if reminder_triggered:
            task.save(update_fields=[
                'firstReminderTriggered', 'secondReminderTriggered', 
                'thirdReminderTriggered', 'fourthReminderTriggered', 'fifthReminderTriggered'
            ])
