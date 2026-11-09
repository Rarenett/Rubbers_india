import os
import sys
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection

# List of lower-case table names to PRESERVE (NEVER TRUNCATE)
PRESERVED_TABLES = {
    # --- User Requested Preserved Tables ---
    'register_app_menu',
    'register_app_submenu',
    'register_app_subsubmenu',
    'finance_app_accountgroup',
    'finance_app_accountsgroup',
    'inventory_app_stockgroup',
    'inventory_app_stockcategory',
    'finance_app_vouchertype',
    'rarenett_app_department',
    'rarenett_app_designation',
    'rarenett_app_departmentdesignation',
    'rarenett_app_candidate',
    'rarenett_app_employee',
    'rarenett_app_employmentdetails',
    'rarenett_app_employeeroleexpiry',
    'inventory_app_unit',
    'inventory_app_stockdefinition',
    'inventory_app_stockgrouphsn',
    'inventory_app_stockgroupgst',

    # --- Critical System, Auth & Infrastructure Tables ---
    'django_migrations',
    'django_content_type',
    'django_session',
    'register_app_customuser',
    'register_app_customuser_user_permissions',
    'register_app_customuser_groups',
    'register_app_role',
    'register_app_rolemenupermission',
    'register_app_rolemenupermission_submenus',
    'register_app_rolemenupermission_subsubmenus',
    'register_app_userroleassignment',

    # --- Core Company / Branch Structure ---
    'settings_app_company',
    'settings_app_companyaddress',
    'settings_app_companycontact',
    'settings_app_companyfinancialyear',
    'settings_app_branch',
    'settings_app_branchaddress',
    'settings_app_branchcontact',
    'settings_app_factory',
    'settings_app_factoryaddress',
    'settings_app_factorycontact',
    'settings_app_warehouse',
    'settings_app_warehouseaddress',
    'settings_app_warehousecontact',
    'settings_app_prefixtype',
    'settings_app_prefixconfiguration',
    'settings_app_currency',
    'settings_app_exchangerate',
    'settings_app_language',
    'settings_app_databasebackupschedule',
}

def preview_tables():
    with connection.cursor() as cursor:
        cursor.execute("SHOW TABLES;")
        all_tables = [r[0].lower() for r in cursor.fetchall()]

    preserved_found = []
    to_clear = []

    for t in all_tables:
        if t in PRESERVED_TABLES or t.startswith('django_'):
            preserved_found.append(t)
        else:
            to_clear.append(t)

    return all_tables, preserved_found, to_clear

def execute_clear():
    all_tables, preserved_found, to_clear = preview_tables()

    print("==================================================")
    print(f"Total Database Tables Found : {len(all_tables)}")
    print(f"Preserved Master/System Tables : {len(preserved_found)}")
    print(f"Tables To Be Cleared (Truncated): {len(to_clear)}")
    print("==================================================\n")

    cleared_count = 0
    failed_count = 0

    with connection.cursor() as cursor:
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
        
        for table in to_clear:
            try:
                cursor.execute(f"TRUNCATE TABLE `{table}`;")
                cleared_count += 1
                print(f"  [OK] Cleared table: {table}")
            except Exception as e:
                failed_count += 1
                print(f"  [ERR] Failed to clear {table}: {e}")

        cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")

    print("\n==================================================")
    print(f"Cleanup Completed! {cleared_count} tables cleared successfully, {failed_count} failed.")
    print("==================================================")

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--confirm':
        execute_clear()
    else:
        all_tables, preserved_found, to_clear = preview_tables()
        print("PREVIEW MODE - No changes executed.")
        print("\n--- PRESERVED TABLES (Will NOT be deleted) ---")
        for p in sorted(preserved_found):
            print(f"  [KEEP] {p}")

        print(f"\n--- TABLES TO BE CLEARED ({len(to_clear)} tables) ---")
        for c in sorted(to_clear):
            print(f"  [DELETE] {c}")

        print("\nTo execute truncation, run: python clear_data_except_masters.py --confirm")
