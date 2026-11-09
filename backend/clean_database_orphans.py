import sys
import MySQLdb

def clean_database(db_name='glendaaaa'):
    print(f"=== Scanning and Cleaning All Orphan Foreign Keys in Database [{db_name}] ===")
    conn = MySQLdb.connect(host='localhost', user='root', passwd='', db=db_name)
    cursor = conn.cursor()

    # Get all foreign keys in database
    fk_query = """
        SELECT 
            TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME, IS_NULLABLE
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        JOIN INFORMATION_SCHEMA.COLUMNS USING (TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME)
        WHERE TABLE_SCHEMA = %s AND REFERENCED_TABLE_NAME IS NOT NULL
    """
    cursor.execute(fk_query, (db_name,))
    fk_list = cursor.fetchall()
    print(f"Found {len(fk_list)} Foreign Key relationships to inspect in database [{db_name}].")

    overall_cleaned = 0
    overall_nulled = 0
    overall_deleted = 0

    for pass_num in range(1, 6):
        pass_cleaned = 0
        print(f"\n--- PASS {pass_num} ---")
        for table, col, ref_table, ref_col, is_nullable in fk_list:
            check_sql = f"SELECT COUNT(*) FROM `{table}` WHERE `{col}` IS NOT NULL AND `{col}` NOT IN (SELECT `{ref_col}` FROM `{ref_table}`)"
            try:
                cursor.execute(check_sql)
                count = cursor.fetchone()[0]
                if count > 0:
                    if is_nullable == 'YES':
                        update_sql = f"UPDATE `{table}` SET `{col}` = NULL WHERE `{col}` IS NOT NULL AND `{col}` NOT IN (SELECT `{ref_col}` FROM `{ref_table}`)"
                        cursor.execute(update_sql)
                        conn.commit()
                        print(f"[NULLED] Nulled {count} orphan references in [{table}.{col}] -> [{ref_table}.{ref_col}]")
                        overall_nulled += count
                    else:
                        delete_sql = f"DELETE FROM `{table}` WHERE `{col}` IS NOT NULL AND `{col}` NOT IN (SELECT `{ref_col}` FROM `{ref_table}`)"
                        cursor.execute(delete_sql)
                        conn.commit()
                        print(f"[DELETED] Deleted {count} orphan child records from [{table}] referencing missing [{ref_table}.{ref_col}]")
                        overall_deleted += count
                    pass_cleaned += count
                    overall_cleaned += count
            except Exception as e:
                # FK check might fail if parent table/column deleted or temporary lock
                pass

        if pass_cleaned == 0:
            print("No more orphan records found!")
            break

    conn.close()
    print(f"\n=== CLEANUP COMPLETE FOR [{db_name}] ===")
    print(f"Total Orphan Operations: {overall_cleaned} (Nulled: {overall_nulled}, Deleted: {overall_deleted})")

if __name__ == '__main__':
    target_db = sys.argv[1] if len(sys.argv) > 1 else 'glendaaaa'
    clean_database(target_db)
