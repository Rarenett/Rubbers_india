from django.core.management.base import BaseCommand
from django.db import connection, transaction

class Command(BaseCommand):
    help = 'Clears all transaction data, ledgers, stock items, BOM, sales/purchase orders, invoices, and quotations'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Starting database transaction cleanup..."))

        # List of app models / table names to clear
        target_tables = [
            # Sales App
            'sales_app_salesinvoiceitem',
            'sales_app_salesinvoice',
            'sales_app_salesorderitem',
            'sales_app_salesorder',
            'sales_app_quotationitem',
            'sales_app_quotation',
            'sales_app_proformainvoiceitem',
            'sales_app_proformainvoice',
            'sales_app_deliverynoteitem',
            'sales_app_deliverynote',

            # Purchase App
            'purchase_app_purchaseinvoiceitem',
            'purchase_app_purchaseinvoice',
            'purchase_app_purchaseorderitem',
            'purchase_app_purchaseorder',
            'purchase_app_purchasereceiptitem',
            'purchase_app_purchasereceipt',
            'purchase_app_debitnote',
            'purchase_app_creditnote',

            # Production & BOM App
            'production_app_bomitem',
            'production_app_bom',
            'production_app_billofmaterialsitem',
            'production_app_billofmaterials',
            'production_app_productionorder',
            'production_app_workorder',
            'production_app_stockentry',

            # Inventory & Price List App
            'inventory_app_ledgerpricelistmapping',
            'inventory_app_pricelistitem',
            'inventory_app_pricelist',
            'inventory_app_stockmovement',
            'inventory_app_stockbatch',
            'inventory_app_stockdefinition',
            'inventory_app_stockitem',
            'inventory_app_item',

            # Finance & Ledger App
            'finance_app_voucherextracharge',
            'finance_app_voucheritem',
            'finance_app_voucher',
            'finance_app_journalentryitem',
            'finance_app_journalentry',
            'finance_app_paymentvoucher',
            'finance_app_receiptvoucher',
            'finance_app_ledger',
        ]

        cleared_count = 0
        with connection.cursor() as cursor:
            # Disable foreign key checks for safe truncation
            cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
            
            # Fetch all existing tables in database
            cursor.execute("SHOW TABLES;")
            existing_tables = set(r[0].lower() for r in cursor.fetchall())

            for table in target_tables:
                if table.lower() in existing_tables:
                    try:
                        cursor.execute(f"TRUNCATE TABLE `{table}`;")
                        cleared_count += 1
                        self.stdout.write(self.style.SUCCESS(f"  [OK] Cleared table: {table}"))
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f"  [ERR] Failed to clear {table}: {e}"))

            # Re-enable foreign key checks
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")

        self.stdout.write(self.style.SUCCESS(f"\nCleanup complete! Cleared {cleared_count} transaction tables."))
