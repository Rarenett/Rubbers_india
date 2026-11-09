from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Notification
from .serializers import NotificationSerializer

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    def perform_create(self, serializer):
        # Allow admins or system to specify recipient, but for now 
        # let's just assume we might create notifications for others via other endpoints
        # or signals. 
        # If this view is used to "send" a notification, we need to handle that.
        # But typically, users view their OWN notifications.
        # Creation might happen internally.
        # If a user wants to "notify" another user, that logic might be specific.
        # For now, standard save.
        serializer.save()

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread notifications for the current user"""
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'unread_count': count})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        self.get_queryset().update(is_read=True)
        return Response({'status': 'all marked as read'})

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({'status': 'marked as read'})
