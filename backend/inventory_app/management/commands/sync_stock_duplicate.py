from django.core.management.base import BaseCommand
from django.db import transaction
from inventory_app.models import StockTable, StockTableDuplicate


class Command(BaseCommand):
    help = "Clears StockTableDuplicate and re-populates it with all rows from StockTable."

    def handle(self, *args, **options):
        with transaction.atomic():
            self.stdout.write("Clearing all entries from StockTableDuplicate...")
            deleted_count, _ = StockTableDuplicate.objects.all().delete()
            self.stdout.write(f"Cleared {deleted_count} entries from StockTableDuplicate.")

            stock_entries = StockTable.objects.all()
            total_stock = stock_entries.count()
            self.stdout.write(f"Found {total_stock} entries in StockTable to sync...")

            new_duplicates = [
                StockTableDuplicate(
                    item_id=st.item_id,
                    movement_type=st.movement_type,
                    transaction_type=st.transaction_type,
                    reference_id=st.reference_id,
                    quantity=st.quantity,
                    damaged_stock=st.damaged_stock,
                    rate=st.rate,
                    batch_number=st.batch_number,
                    manufacture_date=st.manufacture_date,
                    expiry_date=st.expiry_date,
                    warehouse_id=st.warehouse_id,
                    verified_by_id=st.verified_by_id,
                    date=st.date,
                    time=st.time,
                    is_active=st.is_active,
                )
                for st in stock_entries
            ]

            created = StockTableDuplicate.objects.bulk_create(new_duplicates, batch_size=1000)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully synchronized {len(created)} records from StockTable to StockTableDuplicate."
                )
            )
