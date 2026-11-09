import time
from django.core.management.base import BaseCommand
from sales_app.models import SalesOrder, TallySyncConfig
from sales_app.services.tally_service import push_sales_order_to_tally

class Command(BaseCommand):
    help = 'Syncs pending sales orders to Tally continuously when auto-push is enabled'

    def add_arguments(self, parser):
        parser.add_argument(
            '--interval',
            type=int,
            default=15,
            help='Polling interval in seconds'
        )
        parser.add_argument(
            '--tally-url',
            type=str,
            default=None,
            help='Tally Server URL (overrides database config)'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Push pending orders even if auto_push_on_save toggle is OFF'
        )

    def handle(self, *args, **options):
        interval = options['interval']
        custom_tally_url = options['tally_url']
        force = options['force']
        
        self.stdout.write(self.style.SUCCESS(f'Starting Tally Connector daemon (Polling every {interval}s)...'))
        
        while True:
            from django.db import connection
            connection.close()

            config = TallySyncConfig.objects.filter(voucher_type='Sales Order').first()
            is_auto_push = config.auto_push_on_save if config else False
            active_url = custom_tally_url or (config.tally_url if config else 'http://localhost:9000')

            if not is_auto_push and not force:
                time.sleep(interval)
                continue

            pending_orders = SalesOrder.objects.filter(is_synced=False).exclude(sync_status='processing')
            
            if pending_orders.exists():
                self.stdout.write(f"Found {pending_orders.count()} pending orders. Processing...")
                
                for order in pending_orders:
                    order.sync_status = 'processing'
                    order.save(update_fields=['sync_status'])

                    res = push_sales_order_to_tally(order, tally_url=active_url)
                    if res.get('success'):
                        self.stdout.write(self.style.SUCCESS(f"Order {order.so_no}: {res.get('message')}"))
                    else:
                        self.stdout.write(self.style.ERROR(f"Order {order.so_no} Failed: {res.get('message')}"))
                        
            time.sleep(interval)
