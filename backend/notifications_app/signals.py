from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .models import Notification

User = get_user_model()

@receiver(post_save, sender=User)
def notify_superusers_on_user_event(sender, instance, created, **kwargs):
    """
    Signal to notify superusers when a new user is registered or a profile is updated.
    """
    # Avoid creating notifications for changes to superusers themselves if desired, 
    # but requirement implies monitoring "users". 
    # Let's assume we monitor all user changes.

    if created:
        message = f"New user registered: {instance.first_name} {instance.last_name} ({instance.email})"
        notification_type = "alert"
        badge_text = "Registration"
        badge_color = "primary"
        icon = "user-plus"
    else:
        # Check if it's a login update (last_login) or actual profile update.
        update_fields = kwargs.get('update_fields')
        if update_fields and set(update_fields) == {'last_login'}:
            return

        message = f"User profile updated: {instance.first_name} {instance.last_name} ({instance.email})"
        notification_type = "message"
        badge_text = "Update"
        badge_color = "info"
        icon = "edit"

    # Get all superusers
    superusers = User.objects.filter(is_superuser=True)

    # If the user performing the action is a superuser, maybe don't notify them about themselves?
    # But for now, notify ALL superusers as requested.
    
    notifications = []
    for su in superusers:
        # Optional: Don't notify the user about their own update if they are a superuser?
        # if su == instance: continue 
        
        notifications.append(Notification(
            recipient=su,
            sender=instance, # The user who caused the event
            message=message,
            notification_type=notification_type,
            badge_text=badge_text,
            badge_color=badge_color,
            avatar_color="primary", # Default or dynamic
            icon=icon
        ))
    
    if notifications:
        Notification.objects.bulk_create(notifications)

    # Send Welcome Notification to the new user properly
    if created:
        Notification.objects.create(
            recipient=instance,
            message=f"Welcome to Jampack, {instance.first_name}! We are glad to have you here.",
            notification_type="message",
            badge_text="Welcome",
            badge_color="success",
            icon="zap"
        )
