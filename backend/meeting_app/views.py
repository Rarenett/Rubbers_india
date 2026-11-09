from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from register_app.permissions import module_permission
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from django.db.models import Q
from django.utils import timezone
from datetime import datetime
from .models import (
    Category, Subcategory, MeetingRoom, Meeting, 
    MeetingParticipant, Agenda, ParticipantEntryLog, 
    Comment, AgendaTask, MeetingAudioTranscription
)
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from .audio_utils import transcribe_audio
from .serializers import (
    CategorySerializer, SubcategorySerializer, MeetingRoomSerializer, 
    MeetingSerializer, MeetingParticipantSerializer, AgendaSerializer, 
    ParticipantEntryLogSerializer, CommentSerializer, AgendaTaskSerializer,
    AgendaWithCommentsSerializer
)

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [module_permission('meeting-categories')]

class SubcategoryViewSet(viewsets.ModelViewSet):
    queryset = Subcategory.objects.all()
    serializer_class = SubcategorySerializer
    permission_classes = [module_permission('meeting-categories')]

class MeetingRoomViewSet(viewsets.ModelViewSet):
    queryset = MeetingRoom.objects.all()
    serializer_class = MeetingRoomSerializer
    permission_classes = [module_permission('meeting-rooms')]

    @action(detail=False, methods=['get'])
    def check_availability(self, request):
        from datetime import datetime
        
        date_str = request.query_params.get('date')
        start_time = request.query_params.get('start_time')
        end_time = request.query_params.get('end_time')
        meeting_id = request.query_params.get('meeting_id')

        if not all([date_str, start_time, end_time]):
            return Response({"error": "Missing parameters"}, status=status.HTTP_400_BAD_REQUEST)

        # Try to parse date in multiple formats just in case
        parsed_date = None
        for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%m-%d-%Y'):
            try:
                parsed_date = datetime.strptime(date_str, fmt).date()
                break
            except (ValueError, TypeError):
                continue

        if not parsed_date:
            return Response({"error": "Invalid date format. Use YYYY-MM-DD"}, status=status.HTTP_400_BAD_REQUEST)

        # Overlapping meetings logic: (StartA < EndB) AND (EndA > StartB)
        overlapping_meetings = Meeting.objects.filter(
            meeting_date=parsed_date
        ).filter(
            Q(start_time__lt=end_time) & Q(end_time__gt=start_time)
        )
        
        if meeting_id:
            try:
                overlapping_meetings = overlapping_meetings.exclude(id=int(meeting_id))
            except (ValueError, TypeError):
                pass
            
        busy_room_ids = overlapping_meetings.values_list('meeting_room', flat=True)
        
        available_rooms = MeetingRoom.objects.filter(status='active').exclude(id__in=busy_room_ids)
        serializer = self.get_serializer(available_rooms, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def schedule(self, request, pk=None):
        room = self.get_object()
        meetings = Meeting.objects.filter(meeting_room=room).order_by('meeting_date', 'start_time')
        serializer = MeetingSerializer(meetings, many=True)
        return Response(serializer.data)

class MeetingViewSet(viewsets.ModelViewSet):
    queryset = Meeting.objects.all()
    serializer_class = MeetingSerializer
    permission_classes = [module_permission('meetings')]

    def dispatch(self, request, *args, **kwargs):
        print(f"DEBUG: MeetingViewSet dispatch: {request.method} {request.path}")
        return super().dispatch(request, *args, **kwargs)

    def get_queryset(self):
        queryset = Meeting.objects.all().order_by('-meeting_date', '-start_time')
        approver_id = self.request.query_params.get('approver_id')
        status_param = self.request.query_params.get('status')
        my_approvals = self.request.query_params.get('my_approvals')
        created_by = self.request.query_params.get('created_by')

        if my_approvals == 'true':
            queryset = queryset.filter(meeting_approver=self.request.user)
        elif approver_id:
            queryset = queryset.filter(meeting_approver_id=approver_id)

        if status_param:
            queryset = queryset.filter(approval_status=status_param)

        if created_by:
            queryset = queryset.filter(created_by_id=created_by)

        return queryset

    @action(detail=False, methods=['get'])
    def my_meetings(self, request):
        """
        Returns meetings where the current user is a participant, host, or approver.
        """
        print(f"DEBUG: my_meetings called by user: {request.user}")
        queryset = Meeting.objects.filter(
            Q(participants_link__participant=request.user) |
            Q(created_by=request.user) |
            Q(meeting_approver=request.user),
            approval_status='approved'
        ).distinct().order_by('-meeting_date', '-start_time')
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def enter_meeting(self, request, pk=None):
        """
        Logs the participant's entry into the meeting with device and location info.
        """
        meeting = self.get_object()
        
        if not meeting.is_enter_enabled:
            return Response(
                {"error": "Meeting entry is not enabled yet or has ended."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Log the entry
        ip_address = request.META.get('REMOTE_ADDR')
        
        # Extract data from request
        latitude = request.data.get('latitude')
        longitude = request.data.get('longitude')
        location_address = request.data.get('location_address', '')
        location_accuracy = request.data.get('location_accuracy_meters')
        
        device_name = request.data.get('device_name', '')
        operating_system = request.data.get('operating_system', '')
        browser_info = request.data.get('browser_info', '')
        imei = request.data.get('imei', '')
        mac_address = request.data.get('mac_address', '')
        device_fingerprint = request.data.get('device_fingerprint', '')
        join_method = request.data.get('join_method', ParticipantEntryLog.JoinMethod.WEB)

        # Check if an active entry log already exists for this user/meeting
        # (where left_at is null). If so, don't create a new one.
        active_log = ParticipantEntryLog.objects.filter(
            meeting=meeting,
            participant=request.user,
            left_at__isnull=True
        ).first()

        if not active_log:
            ParticipantEntryLog.objects.create(
                meeting=meeting,
                participant=request.user,
                ip_address=ip_address,
                latitude=latitude,
                longitude=longitude,
                location_address=location_address,
                location_accuracy_meters=location_accuracy,
                device_name=device_name,
                operating_system=operating_system,
                browser_info=browser_info,
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
                imei=imei,
                mac_address=mac_address,
                device_fingerprint=device_fingerprint,
                join_method=join_method
            )

        return Response({"message": "Entry logged successfully"}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def exit_meeting(self, request, pk=None):
        """
        Logs the participant's departure from the meeting.
        """
        meeting = self.get_object()
        
        # Find the latest active log for this user and meeting
        active_log = ParticipantEntryLog.objects.filter(
            meeting=meeting,
            participant=request.user,
            left_at__isnull=True
        ).order_by('-joined_at').first()

        if active_log:
            active_log.left_at = timezone.now()
            active_log.save(update_fields=['left_at'])
            return Response({"message": "Exit logged successfully"}, status=status.HTTP_200_OK)
        
        return Response({"error": "No active entry log found for this meeting."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        meeting = self.get_object()
        status_val = request.data.get('status')
        
        if status_val not in ['approved', 'rejected']:
            return Response({"error": "Invalid status. Must be 'approved' or 'rejected'."}, 
                            status=status.HTTP_400_BAD_REQUEST)
        
        meeting.approval_status = status_val
        meeting.save()

        # If approved, notify all participants
        if status_val == 'approved':
            from notifications_app.models import Notification
            
            # Get participants through the MeetingParticipant link
            participant_links = meeting.participants_link.all()
            all_participant_users = []
            for link in participant_links:
                all_participant_users.extend(link.participant.all())
            
            unique_participants = set(all_participant_users)
            
            # --- Mark existing unread notifications for this meeting as read ---
            Notification.objects.filter(
                recipient__in=unique_participants,
                notification_type__in=['meeting_approved', 'meeting_reminder'],
                message__icontains=meeting.meeting_title,
                is_read=False
            ).update(is_read=True)

            notifications_to_create = []
            message = f"Meeting Scheduled: {meeting.meeting_title} on {meeting.meeting_date.strftime('%d-%m-%Y')} at {meeting.start_time.strftime('%H:%M')}"
            
            for user in unique_participants:
                notifications_to_create.append(Notification(
                    recipient=user,
                    sender=request.user,
                    message=message,
                    notification_type='meeting_approved',
                    badge_text='Meeting',
                    badge_color='success',
                    avatar_color='success',
                    icon='flaticon-381-calendar-1'
                ))
            
            if notifications_to_create:
                Notification.objects.bulk_create(notifications_to_create)

            # --- Internal Email Notification ---
            from emails_app.models import Email, EmailRecipient
            
            email_subject = f"Meeting Scheduled: {meeting.meeting_title}"
            email_body = (
                f"Dear Participant,\n\n"
                f"A new meeting has been scheduled and approved.\n\n"
                f"Meeting Details:\n"
                f"Title: {meeting.meeting_title}\n"
                f"Code: {meeting.meeting_code}\n"
                f"Date: {meeting.meeting_date.strftime('%d-%m-%Y')}\n"
                f"Time: {meeting.start_time.strftime('%H:%M')} - {meeting.end_time.strftime('%H:%M')}\n"
                f"Room: {meeting.meeting_room.room_name if meeting.meeting_room else 'N/A'}\n"
                f"Description: {meeting.meeting_description}\n\n"
                f"Please be available on time.\n\n"
                f"Regards,\n"
                f"Meeting Management System"
            )

            # Create the main email record
            email_obj = Email.objects.create(
                sender=request.user,
                subject=email_subject,
                body=email_body
            )

            # Create recipient records
            email_recipients_to_create = []
            for user in unique_participants:
                email_recipients_to_create.append(EmailRecipient(
                    user=user,
                    email=email_obj,
                    recipient_type='to'
                ))
            
            if email_recipients_to_create:
                EmailRecipient.objects.bulk_create(email_recipients_to_create)
            
            # --- Check for instant reminder (via utility which now handles time checks) ---
            from .utils import send_meeting_reminder
            send_meeting_reminder(meeting, sender=request.user)
        
        return Response({
            "message": f"Meeting {status_val} successfully",
            "approval_status": meeting.approval_status
        })

    @action(detail=True, methods=['get'])
    def participants(self, request, pk=None):
        """
        Returns a flat list of all unique participants (users) for this meeting.
        """
        meeting = self.get_object()
        participant_links = meeting.participants_link.all()
        
        all_users = []
        for link in participant_links:
            all_users.extend(link.participant.all())
        
        # Unique users only
        unique_users = {user.id: user for user in all_users}.values()
        
        data = [
            {
                "id": user.id,
                "participant": user.id, # for frontend backward compatibility
                "participant_name": user.get_full_name() or user.username
            }
            for user in unique_users
        ]
        return Response(data)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        # If this meeting is already approved, reset to pending on any edit
        # (but NOT when the verify action itself is calling save)
        instance = serializer.instance
        if instance.approval_status == 'approved':
            serializer.save(approval_status='pending')
        else:
            serializer.save()

class MeetingParticipantViewSet(viewsets.ModelViewSet):
    queryset = MeetingParticipant.objects.all()
    serializer_class = MeetingParticipantSerializer
    permission_classes = [module_permission('meetings')]

    def get_queryset(self):
        queryset = MeetingParticipant.objects.all()
        meeting_id = self.request.query_params.get('meeting')
        if meeting_id:
            queryset = queryset.filter(meeting_id=meeting_id)
        return queryset

    def _reset_meeting_to_pending(self, meeting_id):
        """If the linked meeting is approved, revert it to pending."""
        try:
            meeting = Meeting.objects.get(pk=meeting_id)
            if meeting.approval_status == 'approved':
                meeting.approval_status = 'pending'
                meeting.save(update_fields=['approval_status'])
        except Meeting.DoesNotExist:
            pass

    def perform_create(self, serializer):
        instance = serializer.save()
        self._reset_meeting_to_pending(instance.meeting_id)

    def perform_update(self, serializer):
        instance = serializer.save()
        self._reset_meeting_to_pending(instance.meeting_id)

    def perform_destroy(self, instance):
        meeting_id = instance.meeting_id
        instance.delete()
        self._reset_meeting_to_pending(meeting_id)

    @action(detail=False, methods=['post'], url_path='check_conflicts')
    def check_conflicts(self, request):
        """
        Check if any of the given participants are already in an APPROVED
        meeting on the same date with overlapping time.

        POST body: { meeting_id: int, participant_ids: [int, ...] }
        Returns:   { conflicts: [ {id, name}, ... ] }
        """
        meeting_id = request.data.get('meeting_id')
        participant_ids = request.data.get('participant_ids', [])

        if not meeting_id or not participant_ids:
            return Response({'conflicts': []})

        try:
            current = Meeting.objects.get(pk=meeting_id)
        except Meeting.DoesNotExist:
            return Response({'error': 'Meeting not found'}, status=status.HTTP_404_NOT_FOUND)

        if not current.meeting_date or not current.start_time or not current.end_time:
            return Response({'conflicts': []})

        # Find other APPROVED meetings on the same date that overlap in time
        # (overlap: other.start < current.end AND other.end > current.start)
        conflicting_meetings = Meeting.objects.filter(
            meeting_date=current.meeting_date,
            approval_status='approved',
        ).exclude(pk=meeting_id).filter(
            start_time__lt=current.end_time,
            end_time__gt=current.start_time,
        )

        if not conflicting_meetings.exists():
            return Response({'conflicts': []})

        # Get participants of those conflicting meetings
        conflicting_participant_records = MeetingParticipant.objects.filter(
            meeting__in=conflicting_meetings
        )

        # Collect all user IDs → which meeting they're in
        busy_user_meeting = {}  # user_id -> Meeting object
        for record in conflicting_participant_records:
            meeting_obj = record.meeting
            for uid in record.participant.values_list('id', flat=True):
                if uid not in busy_user_meeting:
                    busy_user_meeting[uid] = meeting_obj

        # Intersect with the requested participant_ids
        conflict_ids = [uid for uid in participant_ids if uid in busy_user_meeting]

        if not conflict_ids:
            return Response({'conflicts': []})

        # Fetch names
        from django.contrib.auth import get_user_model
        User = get_user_model()
        conflict_users = User.objects.filter(pk__in=conflict_ids)
        conflicts = [
            {
                'id': u.pk,
                'name': u.get_full_name() or u.username,
                'meeting_title': busy_user_meeting[u.pk].meeting_title,
                'meeting_time': f"{busy_user_meeting[u.pk].start_time.strftime('%H:%M')} – {busy_user_meeting[u.pk].end_time.strftime('%H:%M')}" 
                                if busy_user_meeting[u.pk].start_time and busy_user_meeting[u.pk].end_time else '',
            }
            for u in conflict_users
        ]

        return Response({'conflicts': conflicts})

class AgendaViewSet(viewsets.ModelViewSet):
    queryset = Agenda.objects.all()
    serializer_class = AgendaSerializer
    permission_classes = [module_permission('meetings')]

    def get_queryset(self):
        queryset = Agenda.objects.all()
        meeting_id = self.request.query_params.get('meeting')
        if meeting_id:
            queryset = queryset.filter(meeting_id=meeting_id)
        return queryset

    def _reset_meeting_to_pending(self, meeting_id):
        try:
            meeting = Meeting.objects.get(pk=meeting_id)
            if meeting.approval_status == 'approved':
                meeting.approval_status = 'pending'
                meeting.save(update_fields=['approval_status'])
        except Meeting.DoesNotExist:
            pass

    def perform_create(self, serializer):
        instance = serializer.save()
        self._reset_meeting_to_pending(instance.meeting_id)

    def perform_update(self, serializer):
        instance = serializer.save()
        self._reset_meeting_to_pending(instance.meeting_id)

    def perform_destroy(self, instance):
        meeting_id = instance.meeting_id
        instance.delete()
        self._reset_meeting_to_pending(meeting_id)

    @action(detail=False, methods=['get'], url_path='with_comments')
    def with_comments(self, request):
        """
        Returns agendas for a meeting with all nested comments and vote summary.
        Usage: GET /api/meeting/agendas/with_comments/?meeting=<id>
        """
        meeting_id = request.query_params.get('meeting')
        if not meeting_id:
            return Response({'error': 'meeting query param is required'}, status=status.HTTP_400_BAD_REQUEST)
        agendas = Agenda.objects.filter(meeting_id=meeting_id).prefetch_related(
            'comments', 'comments__participant', 'comments__reviewed_by',
            'tasks', 'tasks__assigned_to'
        )
        serializer = AgendaWithCommentsSerializer(agendas, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['patch'], url_path='submit_decision')
    def submit_decision(self, request, pk=None):
        """
        Save host decision for an agenda.
        PATCH /api/meeting/agendas/<id>/submit_decision/
        Body: { "host_decision": "..." }
        """
        agenda = self.get_object()
        host_decision = request.data.get('host_decision', '')
        agenda.host_decision = host_decision
        agenda.decision_added_at = timezone.now()
        agenda.decision_added_by = request.user
        agenda.save(update_fields=['host_decision', 'decision_added_at', 'decision_added_by'])
        return Response(AgendaWithCommentsSerializer(agenda, context={'request': request}).data)

    @action(detail=True, methods=['patch'], url_path='review_all')
    def review_all(self, request, pk=None):
        """
        Mark all pending comments for this agenda as reviewed.
        PATCH /api/meeting/agendas/<id>/review_all/
        """
        agenda = self.get_object()
        updated = agenda.comments.filter(review_status='pending').update(
            review_status='reviewed',
            reviewed_by=request.user,
            reviewed_at=timezone.now()
        )
        serializer = AgendaWithCommentsSerializer(agenda, context={'request': request})
        return Response({'reviewed_count': updated, 'agenda': serializer.data})

class ParticipantEntryLogViewSet(viewsets.ModelViewSet):
    queryset = ParticipantEntryLog.objects.all()
    serializer_class = ParticipantEntryLogSerializer
    permission_classes = [module_permission('meetings')]

class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [module_permission('meetings')]

    def perform_create(self, serializer):
        agenda = serializer.validated_data.get('agenda')
        meeting = agenda.meeting
        
        # Combine meeting_date and end_time to check if meeting has ended
        meeting_end_dt = datetime.combine(meeting.meeting_date, meeting.end_time)
        
        # If USE_TZ=True, make meeting_end_dt aware to match timezone.now()
        if timezone.is_aware(timezone.now()):
            meeting_end_dt = timezone.make_aware(meeting_end_dt, timezone.get_current_timezone())
        
        if timezone.now() > meeting_end_dt:
            raise ValidationError("Commenting is no longer possible as the meeting has ended.")
            
        serializer.save(participant=self.request.user)

    @action(detail=True, methods=['patch'], url_path='review')
    def review_comment(self, request, pk=None):
        """
        Mark a comment as reviewed.
        PATCH /api/meeting/comments/<id>/review/
        """
        comment = self.get_object()
        comment.review_status = 'reviewed'
        comment.reviewed_by = request.user
        comment.reviewed_at = timezone.now()
        comment.save(update_fields=['review_status', 'reviewed_by', 'reviewed_at'])
        return Response(CommentSerializer(comment).data)

class AgendaTaskViewSet(viewsets.ModelViewSet):
    queryset = AgendaTask.objects.all()
    serializer_class = AgendaTaskSerializer
    permission_classes = [module_permission('meetings')]

    def get_queryset(self):
        queryset = AgendaTask.objects.all().order_by('-created_at')
        assigned_to = self.request.query_params.get('assigned_to')
        status_param = self.request.query_params.get('status')
        agenda_id = self.request.query_params.get('agenda')

        if assigned_to:
            queryset = queryset.filter(assigned_to_id=assigned_to)
        if status_param:
            queryset = queryset.filter(status=status_param)
        if agenda_id:
            queryset = queryset.filter(agenda_id=agenda_id)
            
        return queryset

class AudioToTextView(APIView):
    """
    Endpoint to receive an uploaded audio file and convert it to text.
    """
    permission_classes = [module_permission('meetings')]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        if 'audio' not in request.FILES:
            return Response({"error": "No audio file provided."}, status=status.HTTP_400_BAD_REQUEST)
        
        audio_file = request.FILES['audio']
        agenda_id = request.data.get('agenda_id')
        
        try:
            transcribed_text = transcribe_audio(audio_file)
            
            # Save to database
            transcription = MeetingAudioTranscription.objects.create(
                user=request.user,
                agenda_id=agenda_id if agenda_id else None,
                audio_file=audio_file,
                transcribed_text=transcribed_text
            )
            
            return Response({
                "message": "Audio processed and saved successfully.",
                "text": transcribed_text,
                "transcription_id": transcription.id
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

