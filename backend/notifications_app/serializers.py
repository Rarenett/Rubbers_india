from rest_framework import serializers
from .models import Notification
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'email'] # Removed avatar as it doesn't exist in CustomUser

class NotificationSerializer(serializers.ModelSerializer):
    sender_details = UserSerializer(source='sender', read_only=True)
    time_ago = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'sender', 'sender_details', 
            'message', 'notification_type', 
            'badge_text', 'badge_color', 'avatar_color', 'icon',
            'is_read', 'created_at', 'time_ago'
        ]
        read_only_fields = ['recipient', 'created_at']

    def get_time_ago(self, obj):
        """Return human-readable time difference"""
        now = timezone.now()
        diff = now - obj.created_at

        if diff < timedelta(minutes=1):
            return "Just now"
        elif diff < timedelta(hours=1):
            minutes = int(diff.total_seconds() / 60)
            return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
        elif diff < timedelta(days=1):
            hours = int(diff.total_seconds() / 3600)
            return f"{hours} hour{'s' if hours != 1 else ''} ago"
        elif diff < timedelta(days=7):
            days = diff.days
            return f"{days} day{'s' if days != 1 else ''} ago"
        else:
            return obj.created_at.strftime("%b %d, %Y")
