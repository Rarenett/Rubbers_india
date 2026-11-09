from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from .models import Email, EmailRecipient
from .serializers import EmailSerializer
from django.contrib.auth import get_user_model

User = get_user_model()

class EmailViewSet(viewsets.ModelViewSet):
    serializer_class = EmailSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # print(f"DEBUG: get_queryset action={self.action} user={user.id}")
        
        # Base queryset: Emails where user is sender OR recipient
        # Optimization: distinct() might be needed due to joins
        base_qs = Email.objects.filter(
            Q(sender=user) | Q(recipients__in=[user])
        ).distinct()

        # If specific action (like detail updates), return broad permissions to avoid 404s
        if self.action != 'list':
            # print(f"DEBUG: Returning base_qs for action {self.action}. Count={base_qs.count()}")
            return base_qs

        # Only filter by folder for the LIST view
        folder = self.request.query_params.get('folder', 'inbox')
        
        if folder == 'inbox':
            # Emails where user is a recipient and NOT deleted
            return Email.objects.filter(
                recipients__in=[user],
                emailrecipient__user=user,
                emailrecipient__is_deleted=False,
                emailrecipient__is_archived=False
            ).distinct().order_by('-created_at')
            
        elif folder == 'sent':
            # Emails sent by user and NOT deleted or archived by sender
            return Email.objects.filter(
                sender=user,
                sender_deleted=False,
                sender_archived=False
            ).order_by('-created_at')
            
        elif folder == 'trash':
            # Joined trash (both sent and received)
            received_trash = Q(recipients__in=[user], emailrecipient__user=user, emailrecipient__is_deleted=True)
            sent_trash = Q(sender=user, sender_deleted=True)
            return Email.objects.filter(received_trash | sent_trash).distinct().order_by('-created_at')
        
        elif folder == 'archive':
            received_archived = Q(
                recipients__in=[user],
                emailrecipient__user=user,
                emailrecipient__is_archived=True,
                emailrecipient__is_deleted=False
            )
            sent_archived = Q(sender=user, sender_archived=True, sender_deleted=False)
            return Email.objects.filter(received_archived | sent_archived).distinct().order_by('-created_at')
            
        elif folder == 'starred':
            received_starred = Q(
                recipients__in=[user], 
                emailrecipient__user=user, 
                emailrecipient__is_starred=True,
                emailrecipient__is_deleted=False
            )
            sent_starred = Q(sender=user, sender_starred=True, sender_deleted=False)
            return Email.objects.filter(received_starred | sent_starred).distinct().order_by('-created_at')

        return Email.objects.none()

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        email = self.get_object()
        user = request.user
        
        if user == email.sender:
             return Response({'status': 'Sender cannot mark sent email as read'})
             
        try:
            recipient = EmailRecipient.objects.get(email=email, user=user)
            recipient.is_read = True
            recipient.save()
            return Response({'status': 'marked as read'})
        except EmailRecipient.DoesNotExist:
            return Response({'error': 'Recipient not found'}, status=404)

    @action(detail=True, methods=['post'])
    def trash(self, request, pk=None):
        email = self.get_object()
        user = request.user
        print(f"DEBUG: Trash/Restore requested for email {email.id} by user {user.id} ({user.email})")
        
        is_deleted = False
        if user == email.sender:
            email.sender_deleted = not email.sender_deleted
            email.save()
            is_deleted = email.sender_deleted
            print(f"DEBUG: Toggled sender_deleted to {is_deleted}")
        else:
            try:
                recipient = EmailRecipient.objects.get(email=email, user=user)
                print(f"DEBUG: User is recipient. Old is_deleted={recipient.is_deleted}")
                recipient.is_deleted = not recipient.is_deleted
                recipient.save()
                is_deleted = recipient.is_deleted
                print(f"DEBUG: Toggled recipient.is_deleted to {is_deleted}")
            except EmailRecipient.DoesNotExist:
                print("DEBUG: Recipient row not found")
                return Response({'error': 'Recipient not found'}, status=404)
        
        action = 'trashed' if is_deleted else 'restored'
        return Response({'status': action, 'is_deleted': is_deleted})

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        email = self.get_object()
        user = request.user
        print(f"DEBUG: Archive requested for email {email.id} by user {user.id}")
        
        is_archived = False
        if user == email.sender:
            email.sender_archived = not email.sender_archived
            email.save()
            is_archived = email.sender_archived
            print(f"DEBUG: Toggled sender_archived to {is_archived}")
        else:
            try:
                recipient = EmailRecipient.objects.get(email=email, user=user)
                print(f"DEBUG: User is recipient. Old is_archived={recipient.is_archived}")
                recipient.is_archived = not recipient.is_archived
                recipient.save()
                is_archived = recipient.is_archived
                print(f"DEBUG: Toggled recipient.is_archived to {is_archived}")
            except EmailRecipient.DoesNotExist:
                return Response({'error': 'Recipient not found'}, status=404)
        
        return Response({'status': 'toggled', 'is_archived': is_archived})

    @action(detail=True, methods=['post'])
    def toggle_star(self, request, pk=None):
        email = self.get_object()
        user = request.user
        
        is_starred = False
        if user == email.sender:
            # Sender starring their own sent email
            email.sender_starred = not email.sender_starred
            email.save()
            is_starred = email.sender_starred
            print(f"DEBUG: Toggled sender_starred to {is_starred}")
        else:
            # Recipient starring email
            try:
                recipient = EmailRecipient.objects.get(email=email, user=user)
                recipient.is_starred = not recipient.is_starred
                recipient.save()
                is_starred = recipient.is_starred
                print(f"DEBUG: Toggled recipient.is_starred to {is_starred}")
            except EmailRecipient.DoesNotExist:
                return Response({'error': 'Recipient not found'}, status=404)
        
        return Response({'status': 'toggled star', 'is_starred': is_starred})

    @action(detail=False, methods=['get'])
    def search_users(self, request):
        query = request.query_params.get('q', '')
        if query:
            users = User.objects.filter(
                Q(email__icontains=query) | 
                Q(first_name__icontains=query) | 
                Q(last_name__icontains=query)
            )[:10] 
            data = [{'id': u.id, 'email': u.email, 'name': f"{u.first_name} {u.last_name}".strip()} for u in users]
            return Response(data)
        return Response([])

    @action(detail=False, methods=['get'])
    def internal_users(self, request):
        users = User.objects.filter(is_active=True).exclude(id=request.user.id)
        data = [{'id': u.id, 'email': u.email, 'name': f"{u.first_name} {u.last_name}".strip()} for u in users]
        return Response(data)

    @action(detail=False, methods=['get'])
    def folder_counts(self, request):
        """Get email counts for all folders"""
        user = request.user
        
        # Inbox count
        inbox_count = Email.objects.filter(
            recipients__in=[user],
            emailrecipient__user=user,
            emailrecipient__is_deleted=False,
            emailrecipient__is_archived=False
        ).distinct().count()
        
        # Sent count (excluding archived)
        sent_count = Email.objects.filter(
            sender=user,
            sender_deleted=False,
            sender_archived=False
        ).count()
        
        # Starred count (both received and sent)
        received_starred = Q(
            recipients__in=[user],
            emailrecipient__user=user,
            emailrecipient__is_starred=True,
            emailrecipient__is_deleted=False
        )
        sent_starred = Q(sender=user, sender_starred=True, sender_deleted=False)
        starred_count = Email.objects.filter(received_starred | sent_starred).distinct().count()
        
        # Trash count
        received_trash = Q(recipients__in=[user], emailrecipient__user=user, emailrecipient__is_deleted=True)
        sent_trash = Q(sender=user, sender_deleted=True)
        trash_count = Email.objects.filter(received_trash | sent_trash).distinct().count()
        
        # Archive count (both received and sent)
        received_archived = Q(
            recipients__in=[user],
            emailrecipient__user=user,
            emailrecipient__is_archived=True,
            emailrecipient__is_deleted=False
        )
        sent_archived = Q(sender=user, sender_archived=True, sender_deleted=False)
        archive_count = Email.objects.filter(received_archived | sent_archived).distinct().count()
        
        return Response({
            'inbox': inbox_count,
            'sent': sent_count,
            'starred': starred_count,
            'trash': trash_count,
            'archive': archive_count
        })
