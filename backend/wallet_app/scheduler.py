import logging
from datetime import datetime, timedelta
from django.utils import timezone
from wallet_app.models import (
    ScreenshotSchedule,
    ScreenshotExecution,
    get_wallet_local_date,
    get_wallet_local_time,
)

logger = logging.getLogger(__name__)


def process_background_screenshot_schedules():
    """
    Evaluates pending screenshot schedules in the background.
    Marks elapsed schedules (past by > 15 minutes without capture) as Missed.
    Runs periodically via backend background scheduler without requiring user interaction.
    """
    try:
        today = get_wallet_local_date()
        now_time = get_wallet_local_time()
        cur_dt = datetime.combine(today, now_time)

        # 1. Past dates: active schedules with no Captured execution
        past_schedules = ScreenshotSchedule.objects.filter(
            scheduled_date__lt=today,
            is_active=True
        ).exclude(executions__status='Captured')

        for sched in past_schedules:
            if not sched.executions.filter(status='Missed').exists():
                sched_dt = datetime.combine(sched.scheduled_date, sched.scheduled_time)
                if timezone.is_aware(timezone.now()):
                    sched_dt = timezone.make_aware(sched_dt)
                ScreenshotExecution.objects.create(
                    schedule=sched,
                    user=sched.user,
                    scheduled_date=sched.scheduled_date,
                    scheduled_time=sched.scheduled_time,
                    scheduled_datetime=sched_dt,
                    status='Missed',
                    error_message='Scheduled time elapsed while capture session or user was offline.'
                )

        # 2. Today's elapsed schedules (past by > 15 minutes)
        today_schedules = ScreenshotSchedule.objects.filter(
            scheduled_date=today,
            is_active=True
        ).exclude(executions__status='Captured')

        for sched in today_schedules:
            sched_dt = datetime.combine(today, sched.scheduled_time)
            if cur_dt > sched_dt + timedelta(minutes=15):
                if not sched.executions.filter(status='Missed').exists():
                    if timezone.is_aware(timezone.now()):
                        sched_dt = timezone.make_aware(sched_dt)
                    ScreenshotExecution.objects.create(
                        schedule=sched,
                        user=sched.user,
                        scheduled_date=sched.scheduled_date,
                        scheduled_time=sched.scheduled_time,
                        scheduled_datetime=sched_dt,
                        status='Missed',
                        error_message='Scheduled time elapsed while capture session or user was offline.'
                    )
    except Exception as e:
        logger.error(f"Error in process_background_screenshot_schedules: {e}")
