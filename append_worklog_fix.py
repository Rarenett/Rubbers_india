import os
from datetime import datetime
import re

worklog_path = r"c:\Archana\glenda_vite\WORKLOG.md"

with open(worklog_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove old timestamp
content = re.sub(r'\n\*Last updated:.*?\*\n', '', content).strip()

now = datetime.now()
date_str = now.strftime('%Y-%m-%d')
time_str = now.strftime('%Y-%m-%d %H:%M IST')

entry = f"""
---

## {date_str}

### 🐛 Fix: Resolve AttributeError on Team Edit
**Files:** `backend/crm/views.py`

- Fixed a 500 Internal Server Error (`AttributeError`) occurring when saving an edited Telecalling Team.
- Corrected the related name accessor in `TelecallingTeamViewSet.update()` from `team.leads.all().delete()` to `team.lead_assignments.all().delete()` to properly clear and replace lead assignments during a PATCH request.

"""

content += "\n" + entry + f"\n*Last updated: {time_str}*\n"

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)
