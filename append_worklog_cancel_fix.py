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

### 🎨 Improvement: Unify Cancel Button UI across Modals
**Files:** `frontend/src/jsx/components/crm_new/TeleCallingDashboard.jsx`

- Reused the `.btn-close-custom` styling (purple `#7A70BA`) for the "Cancel" button inside the Edit Telecalling Team modal to exactly match the ERP convention from `ParkArea.jsx`.
- This ensures visual consistency across the Create, Edit, and View modals.

"""

content += "\n" + entry + f"\n*Last updated: {time_str}*\n"

with open(worklog_path, 'w', encoding='utf-8') as f:
    f.write(content)
