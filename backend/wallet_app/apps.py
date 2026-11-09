import os
import sys
from django.apps import AppConfig


class WalletAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'wallet_app'
    verbose_name = 'Wallet Module'

    def ready(self):
        # Only start scheduler once in the main server worker process
        if 'runserver' in sys.argv:
            if os.environ.get('RUN_MAIN') == 'true':
                try:
                    from finance_app.services.scheduler import start_scheduler
                    start_scheduler()
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).warning(f"Could not auto-start background scheduler: {e}")
