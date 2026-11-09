from django.contrib import admin
from .models import Notification

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('recipient', 'sender', 'notification_type', 'created_at', 'is_read')
    list_filter = ('is_read', 'notification_type', 'created_at')
    search_fields = ('message', 'recipient__email', 'sender__email')
