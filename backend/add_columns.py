import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from django.db import connection

try:
    with connection.cursor() as cursor:
        cursor.execute("ALTER TABLE project_app_marketinglead ADD COLUMN latitude decimal(9,6) NULL;")
        cursor.execute("ALTER TABLE project_app_marketinglead ADD COLUMN longitude decimal(9,6) NULL;")
        cursor.execute("ALTER TABLE project_app_marketinglead ADD COLUMN location longtext NULL;")
    print("Columns added successfully")
except Exception as e:
    print(f"Error: {e}")
