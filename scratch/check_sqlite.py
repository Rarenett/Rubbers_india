import sqlite3

try:
    con = sqlite3.connect('backend/db.sqlite3')
    cur = con.cursor()
    tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    print("Tables in sqlite:", len(tables))
    for t in tables:
        if 'menu' in t.lower() or 'digilocker' in t.lower():
            print("  ", t)
except Exception as e:
    print("Error:", e)

