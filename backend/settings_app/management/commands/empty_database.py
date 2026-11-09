import sys
from django.core.management.base import BaseCommand
from django.db import connection

class Command(BaseCommand):
    help = (
        'Empties out the entire database except menu, submenu, subsubmenu, '
        'unit, DynamicTableConfiguration, and Django system metadata.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--noinput',
            '--no-input',
            action='store_true',
            help='Do not prompt for confirmation before truncating.',
        )

    def handle(self, *args, **options):
        # Tables to preserve (case-insensitive matching)
        preserved_tables_lower = {
            'register_app_menu',
            'register_app_submenu',
            'register_app_subsubmenu',
            'inventory_app_unit',
            'configuration_app_dynamictableconfiguration',
            'django_migrations',
            'django_content_type',
        }

        self.stdout.write(self.style.WARNING("=== DATABASE TRUNCATION ROUTINE ==="))

        with connection.cursor() as cursor:
            cursor.execute("SHOW TABLES;")
            all_tables = [row[0] for row in cursor.fetchall()]

        tables_to_truncate = []
        preserved_tables_found = []

        for table in all_tables:
            if table.lower() in preserved_tables_lower:
                preserved_tables_found.append(table)
            else:
                tables_to_truncate.append(table)

        self.stdout.write(self.style.NOTICE(f"Total tables detected: {len(all_tables)}"))
        self.stdout.write(self.style.SUCCESS(f"Preserved tables ({len(preserved_tables_found)}): {', '.join(sorted(preserved_tables_found))}"))
        self.stdout.write(self.style.WARNING(f"Tables to truncate ({len(tables_to_truncate)})"))

        if not options.get('noinput'):
            confirm = input("Are you absolutely sure you want to empty these tables? (yes/no): ")
            if confirm.strip().lower() != 'yes':
                self.stdout.write(self.style.ERROR("Operation aborted by user."))
                return

        truncated_count = 0
        error_count = 0

        with connection.cursor() as cursor:
            # Disable foreign key checks for clean truncation
            cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")

            try:
                for table in tables_to_truncate:
                    try:
                        cursor.execute(f"TRUNCATE TABLE `{table}`;")
                        truncated_count += 1
                    except Exception as ex:
                        error_count += 1
                        self.stdout.write(self.style.ERROR(f"Failed to truncate {table}: {ex}"))
            finally:
                # Always re-enable foreign key checks
                cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")

        self.stdout.write(self.style.SUCCESS(f"\nTruncation finished. Successfully truncated {truncated_count} tables. Errors: {error_count}"))

        # Verify preserved tables
        self.stdout.write(self.style.NOTICE("\n--- Preserved Table Counts ---"))
        with connection.cursor() as cursor:
            for table in sorted(preserved_tables_found):
                cursor.execute(f"SELECT COUNT(*) FROM `{table}`;")
                count = cursor.fetchone()[0]
                self.stdout.write(self.style.SUCCESS(f"  {table}: {count} records preserved"))

        # Verify any remaining rows in other tables
        remaining_records = 0
        with connection.cursor() as cursor:
            for table in tables_to_truncate:
                cursor.execute(f"SELECT COUNT(*) FROM `{table}`;")
                cnt = cursor.fetchone()[0]
                if cnt > 0:
                    remaining_records += cnt
                    self.stdout.write(self.style.ERROR(f"  Warning: {table} still has {cnt} rows!"))

        if remaining_records == 0:
            self.stdout.write(self.style.SUCCESS("\nAll other tables are completely empty!"))
        else:
            self.stdout.write(self.style.WARNING(f"\n{remaining_records} rows remain across non-truncated tables."))
