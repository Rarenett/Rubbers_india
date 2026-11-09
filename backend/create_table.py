import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.db import connection
from crm.models import CrmLeadFollowUp

with connection.schema_editor() as schema_editor:
    try:
        schema_editor.create_model(CrmLeadFollowUp)
        print("Table created successfully!")
    except Exception as e:
        print(f"Error creating table: {e}")
