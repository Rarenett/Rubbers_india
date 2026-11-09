import logging
from apscheduler.schedulers.background import BackgroundScheduler
from finance_app.services.tally_odbc import TallyXMLService
from task_management_app.services import check_and_send_reminders
from django.conf import settings

logger = logging.getLogger('tally_sync')

def start_scheduler():
    scheduler = BackgroundScheduler()
    tally_service = TallyXMLService()
    
    interval = getattr(settings, 'SYNC_INTERVAL', 10)
    
    scheduler.add_job(
        tally_service.sync_ledgers,
        'interval',
        seconds=interval,
        id='tally_sync_job',
        replace_existing=True,
        max_instances=1,
        coalesce=True
    )
    
    # Task Reminders: run every 30 seconds
    scheduler.add_job(
        check_and_send_reminders,
        'interval',
        seconds=30,
        id='task_reminder_job',
        replace_existing=True,
        max_instances=1,
        coalesce=True
    )
    
    # Wallet Screenshot Schedules: run every 60 seconds
    try:
        from wallet_app.scheduler import process_background_screenshot_schedules
        scheduler.add_job(
            process_background_screenshot_schedules,
            'interval',
            seconds=60,
            id='wallet_screenshot_schedule_job',
            replace_existing=True,
            max_instances=1,
            coalesce=True
        )
    except Exception as e:
        logger.error(f"Failed to register wallet screenshot scheduler: {e}")

    scheduler.start()
    logger.info(f"APScheduler started for Tally sync every {interval}s, Task Reminders every 30s, and Wallet Screenshots every 60s.")

