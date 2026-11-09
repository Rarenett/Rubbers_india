import sqlite3

conn = sqlite3.connect('db.sqlite3')
conn.text_factory = lambda b: b.decode(errors='ignore')
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
for table in tables:
    table_name = table[0]
    try:
        cursor.execute(f"SELECT * FROM {table_name}")
        for row in cursor.fetchall():
            for val in row:
                if isinstance(val, str) and 'Rarenett' in val:
                    print(f"Found 'Rarenett' in Table: {table_name}, Data: {row}")
                    break
    except Exception as e:
        pass
