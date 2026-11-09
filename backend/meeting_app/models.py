import django
from django.db import models, transaction 
from django.contrib.auth import get_user_model 
from django.core.exceptions import ValidationError 
from django.db.models import Q, F 
from django.utils import timezone 
from rarenett_app.models import Department 
 
User = get_user_model() 
 
 
# ========================================================= 
# 1. Category 
# ========================================================= 
 
class Category(models.Model): 
    category_name = models.CharField(max_length=100, unique=True) 
    narration = models.TextField(blank=True, default='') 
 
    # Prefix for meeting code 
    prefix_code = models.CharField( 
        max_length=5, 
        unique=True, 
        help_text="2–5 uppercase letters used in meeting code. e.g. AM" 
    ) 
 
    class Meta: 
        verbose_name_plural = "Categories" 
 
    def save(self, *args, **kwargs): 
        self.prefix_code = self.prefix_code.upper().strip() 
        super().save(*args, **kwargs) 
 
    def __str__(self): 
        return self.category_name 
 
 
# ========================================================= 
# 2. Subcategory 
# ========================================================= 
 
class Subcategory(models.Model): 
    category = models.ForeignKey(Category, on_delete=models.CASCADE, 
related_name='subcategories') 
    subcategory_name = models.CharField(max_length=100) 
    narration = models.TextField(blank=True, default='') 
 
    prefix_code = models.CharField( 
        max_length=5, 
        help_text="2–5 uppercase letters used in meeting code. e.g. MK" 
    ) 
 
    class Meta: 
        verbose_name_plural = "Subcategories" 
        unique_together = [ 
            ('category', 'subcategory_name'), 
            ('category', 'prefix_code'), 
        ] 
 
    def save(self, *args, **kwargs): 
        self.prefix_code = self.prefix_code.upper().strip() 
        super().save(*args, **kwargs) 
 
    def __str__(self): 
        return f"{self.category.category_name} - {self.subcategory_name}" 
 
 
# ========================================================= 
# Meeting Code Generator 
# ========================================================= 
 
def generate_meeting_code(category, subcategory, meeting_date): 
    cat_prefix = category.prefix_code 
    sub_prefix = subcategory.prefix_code 
    date_str = meeting_date.strftime('%d%m%y') 
 
    base = f"{cat_prefix}{sub_prefix}{date_str}" 
 
    last = ( 
        Meeting.objects 
        .filter(meeting_code__startswith=base) 
        .order_by('meeting_code') 
        .last() 
    ) 
 
    if last: 
        try: 
            seq = int(last.meeting_code.split('-')[-1]) + 1 
        except (ValueError, IndexError): 
            seq = 1 
    else: 
        seq = 1 
 
    return f"{base}-{seq:04d}" 
 
# ========================================================= 
# 3. Meeting Room 
# ========================================================= 
 
class MeetingRoom(models.Model): 
 
    class Status(models.TextChoices): 
        ACTIVE = 'active', 'Active' 
        INACTIVE = 'inactive', 'Inactive' 
 
    room_name = models.CharField(max_length=150, unique=True) 
    capacity = models.PositiveIntegerField() 
    location = models.CharField(max_length=255) 
    equipment = models.TextField(blank=True, default='') 
 
    # NEW: Room Incharge 
    incharge = models.ForeignKey( 
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='rooms_managed' 
    ) 
 
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE) 
    is_available = models.BooleanField(default=True) 
 
    created_at = models.DateTimeField(auto_now_add=True) 
    updated_at = models.DateTimeField(auto_now=True) 
 
    def __str__(self): 
        return self.room_name 
 
 
# ========================================================= 
# 4. Meeting 
# ========================================================= 
 
class Meeting(models.Model): 
 
    class ApprovalStatus(models.TextChoices): 
        PENDING = 'pending', 'Pending' 
        APPROVED = 'approved', 'Approved' 
        REJECTED = 'rejected', 'Rejected' 
 
    class Mode(models.TextChoices): 
        HYBRID = 'hybrid', 'Hybrid' 
        REMOTE = 'remote', 'Remote' 
        OFFLINE = 'offline', 'Offline' 
 
    # Meeting Code 
    meeting_code = models.CharField( 
        max_length=30, 
        unique=True, 
        blank=True, 
        editable=False 
    ) 
 
    meeting_title = models.CharField(max_length=255) 
    meeting_description = models.TextField(blank=True, default='') 
    mode = models.CharField(max_length=10, choices=Mode.choices) 
 
    meeting_date = models.DateField(null=True, blank=True) 
    start_time = models.TimeField(null=True, blank=True) 
    end_time = models.TimeField(null=True, blank=True) 
 
    meeting_room = models.ForeignKey( 
        MeetingRoom, 
        on_delete=models.SET_NULL, 
        null=True, blank=True, 
        related_name='meetings' 
    ) 
 
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, 
blank=True, related_name='meetings') 
    subcategory = models.ForeignKey(Subcategory, on_delete=models.SET_NULL, null=True, 
blank=True, related_name='meetings') 
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, 
blank=True) 
 
    approval_status = models.CharField(max_length=10, choices=ApprovalStatus.choices, 
default=ApprovalStatus.PENDING) 
    meeting_approver = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, 
blank=True, related_name='meetings_to_approve') 
 
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, 
blank=True, related_name='hosted_meetings') 
    reminder_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True) 
    updated_at = models.DateTimeField(auto_now=True) 
 
    class Meta: 
        constraints = [
            models.CheckConstraint(
                **({'condition' if django.VERSION >= (5, 1) else 'check': Q(start_time__lt=F('end_time'))}),
                name='meeting_start_before_end'
            ),
        ]
 
    def save(self, *args, **kwargs): 
        if not self.meeting_code and self.category and self.subcategory and self.meeting_date: 
            with transaction.atomic(): 
                self.meeting_code = generate_meeting_code( 
                    self.category, 
                    self.subcategory, 
                    self.meeting_date 
                ) 
        super().save(*args, **kwargs) 
 
    def clean(self): 
        errors = {} 
 
        if self.start_time and self.end_time and self.start_time >= self.end_time: 
            errors['end_time'] = ValidationError("End time must be after start time.") 
 
        if self.meeting_room and self.meeting_date and self.start_time and self.end_time: 
            overlap = Meeting.objects.filter( 
                meeting_room=self.meeting_room, 
                meeting_date=self.meeting_date, 
            ).exclude(pk=self.pk).filter( 
                Q(start_time__lt=self.end_time) & Q(end_time__gt=self.start_time) 
            ) 
            if overlap.exists(): 
                errors['meeting_room'] = ValidationError( 
                    "This room is already booked for the selected date and time slot." 
                ) 
 
        if errors: 
            raise ValidationError(errors) 
 
    @property 
    def has_agenda(self): 
        return self.agendas.exists() 
 
    def __str__(self): 
        return f"{self.meeting_code} - {self.meeting_title}" 

    @property
    def meeting_status(self):
        """
        Dynamically calculate the meeting status: upcoming, ongoing, or ended.
        """
        if not self.meeting_date or not self.start_time or not self.end_time:
            return "upcoming"

        now = timezone.now()
        meeting_start = timezone.datetime.combine(self.meeting_date, self.start_time)
        meeting_end = timezone.datetime.combine(self.meeting_date, self.end_time)

        if now > meeting_end:
            return "ended"
        elif now >= meeting_start:
            return "ongoing"
        else:
            return "upcoming"

    @property
    def is_enter_enabled(self):
        """
        Returns True if the meeting is within 5 minutes of starting and not yet ended.
        """
        if self.approval_status != self.ApprovalStatus.APPROVED:
            return False

        if not self.meeting_date or not self.start_time or not self.end_time:
            return False

        now = timezone.now()
        meeting_start = timezone.datetime.combine(self.meeting_date, self.start_time)
        meeting_end = timezone.datetime.combine(self.meeting_date, self.end_time)

        # Enabled from 5 minutes before start until the end time
        start_threshold = meeting_start - timezone.timedelta(minutes=5)
        
        return start_threshold <= now <= meeting_end
 
 
# ========================================================= 
# 5. Meeting Participants 
# ========================================================= 
class MeetingParticipant(models.Model): 
    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, 
related_name='participants_link') 
    participant = models.ManyToManyField(User, related_name='meeting_participant') 
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, 
blank=True, related_name='meeting_participants_created') 
 
    def __str__(self): 
        return self.meeting.meeting_title 
 
 
# ========================================================= 
# 6. Agenda 
# ========================================================= 
 
class Agenda(models.Model): 
    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, 
related_name='agendas') 
    points = models.TextField() 
    details = models.TextField(blank=True, default='') 
    file_upload = models.FileField(upload_to='agenda_files/', blank=True, null=True) 
 
    # NEW 
    duration_minutes = models.PositiveIntegerField(default=0) 
    presenter = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, 
related_name='agendas_presented') 
 
    host_decision = models.TextField(blank=True, default='') 
    decision_added_at = models.DateTimeField(null=True, blank=True) 
    decision_added_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, 
blank=True, related_name='agenda_decisions_added') 
 
    class Meta: 
        ordering = ['id'] 
 
    def clean(self): 
        if self.presenter and hasattr(self, 'meeting') and self.meeting: 
            if not self.meeting.participants_link.filter(participant=self.presenter).exists(): 
                raise ValidationError("Presenter must be meeting participant.") 
 
    def __str__(self): 
        return f"{self.meeting.meeting_title} — {self.points[:60]}" 
 
 
# ------------------------------------------------------- 
# 7. Participant Entry Log 
# ------------------------------------------------------- 
class ParticipantEntryLog(models.Model): 
    class JoinMethod(models.TextChoices): 
        WEB = 'web', 'Web Browser' 
        MOBILE = 'mobile', 'Mobile App' 
        DESKTOP = 'desktop', 'Desktop App' 
 
    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, 
related_name='entry_logs') 
    participant = models.ForeignKey(User, on_delete=models.CASCADE, 
related_name='entry_logs') 
    joined_at = models.DateTimeField(default=timezone.now) 
    left_at = models.DateTimeField(null=True, blank=True) 
    join_method = models.CharField(max_length=10, choices=JoinMethod.choices, blank=True, 
default='') 
    ip_address = models.GenericIPAddressField(null=True, blank=True) 
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True) 
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True) 
    location_accuracy_meters = models.FloatField(null=True, blank=True) 
    location_address = models.CharField(max_length=512, blank=True, default='') 
    device_name = models.CharField(max_length=255, blank=True, default='') 
    operating_system = models.CharField(max_length=100, blank=True, default='') 
    browser_info = models.CharField(max_length=255, blank=True, default='') 
    user_agent = models.TextField(blank=True, default='') 
    imei = models.CharField(max_length=20, blank=True, default='') 
    mac_address = models.CharField(max_length=17, blank=True, default='') 
    device_fingerprint = models.CharField(max_length=255, blank=True, default='')
 
    class Meta: 
        verbose_name = "Participant Entry Log" 
        verbose_name_plural = "Participant Entry Logs" 
        ordering = ['-joined_at'] 
        unique_together = ('meeting', 'participant', 'joined_at') 
 
    def __str__(self): 
        return f"{self.participant.username} → {self.meeting.meeting_title} @ {self.joined_at:%d/%m/%Y %H:%M}" 
 
 
# ------------------------------------------------------- 
# 8. Comments 
# ------------------------------------------------------- 
class Comment(models.Model): 
    class Vote(models.TextChoices): 
        APPROVE = 'approve', 'Approve' 
        REJECT = 'reject', 'Reject' 
        NEUTRAL = 'neutral', 'Neutral' 
 
    class ReviewStatus(models.TextChoices): 
        PENDING = 'pending', 'Pending' 
        REVIEWED = 'reviewed', 'Reviewed' 
 
    agenda = models.ForeignKey(Agenda, on_delete=models.CASCADE, 
related_name='comments') 
    participant = models.ForeignKey(User, on_delete=models.CASCADE, 
related_name='comments_submitted') 
    vote = models.CharField(max_length=10, choices=Vote.choices) 
    remarks = models.TextField() 
    review_status = models.CharField(max_length=10, choices=ReviewStatus.choices, 
default=ReviewStatus.PENDING) 
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, 
blank=True, related_name='comments_reviewed') 
    reviewed_at = models.DateTimeField(null=True, blank=True) 
    created_at = models.DateTimeField(auto_now_add=True) 
 
    class Meta: 
        verbose_name_plural = "Comments" 
        ordering = ['created_at'] 
 
    def __str__(self): 
        return f"Comment by {self.participant.username} on Agenda #{self.agenda.id}" 
 
 
# ------------------------------------------------------- 
# 9. Agenda Task Assignment 
# ------------------------------------------------------- 
class AgendaTask(models.Model): 
    class Status(models.TextChoices): 
        PENDING = 'pending', 'Pending' 
        IN_PROGRESS = 'in_progress', 'In Progress' 
        COMPLETED = 'completed', 'Completed' 
 
    agenda = models.ForeignKey( 
        Agenda, 
        on_delete=models.CASCADE, 
        related_name='tasks' 
    ) 
    title = models.CharField(max_length=255) 
    description = models.TextField(blank=True) 
    assigned_to = models.ForeignKey( 
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='tasks_assigned' 
    ) 
    due_date = models.DateField(null=True, blank=True) 
    status = models.CharField( 
        max_length=20, 
        choices=Status.choices, 
        default=Status.PENDING 
    ) 
    created_at = models.DateTimeField(auto_now_add=True) 
 
    def __str__(self): 
        return f"{self.title} → {self.assigned_to}" 
# ------------------------------------------------------- 
# 10. Audio Transcriptions
# ------------------------------------------------------- 
class MeetingAudioTranscription(models.Model):
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='audio_transcriptions'
    )
    agenda = models.ForeignKey(
        Agenda, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='audio_transcriptions'
    )
    audio_file = models.FileField(upload_to='meeting_audios/')
    transcribed_text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Meeting Audio Transcription"
        verbose_name_plural = "Meeting Audio Transcriptions"
        ordering = ['-created_at']

    def __str__(self):
        return f"Transcription for {self.agenda.id if self.agenda else 'General'} by {self.user.username}"
