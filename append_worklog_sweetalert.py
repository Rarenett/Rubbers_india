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

### ⌨️ Improvement: Standardize Success Alerts on Team Update
**Files:** `frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx`

- Replaced the erratic auto-refresh logic during team updates/creations with a promise-chained `.then()` on `Swal.fire`.
- The user now correctly sees the exact `"Team updated successfully!"` alert popup, which requires them to acknowledge it before the page reloads to sync backend lead counts.
- Eliminated duplicate text strings in the alert, matching the strict styling requested for project success messages.

"""

content += "\n" + entry + f"\n*Last updated: {time_str}*\n"

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)
