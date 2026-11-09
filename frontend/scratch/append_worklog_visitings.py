import os
from datetime import datetime
import re

worklog_path = r'c:\Archana\glenda_vite\WORKLOG.md'

with open(worklog_path, 'r', encoding='utf-8') as f:
    content = f.read()

date_str = datetime.now().strftime('%Y-%M-%d')

new_entry = f"""
### 🐛 Fix: Fix delivery locations not showing in Salesman Visitings
**Files:** `SalesmanVisitings.jsx`, `backend/area_app/models.py`, `backend/area_app/serializers.py`, `backend/area_app/views.py`

- Fixed the issue where delivery locations added in Area Location Mapping were not available in Salesman Visitings.
- Updated `SalesmanVisiting` model and API to use `AreaLocationMapping` instead of `DeliveryLocation`.
- Modified `SalesmanVisitings.jsx` to fetch `AreaLocationMappings` based on the selected area and populate the dropdown.
- Addressed confusion between `DeliveryLocation` and `AreaLocationMapping` sources of truth.
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
