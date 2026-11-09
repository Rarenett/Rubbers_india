from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    Category, Subcategory, MeetingRoom, Meeting, 
    MeetingParticipant, Agenda, ParticipantEntryLog, 
    Comment, AgendaTask, MeetingAudioTranscription
)
from rarenett_app.models import Department

User = get_user_model()

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class SubcategorySerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.category_name', read_only=True)
    
    class Meta:
        model = Subcategory
        fields = '__all__'

class MeetingRoomSerializer(serializers.ModelSerializer):
    incharge_name = serializers.SerializerMethodField()
    
    def get_incharge_name(self, obj):
        return obj.incharge.get_full_name() if obj.incharge else ''
        
    class Meta:
        model = MeetingRoom
        fields = '__all__'

class MeetingSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.category_name', read_only=True)
    subcategory_name = serializers.CharField(source='subcategory.subcategory_name', read_only=True)
    room_name = serializers.CharField(source='meeting_room.room_name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    
    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else ''
        
    has_participants = serializers.SerializerMethodField()
    has_agendas = serializers.SerializerMethodField()
    participant_count = serializers.SerializerMethodField()
    agenda_count = serializers.SerializerMethodField()

    def get_has_participants(self, obj):
        return obj.participants_link.exists()

    def get_has_agendas(self, obj):
        return obj.agendas.exists()

    def get_participant_count(self, obj):
        return sum(mp.participant.count() for mp in obj.participants_link.all())

    def get_agenda_count(self, obj):
        return obj.agendas.count()
        
    meeting_status = serializers.ReadOnlyField()
    is_enter_enabled = serializers.ReadOnlyField()

    class Meta:
        model = Meeting
        fields = '__all__'
        read_only_fields = ['meeting_code', 'created_by', 'meeting_status', 'is_enter_enabled']

class MeetingParticipantSerializer(serializers.ModelSerializer):
    participant_names = serializers.SerializerMethodField()
    
    def get_participant_names(self, obj):
        return [user.get_full_name() for user in obj.participant.all()]
        
    class Meta:
        model = MeetingParticipant
        fields = '__all__'

class CommentSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source='participant.get_full_name', read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()
    
    def get_reviewed_by_name(self, obj):
        return obj.reviewed_by.get_full_name() if obj.reviewed_by else ''
    
    class Meta:
        model = Comment
        fields = '__all__'
        read_only_fields = ['participant']

class AgendaSerializer(serializers.ModelSerializer):
    presenter_name = serializers.SerializerMethodField()
    file_upload_url = serializers.SerializerMethodField()
    
    def get_presenter_name(self, obj):
        try:
            return obj.presenter.get_full_name() or obj.presenter.username if obj.presenter else ''
        except Exception:
            return ''
    
    def get_file_upload_url(self, obj):
        if obj.file_upload:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file_upload.url)
            return obj.file_upload.url
        return None
        
    user_comment = serializers.SerializerMethodField()

    def get_user_comment(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            comment = Comment.objects.filter(agenda=obj, participant=request.user).first()
            if comment:
                return CommentSerializer(comment).data
        return None

    decision_added_by_name = serializers.SerializerMethodField()

    def get_decision_added_by_name(self, obj):
        return obj.decision_added_by.get_full_name() if obj.decision_added_by else ''

    class Meta:
        model = Agenda
        fields = [
            'id', 'meeting', 'points', 'details', 'file_upload', 'file_upload_url',
            'duration_minutes', 'presenter', 'presenter_name',
            'host_decision', 'decision_added_at', 'decision_added_by', 'decision_added_by_name',
            'user_comment'
        ]

class ParticipantEntryLogSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(source='participant.get_full_name', read_only=True)
    
    class Meta:
        model = ParticipantEntryLog
        fields = '__all__'

class AgendaTaskSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()
    meeting_title = serializers.CharField(source='agenda.meeting.meeting_title', read_only=True)
    agenda_points = serializers.CharField(source='agenda.points', read_only=True)
    agenda_details = serializers.CharField(source='agenda.details', read_only=True)
    agenda_file_url = serializers.SerializerMethodField()
    
    def get_assigned_to_name(self, obj):
        return obj.assigned_to.get_full_name() if obj.assigned_to else ''
        
    def get_agenda_file_url(self, obj):
        if obj.agenda.file_upload:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.agenda.file_upload.url)
            return obj.agenda.file_upload.url
        return None

    class Meta:
        model = AgendaTask
        fields = '__all__'

class MeetingAudioTranscriptionSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    audio_file_url = serializers.SerializerMethodField()

    def get_audio_file_url(self, obj):
        if obj.audio_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.audio_file.url)
            return obj.audio_file.url
        return None

    class Meta:
        model = MeetingAudioTranscription
        fields = ['id', 'user', 'user_name', 'audio_file', 'audio_file_url', 'transcribed_text', 'created_at']

class AgendaWithCommentsSerializer(serializers.ModelSerializer):
    presenter_name = serializers.SerializerMethodField()
    file_upload_url = serializers.SerializerMethodField()
    comments = CommentSerializer(many=True, read_only=True)
    tasks = AgendaTaskSerializer(many=True, read_only=True)
    audio_transcriptions = MeetingAudioTranscriptionSerializer(many=True, read_only=True)
    decision_added_by_name = serializers.SerializerMethodField()
    vote_summary = serializers.SerializerMethodField()

    def get_presenter_name(self, obj):
        try:
            return obj.presenter.get_full_name() or obj.presenter.username if obj.presenter else ''
        except Exception:
            return ''

    def get_file_upload_url(self, obj):
        if obj.file_upload:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file_upload.url)
            return obj.file_upload.url
        return None

    def get_decision_added_by_name(self, obj):
        return obj.decision_added_by.get_full_name() if obj.decision_added_by else ''

    def get_vote_summary(self, obj):
        comments = obj.comments.all()
        return {
            'approve': comments.filter(vote='approve').count(),
            'reject': comments.filter(vote='reject').count(),
            'neutral': comments.filter(vote='neutral').count(),
            'total': comments.count(),
            'reviewed': comments.filter(review_status='reviewed').count(),
            'pending': comments.filter(review_status='pending').count(),
        }

    class Meta:
        model = Agenda
        fields = [
            'id', 'meeting', 'points', 'details', 'file_upload', 'file_upload_url',
            'duration_minutes', 'presenter', 'presenter_name',
            'host_decision', 'decision_added_at', 'decision_added_by', 'decision_added_by_name',
            'comments', 'tasks', 'vote_summary', 'audio_transcriptions'
        ]
