import os
from datetime import datetime

worklog_path = r'c:\Archana\glenda_vite\WORKLOG.md'

with open(worklog_path, 'r', encoding='utf-8') as f:
    content = f.read()

date_str = datetime.now().strftime('%Y-%m-%d')

new_entry = """
### 🐛 Fix: Sync AreaLocationMapping with DeliveryLocation
**Files:** `backend/area_app/models.py`, `backend/sync_locations.py`

- Reverted previous UI changes to `SalesmanVisitings` and `SalesmanVisiting` model.
- Wrote and executed a script to copy all newly added `AreaLocationMapping` entries into the `area_app_deliverylocation` table.
- Added a `post_save` signal on `AreaLocationMapping` so that any future newly mapped locations are automatically synced to the `DeliveryLocation` table without affecting any other logic.
"""

if '## ' + date_str in content:
    lines = content.splitlines()
    for i in range(len(lines) - 1, -1, -1):
        if lines[i].startswith('*Last updated:'):
            lines.insert(i, new_entry)
            break
    content = '\n'.join(lines)
else:
    content = content.replace('*Last updated:', f'## {date_str}\n{new_entry}\n\n*Last updated:')

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)
