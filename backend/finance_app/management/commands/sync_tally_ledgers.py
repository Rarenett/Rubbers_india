import logging
import time
from django.core.management.base import BaseCommand
from finance_app.services.scheduler import start_scheduler

logger = logging.getLogger('tally_sync')

class Command(BaseCommand):
    help = 'Starts the Tally ODBC Ledger sync service in the background using APScheduler.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Starting Tally ODBC sync service..."))
        
        start_scheduler()
        
        try:
            while True:
                time.sleep(2)
        except (KeyboardInterrupt, SystemExit):
            self.stdout.write(self.style.SUCCESS("Stopping Tally ODBC sync service..."))
