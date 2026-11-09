import time
from django.core.management.base import BaseCommand
from django.conf import settings
from purchase_app.models import PurchaseInvoice, PurchaseInvoiceSyncLog,PurchaseTallySyncConfig
from tally.xml_builder import generate_purchase_invoice_xml
from tally.tally_client import send_xml_to_tally


class Command(BaseCommand):
    help = 'Syncs pending Purchase Invoices to Tally continuously (Local Mode)'

    def add_arguments(self, parser):
        default_interval = getattr(settings, 'SYNC_INTERVAL', 10)
        default_server = getattr(settings, 'TALLY_ODBC_SERVER', 'localhost')
        default_port = getattr(settings, 'TALLY_ODBC_PORT', '9000')
        default_tally_url = f"http://{default_server}:{default_port}"

        parser.add_argument(
            '--force',
            action='store_true',
            help='Push pending invoices even if auto_push_on_save toggle is OFF'
        )

        parser.add_argument(
            '--interval',
            type=int,
            default=default_interval,
            help=f'Polling interval in seconds (default: {default_interval})'
        )
        parser.add_argument(
            '--tally-url',
            type=str,
            default=default_tally_url,
            help=f'Tally Server URL (default: {default_tally_url})'
        )

    def handle(self, *args, **options):
        tally_mode = getattr(settings, 'TALLY_MODE', 'local')
        if tally_mode != 'local':
            self.stdout.write(
                self.style.ERROR(
                    f"TALLY_MODE is set to '{tally_mode}'. "
                    "The local sync command only runs when TALLY_MODE = 'local'."
                )
            )
            return

        interval = options['interval']
        tally_url = options['tally_url']
        force = options['force']

        self.stdout.write(
            self.style.SUCCESS(
                f"Starting Purchase Invoice Tally Sync on {tally_url} (interval: {interval}s)..."
            )
        )

        while True:
            config = PurchaseTallySyncConfig.objects.filter(voucher_type='Purchase Invoice').first()
            is_auto_push = config.auto_push_on_save if config else False
            if not is_auto_push and not force:
                time.sleep(interval)
                continue
            try:
                pending_invoices = PurchaseInvoice.objects.filter(
                    sync_status__in=['pending', 'failed'],
                    is_synced=False
                )

                if pending_invoices.exists():
                    count = pending_invoices.count()
                    self.stdout.write(f"Found {count} pending purchase invoice(s). Processing...")

                    for invoice in pending_invoices:
                        # Note: Invoices are flipped to 'processing' FIRST before XML generation/sending.
                        # If a process crashes mid-send, stuck 'processing' rows should be reset to 'pending' manually via admin/management utility.
                        invoice.sync_status = 'processing'
                        invoice.save(update_fields=['sync_status'])

                        try:
                            xml_data = generate_purchase_invoice_xml(invoice)

                            self.stdout.write(
                                self.style.WARNING(
                                    f"\n--- Generated XML for Invoice {invoice.invoice_no} ---\n"
                                    f"{xml_data}\n--- END XML ---\n"
                                )
                            )

                            success, response_text, err_msg = send_xml_to_tally(xml_data, tally_url)

                            self.stdout.write(
                                self.style.WARNING(
                                    f"Tally Response for Invoice {invoice.invoice_no}:\n"
                                    f"{response_text or err_msg}\n"
                                )
                            )

                            if success:
                                invoice.sync_status = 'synced'
                                invoice.is_synced = True
                                log_status = 'success'
                            else:
                                invoice.sync_status = 'failed'
                                invoice.is_synced = False
                                log_status = 'failed'

                            invoice.save(update_fields=['sync_status', 'is_synced'])

                            PurchaseInvoiceSyncLog.objects.create(
                                invoice=invoice,
                                tally_response=response_text,
                                error_message=err_msg,
                                status=log_status
                            )

                            if success:
                                self.stdout.write(
                                    self.style.SUCCESS(
                                        f"Successfully synced Invoice {invoice.invoice_no} to Tally."
                                    )
                                )
                            else:
                                self.stdout.write(
                                    self.style.ERROR(
                                        f"Failed to sync Invoice {invoice.invoice_no}: {err_msg}"
                                    )
                                )

                        except Exception as e:
                            invoice.sync_status = 'failed'
                            invoice.is_synced = False
                            invoice.save(update_fields=['sync_status', 'is_synced'])

                            error_str = str(e)
                            PurchaseInvoiceSyncLog.objects.create(
                                invoice=invoice,
                                error_message=error_str,
                                status='failed'
                            )

                            self.stdout.write(
                                self.style.ERROR(
                                    f"Error processing Invoice {invoice.invoice_no}: {error_str}"
                                )
                            )

            except Exception as batch_error:
                self.stdout.write(
                    self.style.ERROR(f"Error in sync loop batch: {str(batch_error)}")
                )

            time.sleep(interval)
