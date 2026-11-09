from django.db import models
from django.conf import settings

class Notification(models.Model):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications_received'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications_sent',
        null=True,
        blank=True
    )
    message = models.TextField()
    notification_type = models.CharField(max_length=50, default='message') # e.g., 'message', 'alert', 'invite'
    badge_text = models.CharField(max_length=50, null=True, blank=True) # e.g., 'Collaboration', 'File Manager'
    badge_color = models.CharField(max_length=20, null=True, blank=True) # e.g., 'success', 'violet', 'orange'
    avatar_color = models.CharField(max_length=20, null=True, blank=True) # e.g. 'danger', 'success' etc for avatar background
    icon = models.CharField(max_length=50, null=True, blank=True) # e.g., 'feather-icon', 'Inbox', etc if we want to store icon name
    
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification for {self.recipient}: {self.message[:20]}"
