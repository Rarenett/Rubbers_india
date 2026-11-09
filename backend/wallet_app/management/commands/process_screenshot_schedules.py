from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from wallet_app.models import (
    ScreenshotSchedule,
    ScreenshotExecution,
    get_wallet_local_date,
    get_wallet_local_time,
    get_wallet_local_datetime,
)


class Command(BaseCommand):
    help = "Evaluates scheduled screenshot times, records missed executions for offline/elapsed schedules, and manages retention."

    def add_arguments(self, parser):
        parser.add_argument(
            '--retention-days',
            type=int,
            default=30,
            help='Number of days to retain screenshot image files (default: 30 days)'
        )

    def handle(self, *args, **options):
        today = get_wallet_local_date()
        now_time = get_wallet_local_time()
        retention_days = options.get('retention_days', 30)

        self.stdout.write(f"Processing screenshot schedules for {today}...")

        # 1. Past dates: active schedules with no Captured execution
        past_schedules = ScreenshotSchedule.objects.filter(
            scheduled_date__lt=today,
            is_active=True
        ).exclude(executions__status='Captured')

        # 2. Today's elapsed schedules: active schedules past scheduled_time by > 15 minutes
        cur_dt = datetime.combine(today, now_time)
        today_schedules = ScreenshotSchedule.objects.filter(
            scheduled_date=today,
            is_active=True
        ).exclude(executions__status='Captured')

        missed_count = 0

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
                missed_count += 1

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
                    missed_count += 1

        # 3. Retention cleanup for files older than retention_days
        cleanup_date = today - timedelta(days=retention_days)
        expired_executions = ScreenshotExecution.objects.filter(
            scheduled_date__lt=cleanup_date,
            screenshot_file__isnull=False
        ).exclude(screenshot_file='')

        cleaned_files_count = 0
        for exec_rec in expired_executions:
            try:
                if exec_rec.screenshot_file and hasattr(exec_rec.screenshot_file, 'path'):
                    import os
                    if os.path.exists(exec_rec.screenshot_file.path):
                        os.remove(exec_rec.screenshot_file.path)
                exec_rec.screenshot_file = None
                exec_rec.error_message = (exec_rec.error_message or '') + f" [Image purged per {retention_days}-day retention policy]"
                exec_rec.save(update_fields=['screenshot_file', 'error_message'])
                cleaned_files_count += 1
            except Exception as e:
                self.stderr.write(f"Error purging file for execution #{exec_rec.id}: {e}")

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully processed schedules: {missed_count} marked as missed. "
                f"Purged {cleaned_files_count} expired screenshot file(s) older than {retention_days} days."
            )
        )
