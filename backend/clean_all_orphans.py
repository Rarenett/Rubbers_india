import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.apps import apps
from django.db import connection, transaction

def clean_all_orphans():
    print("=== Scanning and Cleaning All Orphan Foreign Key References ===")
    overall_cleaned = 0
    overall_nulled = 0
    overall_deleted = 0

    existing_tables = set(connection.introspection.table_names())

    for pass_num in range(1, 6):
        pass_cleaned = 0
        print(f"\n--- PASS {pass_num} ---")
        for model in apps.get_models():
            meta = model._meta
            table_name = meta.db_table
            if table_name not in existing_tables:
                continue
            
            for field in meta.get_fields():
                if field.is_relation and field.many_to_one and field.concrete:
                    related_model = field.related_model
                    if not related_model:
                        continue
                    related_table = related_model._meta.db_table
                    if related_table not in existing_tables:
                        continue
                    column = field.column
                    pk_column = related_model._meta.pk.column
                    if not column or not pk_column:
                        continue

                    check_sql = f"SELECT COUNT(*) FROM `{table_name}` WHERE `{column}` IS NOT NULL AND `{column}` NOT IN (SELECT `{pk_column}` FROM `{related_table}`)"
                    try:
                        with connection.cursor() as cursor:
                            cursor.execute(check_sql)
                            count = cursor.fetchone()[0]
                            if count > 0:
                                if field.null:
                                    update_sql = f"UPDATE `{table_name}` SET `{column}` = NULL WHERE `{column}` IS NOT NULL AND `{column}` NOT IN (SELECT `{pk_column}` FROM `{related_table}`)"
                                    cursor.execute(update_sql)
                                    print(f"[NULLED] Nulled {count} orphan references in [{table_name}.{column}] -> [{related_table}.{pk_column}]")
                                    overall_nulled += count
                                else:
                                    delete_sql = f"DELETE FROM `{table_name}` WHERE `{column}` IS NOT NULL AND `{column}` NOT IN (SELECT `{pk_column}` FROM `{related_table}`)"
                                    cursor.execute(delete_sql)
                                    print(f"[DELETED] Deleted {count} orphan child records from [{table_name}] referencing missing [{related_table}.{pk_column}]")
                                    overall_deleted += count
                                pass_cleaned += count
                                overall_cleaned += count
                    except Exception as e:
                        pass
        
        if pass_cleaned == 0:
            print("No more orphan records found!")
            break

    print("\n=== CLEANUP COMPLETE ===")
    print(f"Total Orphan Operations: {overall_cleaned} (Nulled: {overall_nulled}, Deleted: {overall_deleted})")

if __name__ == '__main__':
    clean_all_orphans()
