import datetime
from decimal import Decimal
from django.db import models
from django.db.models import Q

from django.conf import settings
from rarenett_app.models import BoardOfDirector, Department, Employee
from django.utils import timezone

# Create your models here.



class TaskCategory(models.Model):
    category_name = models.CharField(max_length=150, unique=True, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    def __str__(self):
        return self.category_name or ""

    class Meta:
        verbose_name_plural = "Task Categories"
        ordering = ['category_name']

class TaskSubCategory(models.Model):
    category = models.ForeignKey(
        TaskCategory,
        on_delete=models.PROTECT,
        related_name='subcategories'
    )
    subcategory_name = models.CharField(max_length=150, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
 
    def __str__(self):
        return self.subcategory_name or ""
 
    class Meta:
        verbose_name_plural = "Task Sub Categories"
        ordering = ['category__category_name', 'subcategory_name']
        # A sub-category name only needs to be unique within its parent category
        unique_together = ('category', 'subcategory_name')

class Task(models.Model):
    TASK_TYPE_CHOICES = (
        ('individual', 'Individual'),
        ('group', 'Group'),
    )
 
    task_name = models.CharField(max_length=200, null=True, blank=True)
    task_type = models.CharField(
        max_length=10,
        choices=TASK_TYPE_CHOICES,
        default='individual'
    )
    subcategory = models.ForeignKey(
        TaskSubCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tasks'
    )
    description = models.TextField(null=True, blank=True)
    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
 
    def __str__(self):
        return self.task_name or ""

    @property
    def rollup_percentage(self):
        """Calculates live combined progress from all split subtask assignments."""
        assignments = TaskAssignment.objects.filter(
            Q(task=self) | Q(subtask__task=self),
            parent_subtask__isnull=True,
            is_approved=True
        ).distinct()
        if not assignments.exists():
            assignments = TaskAssignment.objects.filter(
                Q(task=self) | Q(subtask__task=self),
                is_approved=True
            ).distinct()
            if not assignments.exists():
                return Decimal('0')
        total_weight = sum(Decimal(str(a.percentage or 0)) for a in assignments)
        if not total_weight:
            return Decimal('0')
        weighted_sum = sum(
            Decimal(str(a.percentage or 0)) * Decimal(str(a.completed_percentage or 0))
            for a in assignments
        )
        return round(weighted_sum / total_weight, 2)

    @property
    def completed_percentage(self):
        """Live rollup percentage from all split subtask assignments if split,
        or max with latest direct progress update if one was logged."""
        has_subtasks = self.subtasks.exists() or self.assignments.filter(is_approved=True).exists()
        latest_task_update = self.progress_updates.order_by('-created_at', '-id').first()
        if has_subtasks:
            if latest_task_update:
                return max(self.rollup_percentage, latest_task_update.cumulative_percentage)
            return self.rollup_percentage
        if latest_task_update:
            return latest_task_update.cumulative_percentage
        return Decimal('0')

    class Meta:
        verbose_name_plural = "Tasks"
        ordering = ['-created_at']

 
 
def task_attachment_upload_path(instance, filename):
    return f'task_attachments/{instance.task_id}/{filename}'
 
 
class TaskAttachment(models.Model):
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    file = models.FileField(upload_to=task_attachment_upload_path)
    original_filename = models.CharField(max_length=255, null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
 
    def __str__(self):
        return self.original_filename or (self.file.name if self.file else "")
 
    class Meta:
        verbose_name_plural = "Task Attachments"
        ordering = ['-uploaded_at']

class Subtask(models.Model):
    TASK_TYPE_CHOICES = (
        ('individual', 'Individual'),
        ('group', 'Group'),
    )

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='subtasks', null=True, blank=True)
    parent_subtask = models.ForeignKey(
        'self', on_delete=models.CASCADE, null=True, blank=True,
        related_name='child_subtasks',
        help_text="Set when this subtask was created by the person a subtask "
                   "was assigned to, nested under THEIR subtask instead of "
                   "directly under the root Task."
    )
    subtask_name = models.CharField(max_length=255, null=True)
    task_type = models.CharField(max_length=20, choices=TASK_TYPE_CHOICES, default='individual', null=True)
    description = models.TextField(blank=True, null=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_subtasks'
    )
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    def __str__(self):
        return self.subtask_name

    @property
    def due_date(self):
        return self.end_date

    def get_root_task(self):
        current = self
        while current.parent_subtask_id is not None:
            current = current.parent_subtask
        return current.task

    @property
    def completed_percentage(self):
        """Roll-up completed percentage across assignments of this subtask, or its child subtasks."""
        assignments = self.assignments.all()
        if assignments.exists():
            total_weight = sum(Decimal(str(a.percentage or 0)) for a in assignments)
            if not total_weight:
                return Decimal('0')
            weighted_sum = sum(
                Decimal(str(a.percentage or 0)) * Decimal(str(a.completed_percentage or 0))
                for a in assignments
            )
            return round(weighted_sum / total_weight, 2)
        children = self.child_subtasks.all()
        if children.exists():
            child_pcts = [Decimal(str(c.completed_percentage)) for c in children]
            return round(sum(child_pcts) / len(child_pcts), 2)
        return Decimal('0')


def subtask_attachment_upload_path(instance, filename):
    return f'subtask_attachments/{instance.subtask_id}/{filename}'


class SubtaskAttachment(models.Model):
    subtask = models.ForeignKey(Subtask, related_name='attachments', on_delete=models.CASCADE)
    file = models.FileField(upload_to=subtask_attachment_upload_path)
    original_filename = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.original_filename and self.file:
            self.original_filename = self.file.name
        super().save(*args, **kwargs)

    def __str__(self):
        return self.original_filename or str(self.file)

# store who can vote for a task and the type of approval required (BOD, single, or multiple)

class TaskVoteRequest(models.Model):
    APPROVAL_TYPE_CHOICES = (
        ('bod', 'BOD'),
        ('hod', 'HOD'),
        ('single', 'Single'),
        ('multiple', 'Multiple'),
    )
    task = models.ForeignKey('Task', on_delete=models.CASCADE, related_name='vote_requests')
    assigned_employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='assigned_task_votes')
    assigned_department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, related_name='task_votes')
    approval_type = models.CharField(max_length=10, choices=APPROVAL_TYPE_CHOICES)
    cutoff_date = models.DateTimeField(help_text="Last date & time to cast a vote")
    remarks = models.TextField(null=True, blank=True, help_text="Remarks or reschedule notes")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='created_vote_requests')
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    reopened_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When this request was last reopened via reschedule. "
                   "Used to tell which voting round a cast vote belongs to."
    )

    def __str__(self):
        return f"Vote request for {self.task.task_name}"

    @property
    def is_open(self):
        if not self.is_active or not self.cutoff_date:
            return False
        now = timezone.now()
        cutoff = self.cutoff_date
        if isinstance(cutoff, datetime.date) and not isinstance(cutoff, datetime.datetime):
            return now.date() <= cutoff
        if timezone.is_naive(cutoff):
            cutoff = timezone.make_aware(cutoff, timezone.get_current_timezone())
        if timezone.is_naive(now):
            now = timezone.make_aware(now, timezone.get_current_timezone())
        return now <= cutoff

    @property
    def vote_counts(self):
        """Tally of how each voter on this request has voted so far."""
        yes = self.voters.filter(vote='yes').count()
        no = self.voters.filter(vote='no').count()
        pending = self.voters.filter(vote='pending').count()
        total = self.voters.count()
        return {'yes': yes, 'no': no, 'pending': pending, 'total': total}

    @property
    def result_status(self):
        """
        'pending'    : voting is still open and not all voters have cast votes yet
        'approved'   : all voters voted AND yes-votes > no-votes (final decision reached)
        'rejected'   : all voters voted AND yes-votes <= no-votes (final decision reached)
        'incomplete' : cutoff passed AND some voters are still pending
        """
        counts = self.vote_counts
        if counts['pending'] == 0 and counts['total'] > 0:
            return 'approved' if counts['yes'] > counts['no'] else 'rejected'
        if self.is_open:
            return 'pending'
        return 'incomplete'
    
# store the vote of BOD or employee for a task 

class TaskVoter(models.Model):
    VOTE_CHOICES = (('pending', 'Pending'), ('yes', 'Yes'), ('no', 'No'))

    vote_request = models.ForeignKey(TaskVoteRequest, on_delete=models.CASCADE, related_name='voters')
    bod = models.ForeignKey(BoardOfDirector, on_delete=models.CASCADE, null=True, blank=True, related_name='task_votes')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, null=True, blank=True, related_name='task_votes_to_cast')
    vote = models.CharField(max_length=10, choices=VOTE_CHOICES, default='pending')
    remarks = models.TextField(null=True, blank=True)
    voted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [('vote_request', 'bod'), ('vote_request', 'employee')]

    def __str__(self):
        voter = self.bod.name if self.bod_id else str(self.employee)
        return f"{voter} - {self.vote}"


# Team

class Team(models.Model):
    task = models.ForeignKey(
        Task, on_delete=models.CASCADE, related_name='teams', null=True, blank=True
    )
    subtask = models.ForeignKey(
        Subtask, on_delete=models.CASCADE, related_name='subtask_teams', null=True, blank=True,
        help_text="Set when this team belongs to one person's OWN subtask "
                   "rather than the top-level Task."
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_teams',
        help_text="The user who created the team — treated as the team lead."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        owner = self.task.task_name if self.task_id else (self.subtask.subtask_name if self.subtask_id else '—')
        lead = self.created_by.get_full_name() or self.created_by.username if self.created_by_id else 'Unknown'
        return f"Team for {owner} (led by {lead})"

    class Meta:
        verbose_name_plural = "Teams"
        ordering = ['-created_at']
 
class TeamMember(models.Model):
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='members')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='team_memberships')
    added_at = models.DateTimeField(auto_now_add=True)
 
    class Meta:
        unique_together = ('team', 'employee')
 
    def __str__(self):
        return f"{self.employee} in {self.team}"
    
class TaskAssignment(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='assignments', null=True, blank=True)
    parent_subtask = models.ForeignKey(
        Subtask, on_delete=models.CASCADE, null=True, blank=True, related_name='child_assignments',
        help_text="Set when splitting one person's OWN subtask across its "
                   "own child subtasks, instead of splitting a top-level Task."
    )
    subtask = models.ForeignKey(Subtask, on_delete=models.CASCADE, related_name='assignments')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='task_assignments')
    percentage = models.DecimalField(max_digits=5, decimal_places=2)
    is_approved = models.BooleanField(
        default=False,
        help_text="True when this assignment has been approved by the assigner. "
                  "Draft assignments remain hidden from team members until approved."
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_task_assignments'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('task', 'parent_subtask', 'subtask', 'employee')
        ordering = ['id']

    def __str__(self):
        return f"{self.subtask} → {self.employee} ({self.percentage}%)"

    @property
    def is_delegated(self):
        """True when this assignment's subtask has itself been split among
        sub-assignees (child TaskAssignment rows hanging off this subtask
        as their parent_subtask). Delegator rows don't get progress
        updates logged by hand — their % is derived from their children."""
        return TaskAssignment.objects.filter(parent_subtask_id=self.subtask_id, is_approved=True).exists()

    @property
    def completed_percentage(self):
        """Running total logged so far for this assignment.
        If delegated to child assignments, aggregates the progress across direct children
        weighted by each child's assigned percentage share, or uses latest direct update if higher.
        Otherwise, reads the latest cumulative_percentage snapshot from own progress updates,
        or Decimal('0')."""
        latest = self.progress_updates.order_by('-created_at', '-id').first()
        if self.is_delegated:
            child_pct = self._calculate_completed_percentage(visited=None)
            if latest:
                return max(child_pct, latest.cumulative_percentage)
            return child_pct
        if latest:
            return latest.cumulative_percentage
        return Decimal('0')

    def _calculate_completed_percentage(self, visited=None):
        if visited is None:
            visited = set()
        if self.id in visited:
            return Decimal('0')
        visited.add(self.id)

        if self.is_delegated:
            children = TaskAssignment.objects.filter(parent_subtask_id=self.subtask_id, is_approved=True)
            total_weight = sum(Decimal(str(c.percentage or 0)) for c in children)
            if not total_weight:
                return Decimal('0')
            weighted_sum = sum(
                Decimal(str(c.percentage or 0)) * Decimal(str(c._calculate_completed_percentage(visited)))
                for c in children
            )
            return round(weighted_sum / total_weight, 2)

        latest = self.progress_updates.order_by('-created_at', '-id').first()
        return latest.cumulative_percentage if latest else Decimal('0')



def task_progress_attachment_upload_path(instance, filename):
    folder = instance.assignment_id or f'task_{instance.task_id}'
    return f'task_progress_updates/{folder}/{filename}'


class TaskProgressUpdate(models.Model):
    """One progress-log entry submitted by the assignee of a LEAF
    TaskAssignment or by the owner of a Task.

    'percentage' is how much was completed SINCE the last update (or the
    confirmed overall % for delegated rollups).
    'cumulative_percentage' is a snapshot of that running total right
    after this entry.
    """
    assignment = models.ForeignKey(
        TaskAssignment, on_delete=models.CASCADE, related_name='progress_updates',
        null=True, blank=True
    )
    task = models.ForeignKey(
        Task, on_delete=models.CASCADE, related_name='progress_updates',
        null=True, blank=True
    )
    description_of_work = models.TextField(blank=True, null=True)
    challenges_faced = models.TextField(blank=True, null=True)
    pending_task = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True, help_text="Any additional notes for this update.")
    percentage = models.DecimalField(
        max_digits=5, decimal_places=2,
        help_text="Work completed since the last update — added to the running total."
    )
    cumulative_percentage = models.DecimalField(
        max_digits=5, decimal_places=2,
        help_text="Running total for this assignment immediately after this update."
    )
    document = models.FileField(
        upload_to=task_progress_attachment_upload_path, null=True, blank=True,
        help_text="Optional supporting document for this update."
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='task_progress_updates'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Task Progress Updates"
        ordering = ['-created_at']

    def __str__(self):
        target = self.assignment or self.task
        return f"{target} +{self.percentage}% (total {self.cumulative_percentage}%)"

    @property
    def is_editable_today(self):
        """An update can only be edited on the same calendar day it was
        submitted — locked (read-only) after that."""
        if not self.created_at:
            return False
        
        from datetime import date
        created_date = timezone.localtime(self.created_at).date() if timezone.is_aware(self.created_at) else self.created_at.date()
        return created_date == date.today()