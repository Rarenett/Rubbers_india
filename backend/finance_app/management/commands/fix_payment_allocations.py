"""
Management command to fix old PaymentVoucherDetail records where
against_invoice is null but ref_name holds an invoice number like 'PI00014'.

Run:  python manage.py fix_payment_allocations
"""
from django.core.management.base import BaseCommand
from finance_app.models import PaymentVoucherDetail
from purchase_app.models import PurchaseInvoice


class Command(BaseCommand):
    help = 'Link PaymentVoucherDetail rows to PurchaseInvoice where ref_name matches invoice_no'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without saving',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        # Get all Dr details where against_invoice is null but ref_name looks like an invoice number
        unlinked = PaymentVoucherDetail.objects.filter(
            entry_type='Dr',
            against_invoice__isnull=True,
        ).exclude(ref_name__isnull=True).exclude(ref_name='').exclude(ref_name='On Account')

        self.stdout.write(f'Found {unlinked.count()} unlinked payment detail rows')

        fixed = 0
        skipped = 0

        # Build a lookup map of invoice_no -> PurchaseInvoice
        invoice_map = {inv.invoice_no: inv for inv in PurchaseInvoice.objects.all()}

        for detail in unlinked:
            invoice = invoice_map.get(detail.ref_name)
            if invoice:
                if dry_run:
                    self.stdout.write(
                        f'  [DRY RUN] Would link: {detail.voucher.voucher_no} detail #{detail.pk} '
                        f'ref_name={detail.ref_name} -> invoice {invoice.invoice_no} (id={invoice.pk})'
                    )
                else:
                    detail.against_invoice = invoice
                    detail.ref_type = 'against_ref'
                    detail.save()
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'  Linked: {detail.voucher.voucher_no} detail #{detail.pk} '
                            f'ref_name={detail.ref_name} -> invoice {invoice.invoice_no}'
                        )
                    )
                fixed += 1
            else:
                skipped += 1
                self.stdout.write(
                    f'  Skipped: {detail.voucher.voucher_no} detail #{detail.pk} '
                    f'ref_name={detail.ref_name!r} (no matching invoice)'
                )

        if dry_run:
            self.stdout.write(self.style.WARNING(f'\nDRY RUN complete. Would fix {fixed}, skip {skipped}'))
        else:
            self.stdout.write(self.style.SUCCESS(f'\nDone. Fixed {fixed}, skipped {skipped}'))
