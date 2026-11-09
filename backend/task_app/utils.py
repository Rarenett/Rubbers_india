import datetime
from django.utils import timezone
from django.db.models import Q


def get_task_cutoff_date(task_or_assignment):
    """
    Returns the scheduled due date / deadline for a Task, TaskVoteRequest, TaskAssignment, or Subtask.
    Matches the task_due_date shown on task cards.
    """
    from .models import TaskAssignment, TaskVoteRequest, Task, Subtask

    if isinstance(task_or_assignment, TaskAssignment):
        a = task_or_assignment
        root = a.subtask.get_root_task() if a.subtask_id else a.task
        if root and root.due_date:
            return root.due_date
        if a.task and a.task.due_date:
            return a.task.due_date
        if a.subtask and a.subtask.end_date:
            return a.subtask.end_date
        return None

    if isinstance(task_or_assignment, Subtask):
        st = task_or_assignment
        root = st.get_root_task()
        if root and root.due_date:
            return root.due_date
        if st.end_date:
            return st.end_date
        if st.task and st.task.due_date:
            return st.task.due_date
        return None

    if isinstance(task_or_assignment, TaskVoteRequest):
        vr = task_or_assignment
        if vr.task and vr.task.due_date:
            return vr.task.due_date
        return None

    if isinstance(task_or_assignment, Task):
        return task_or_assignment.due_date

    return None


def get_task_submission_date(task_or_assignment, completed_pct=None):
    """
    Returns the submission datetime (TaskProgressUpdate.created_at) when the task/assignment was completed.
    Only returns a submission date if completed_pct >= 100.
    """
    from .models import TaskAssignment, TaskVoteRequest, Task, TaskProgressUpdate, Subtask

    if completed_pct is None:
        if isinstance(task_or_assignment, TaskVoteRequest):
            completed_pct = float(task_or_assignment.task.completed_percentage if task_or_assignment.task else 0)
        else:
            completed_pct = float(getattr(task_or_assignment, 'completed_percentage', 0) or 0)

    if completed_pct < 100:
        return None

    if isinstance(task_or_assignment, TaskAssignment):
        a = task_or_assignment
        u = a.progress_updates.order_by('-created_at').first()
        if not u and a.is_delegated:
            descendant_ids = [a.id]
            if a.subtask_id:
                stack = [a.subtask_id]
                while stack:
                    p = stack.pop()
                    for ch in TaskAssignment.objects.filter(parent_subtask_id=p):
                        descendant_ids.append(ch.id)
                        if ch.subtask_id:
                            stack.append(ch.subtask_id)
            u = TaskProgressUpdate.objects.filter(assignment_id__in=descendant_ids).order_by('-created_at').first()
        return u.created_at if u else None

    # Task or TaskVoteRequest
    task = task_or_assignment.task if isinstance(task_or_assignment, TaskVoteRequest) else task_or_assignment
    u = TaskProgressUpdate.objects.filter(
        Q(task=task) | Q(assignment__task=task) | Q(assignment__subtask__task=task)
    ).order_by('-created_at').first()
    return u.created_at if u else None


def calculate_due_dates_count(due_date_or_cutoff, submission_dt):
    """
    Calculates the count of days a task was completed AFTER its due date.
    Returns 0 if completed on or before the due date, or if dates are missing.
    """
    if not due_date_or_cutoff or not submission_dt:
        return 0

    if isinstance(due_date_or_cutoff, datetime.datetime):
        due_d = timezone.localtime(due_date_or_cutoff).date() if timezone.is_aware(due_date_or_cutoff) else due_date_or_cutoff.date()
    elif isinstance(due_date_or_cutoff, datetime.date):
        due_d = due_date_or_cutoff
    elif isinstance(due_date_or_cutoff, str):
        try:
            cleaned = str(due_date_or_cutoff).strip().split('T')[0].split(' ')[0]
            due_d = datetime.date.fromisoformat(cleaned)
        except Exception:
            return 0
    else:
        return 0

    if isinstance(submission_dt, datetime.datetime):
        sub_d = timezone.localtime(submission_dt).date() if timezone.is_aware(submission_dt) else submission_dt.date()
    elif isinstance(submission_dt, datetime.date):
        sub_d = submission_dt
    elif isinstance(submission_dt, str):
        try:
            cleaned_sub = str(submission_dt).strip().split('T')[0].split(' ')[0]
            sub_d = datetime.date.fromisoformat(cleaned_sub)
        except Exception:
            return 0
    else:
        return 0

    diff_days = (sub_d - due_d).days
    return max(0, diff_days)


def get_completion_and_due_info(task_or_assignment, completed_pct=None):
    """
    Convenience function that returns:
    (cutoff_date, submission_date, due_dates_count)
    """
    due_dt = get_task_cutoff_date(task_or_assignment)
    submission_dt = get_task_submission_date(task_or_assignment, completed_pct=completed_pct)
    due_dates_count = calculate_due_dates_count(due_dt, submission_dt)
    return due_dt, submission_dt, due_dates_count
